// api/accept-booking.js

import Pusher from 'pusher';
import { Redis } from '@upstash/redis'; // Updated import

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const redis = new Redis({ // Changed 'kv' to 'redis'
  url: process.env.UPSTASH_REDIS_REST_URL, // Updated ENV VAR NAME
  token: process.env.UPSTASH_REDIS_REST_TOKEN, // Updated ENV VAR NAME
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
    console.log(`API: accept-booking - Driver ${driverId} attempting to accept booking ${bookingId}.`);
    const booking = await redis.hgetall(`booking:${bookingId}`); // Changed 'kv' to 'redis'

    if (!booking || Object.keys(booking).length === 0) {
        console.error(`API: accept-booking - Booking ${bookingId} not found or empty.`);
        return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.status !== 'pending') {
        console.warn(`API: accept-booking - Booking ${bookingId} status is ${booking.status}, expected 'pending'.`);
        return res.status(400).json({ message: `Booking not in pending state, current: ${booking.status}` });
    }

    // Update booking status and assign driver
    await redis.hset(`booking:${bookingId}`, { status: 'accepted', driverId: driverId }); // Changed 'kv' to 'redis'
    console.log(`API: accept-booking - Booking ${bookingId} accepted by ${driverId}.`);

    // Optional: Notify rider via Pusher that a driver has been assigned
    if (booking.riderId) {
        pusher.trigger(`rider-${booking.riderId}`, 'driver-assigned', { bookingId, driverId, status: 'accepted' });
        console.log(`API: accept-booking - Pusher event 'driver-assigned' triggered for rider ${booking.riderId}.`);
    }

    res.status(200).json({ message: 'Booking accepted', bookingId });

  } catch (error) {
    console.error('API: accept-booking - ERROR during processing:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
