// api/request-booking.js

import Pusher from 'pusher';
import { Redis } from '@upstash/redis';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const bookingData = req.body;
  const bookingId = bookingData.bookingId; 
  const riderId = bookingData.riderId; // Get riderId from incoming data

  console.log('API: request-booking - Received request for bookingId:', bookingId);
  console.log('API: request-booking - Received bookingData:', JSON.stringify(bookingData));

  if (!bookingId || !bookingData.pickup || !bookingData.destination || !riderId) {
    console.error("API: request-booking - Missing essential booking data (bookingId, pickup, destination, or riderId):", bookingData);
    return res.status(400).json({ message: 'Missing bookingId, pickup, destination, or riderId in request.' });
  }

  try {
    // --- NEW VALIDATION: Check if riderId is registered ---
    const isRiderRegistered = await redis.sismember('all_rider_ids', riderId); // Check if riderId exists in the set
    
    if (!isRiderRegistered) {
        console.warn(`API: request-booking - Booking rejected: Rider ID ${riderId} is not registered.`);
        return res.status(400).json({ message: `Rider ID ${riderId} is not a registered user. Please register riders via admin panel.` });
    }
    // --- END NEW VALIDATION ---


    const newBookingRecord = {
      ...bookingData,
      status: 'pending',
      createdAt: Date.now(),
    };

    console.log(`API: request-booking - Attempting to save booking:${bookingId} to Upstash Redis. Data:`, JSON.stringify(newBookingRecord));
    await redis.hset(`booking:${bookingId}`, newBookingRecord);
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
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
