// api/driver-arrived.js

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
    console.error("API: driver-arrived - Missing bookingId or driverId in request body.");
    return res.status(400).json({ message: 'Missing bookingId or driverId' });
  }

  try {
    console.log(`API: driver-arrived - Attempting to fetch booking:${bookingId} for driver ${driverId}.`);
    const booking = await redis.hgetall(`booking:${bookingId}`); // Changed 'kv' to 'redis'

    if (!booking || Object.keys(booking).length === 0) {
        console.error(`API: driver-arrived - Booking ${bookingId} not found or empty in Upstash Redis.`);
        return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.driverId !== driverId) {
        console.warn(`API: driver-arrived - Unauthorized driver ${driverId} for booking ${bookingId}. Expected ${booking.driverId}`);
        return res.status(403).json({ message: 'Unauthorized: Driver not assigned to this booking' });
    }
    if (booking.status !== 'accepted') {
        console.warn(`API: driver-arrived - Booking ${bookingId} status is ${booking.status}, expected 'accepted'.`);
        return res.status(400).json({ message: `Booking status is ${booking.status}, expected 'accepted'` });
    }

    console.log(`API: driver-arrived - Found booking ${bookingId}. Current status: ${booking.status}. Updating to 'driver_arrived'.`);
    await redis.hset(`booking:${bookingId}`, { status: 'driver_arrived' }); // Changed 'kv' to 'redis'
    console.log(`API: driver-arrived - Booking ${bookingId} status updated to driver_arrived by ${driverId}.`);

    if (booking.riderId) {
        pusher.trigger(`rider-${booking.riderId}`, 'driver-arrived', { bookingId, driverId, status: 'arrived' });
        console.log(`API: driver-arrived - Pusher event 'driver-arrived' triggered for rider ${booking.riderId}.`);
    } else {
        console.log(`API: driver-arrived - No riderId found for booking ${bookingId}, skipping rider Pusher event.`);
    }
    
    res.status(200).json({ message: 'Arrival acknowledged', bookingId });

  } catch (error) {
    console.error('API: driver-arrived - FATAL ERROR during processing:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
