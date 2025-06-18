// api/request-booking.js

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

  const bookingData = req.body;
  const bookingId = bookingData.bookingId; 

  console.log('API: request-booking - Received request for bookingId:', bookingId); // Add this log
  console.log('API: request-booking - Received bookingData:', JSON.stringify(bookingData)); // Add this log

  if (!bookingId || !bookingData.pickup || !bookingData.destination) {
    console.error("API: request-booking - Missing essential booking data:", bookingData); // Update this log
    return res.status(400).json({ message: 'Missing bookingId, pickup, or destination in request.' });
  }

  try {
    const newBookingRecord = {
      ...bookingData,
      status: 'pending',
      createdAt: Date.now(),
    };

    console.log(`API: request-booking - Attempting to save booking:${bookingId} to KV. Data:`, JSON.stringify(newBookingRecord)); // Add this log
    await kv.hset(`booking:${bookingId}`, newBookingRecord);
    console.log(`API: request-booking - Booking ${bookingId} SUCCESSFULLY SAVED to Vercel KV.`); // Add this log

    pusher.trigger('booking-channel', 'new-ride-request', newBookingRecord);
    console.log(`API: request-booking - Pusher event 'new-ride-request' triggered for booking ${bookingId}.`);

    res.status(200).json({
      message: 'Ride request received and broadcasted.',
      bookingId: bookingId,
      status: 'pending'
    });

  } catch (error) {
    console.error('API: request-booking - ERROR during processing:', error); // Update this log
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
