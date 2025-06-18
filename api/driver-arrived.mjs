// api/driver-arrived.js

import Pusher from 'pusher';
import { createClient } from '@vercel/kv';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bookingId, driverId } = req.body;

  if (!bookingId || !driverId) {
    return res.status(400).json({ message: 'Missing bookingId or driverId' });
  }

  try {
    const booking = await kv.hgetall(`booking:${bookingId}`);

    if (!booking) {
        console.error(`Booking ${bookingId} not found in KV for driver-arrived.`); // Add for debug
        return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.driverId !== driverId) {
        console.warn(`Unauthorized driver ${driverId} for booking ${bookingId}. Expected ${booking.driverId}`); // Add for debug
        return res.status(403).json({ message: 'Unauthorized: Driver not assigned to this booking' });
    }
    if (booking.status !== 'accepted') {
        console.warn(`Booking ${bookingId} status is ${booking.status}, expected 'accepted' for driver-arrived.`); // Add for debug
        return res.status(400).json({ message: `Booking status is ${booking.status}, expected 'accepted'` });
    }

    await kv.hset(`booking:${bookingId}`, { status: 'driver_arrived' });
    console.log(`Booking ${bookingId} status updated to driver_arrived by ${driverId}.`);

    if (booking.riderId) {
        pusher.trigger(`rider-${booking.riderId}`, 'driver-arrived', { bookingId, driverId, status: 'arrived' });
    }

    res.status(200).json({ message: 'Arrival acknowledged', bookingId });

  } catch (error) {
    console.error('Error in /api/driver-arrived:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
