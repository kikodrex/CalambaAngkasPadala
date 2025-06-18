// api/end-ride.js

// Import Pusher for server-side use
import Pusher from 'pusher';
// Import Vercel KV client
import { createClient } from '@vercel/kv';

// Configure Pusher (these must be set as Vercel Environment Variables!)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSher_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

// Configure Vercel KV client (these must be set as Vercel Environment Variables!)
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// This is your serverless function handler for the /api/end-ride endpoint
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { bookingId, driverId } = req.body;

  if (!bookingId || !driverId) {
    return res.status(400).json({ message: 'Missing bookingId or driverId' });
  }

  try {
    // --- Backend Logic to End Ride ---
    // 1. Fetch the booking from your Vercel KV database
    const booking = await kv.hgetall(`booking:${bookingId}`);

    if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
    }
    // Validate that the driverId matches the one assigned to the booking
    if (booking.driverId !== driverId) {
        return res.status(403).json({ message: 'Unauthorized: Driver not assigned to this booking' });
    }
    // Validate the current status of the booking (should be 'in_progress')
    if (booking.status !== 'in_progress') {
        return res.status(400).json({ message: `Booking status is ${booking.status}, expected 'in_progress'` });
    }

    // 2. Update the booking status in your database to 'completed'
    await kv.hset(`booking:${bookingId}`, { status: 'completed' });
    console.log(`Booking ${bookingId} status updated to completed by ${driverId}`);

    // --- Optional: Clean up or perform final actions ---
    // In a real app:
    // - Calculate final fare if not done yet
    // - Process payment
    // - You might want to delete the booking from active storage if it's truly done
    await kv.del(`booking:${bookingId}`); // Remove booking from KV after completion
    console.log(`Booking ${bookingId} removed from KV.`);

    // 3. (Optional but recommended) Trigger a Pusher event to notify the Rider
    // This assumes the Rider frontend subscribes to a channel like `rider-${booking.riderId}`
    if (booking.riderId) { // Ensure riderId exists in your stored booking data
        // Include final fare if you calculate it
        pusher.trigger(`rider-${booking.riderId}`, 'ride-completed', { bookingId, driverId, status: 'completed', finalFare: booking.fare });
    }
    // You could also trigger a public event on 'booking-channel' if you need other services/drivers to know

    // 4. Send a success response back to the frontend
    res.status(200).json({ message: 'Ride completed', bookingId });

  } catch (error) {
    console.error('Error in /api/end-ride:', error);
    // Return a 500 status for internal server errors
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
