// api/request-booking.js

// Import Pusher for server-side use
import Pusher from 'pusher';
// Import Vercel KV client
import { createClient } from '@vercel/kv';

// Configure Pusher (these must be set as Vercel Environment Variables!)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Configure Vercel KV client (these must be set as Vercel Environment Variables!)
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// This is your serverless function handler for the /api/request-booking endpoint
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get the booking data sent from the passenger frontend
  const bookingData = req.body;
  
  // Ensure we have a bookingId and essential data
  // The frontend typically generates a unique bookingId like `booking_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  if (!bookingData.bookingId || !bookingData.pickup || !bookingData.destination) {
    console.error("Missing essential booking data:", bookingData);
    return res.status(400).json({ message: 'Missing bookingId, pickup, or destination in request.' });
  }

  const bookingId = bookingData.bookingId;

  try {
    // --- Core Logic: Save the new booking to Vercel KV ---
    // You should initialize the status, e.g., 'pending'
    const newBookingRecord = {
      ...bookingData, // Copy all data from the frontend
      status: 'pending', // Set initial status to pending
      createdAt: Date.now(),
      // Add other fields you might need, like riderId if you store it separately
    };

    // Use hset to store booking details as a hash/object under a key like 'booking:BOOKING_ID'
    await kv.hset(`booking:${bookingId}`, newBookingRecord);
    console.log(`New booking ${bookingId} saved to Vercel KV:`, newBookingRecord);

    // --- Notify Drivers via Pusher ---
    // Trigger the 'new-ride-request' event on the 'booking-channel'
    // The driver.html listens to this channel.
    pusher.trigger('booking-channel', 'new-ride-request', newBookingRecord);
    console.log(`Pusher event 'new-ride-request' triggered for booking ${bookingId}.`);

    // --- Send success response back to the passenger frontend ---
    res.status(200).json({
      message: 'Ride request received and broadcasted.',
      bookingId: bookingId,
      status: 'pending'
    });

  } catch (error) {
    console.error('Error in /api/request-booking:', error);
    // Return a 500 status for internal server errors
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
