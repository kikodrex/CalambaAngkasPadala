// api/request-booking.js

import Pusher from 'pusher';
// Import the Upstash Redis client instead of @vercel/kv
import { Redis } from '@upstash/redis'; // <-- CHANGED

// Configure Pusher (must be set as Vercel Environment Variables!)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Configure Upstash Redis client (use Upstash-specific ENV variables)
// These are typically UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({ // <-- CHANGED from kv to redis
  url: process.env.UPSTASH_REDIS_REST_URL, // <-- CHANGED ENV VAR NAME
  token: process.env.UPSTASH_REDIS_REST_TOKEN, // <-- CHANGED ENV VAR NAME
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const bookingData = req.body;
  const bookingId = bookingData.bookingId; 

  console.log('API: request-booking - Received request for bookingId:', bookingId);
  console.log('API: request-booking - Received bookingData:', JSON.stringify(bookingData));

  if (!bookingId || !bookingData.pickup || !bookingData.destination) {
    console.error("API: request-booking - Missing essential booking data:", bookingData);
    return res.status(400).json({ message: 'Missing bookingId, pickup, or destination in request.' });
  }

  try {
    const newBookingRecord = {
      ...bookingData,
      status: 'pending',
      createdAt: Date.now(),
    };

    console.log(`API: request-booking - Attempting to save booking:${bookingId} to Upstash Redis. Data:`, JSON.stringify(newBookingRecord));
    // Use redis.hset for Upstash Redis. It works similarly to kv.hset
    await redis.hset(`booking:${bookingId}`, newBookingRecord); // <-- CHANGED from kv.hset to redis.hset
    console.log(`API: request-booking - Booking ${bookingId} SUCCESSFULLY SAVED to Upstash Redis.`);

    pusher.trigger('booking-channel', 'new-ride-request', newBookingRecord);
    console.log(`API: request-booking - Pusher event 'new-ride-request' triggered for booking ${bookingId}.`);

    res.status(200).json({
      message: 'Ride request received and broadcasted.',
      bookingId: bookingId,
      status: 'pending'
    });

  } catch (error) {
    console.error('API: request-booking - ERROR during processing:', error);
    // Important: check error.message for more details, especially connection errors
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
