// api/end-ride.js

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
    console.log(`API: end-ride - Driver ${driverId} attempting to end booking ${bookingId}.`);
    const booking = await redis.hgetall(`booking:${bookingId}`); // Changed 'kv' to 'redis'

    if (!booking || Object.keys(booking).length === 0) {
        console.error(`API: end-ride - Booking ${bookingId} not found or empty in Upstash Redis.`);
        return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.driverId !== driverId) {
        console.warn(`API: end-ride - Unauthorized driver ${driverId} for booking ${bookingId}. Expected ${booking.driverId}`);
        return res.status(403).json({ message: 'Unauthorized: Driver not assigned to this booking' });
    }
    if (booking.status !== 'in_progress') {
        console.warn(`API: end-ride - Booking ${bookingId} status is ${booking.status}, expected 'in_progress'.`);
        return res.status(400).json({ message: `Booking status is ${booking.status}, expected 'in_progress'` });
    }

    console.log(`API: end-ride - Found booking ${bookingId}. Current status: ${booking.status}. Updating to 'completed' and deleting.`);
    await redis.hset(`booking:${bookingId}`, { status: 'completed' }); // Changed 'kv' to 'redis'
    await redis.del(`booking:${bookingId}`); // Changed 'kv' to 'redis' - Delete booking after completion
    console.log(`API: end-ride - Booking ${bookingId} status updated to completed and removed from Upstash Redis.`);

    if (booking.riderId) {
        // You might want to calculate final fare here if not done before
        pusher.trigger(`rider-${booking.riderId}`, 'ride-completed', { bookingId, driverId, status: 'completed', finalFare: booking.fare });
        console.log(`API: end-ride - Pusher event 'ride-completed' triggered for rider ${booking.riderId}.`);
    }
    
    res.status(200).json({ message: 'Ride completed', bookingId });

  } catch (error) {
    console.error('API: end-ride - ERROR during processing:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
