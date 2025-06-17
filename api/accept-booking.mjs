// In file: /api/accept-booking.mjs

import Pusher from 'pusher';
import { kv } from '@vercel/kv';

// Initialize Pusher using the secure environment variables from Vercel
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).end();
  }

  const { bookingId, driverId } = request.body;

  // 1. Get the driver's details from the database
  const driverData = await kv.hgetall(driverId);

  // 2. In a real app, you would associate the driver with the booking in your database.
  // For now, we'll just log it.
  console.log(`Driver ${driverId} accepted booking ${bookingId}`);

  // 3. Trigger the 'driver-assigned' event to notify the RIDER
  // This tells the rider's app that their booking was successful.
  await pusher.trigger(
    'booking-channel',   // The public channel the rider is listening on
    'driver-assigned',   // The event the rider's app is waiting for
    {
      ...driverData,
      eta: "5 mins" // You would calculate this in a real app
    }
  );

  response.status(200).json({ success: true, message: "Booking accepted." });
}
