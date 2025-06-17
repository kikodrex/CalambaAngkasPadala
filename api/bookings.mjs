// In file: /api/bookings.mjs

import { kv } from '@vercel/kv';
import Pusher from 'pusher';

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

  const bookingDetails = request.body;

  try {
    // 1. Find the nearest available driver (This is a simplified simulation)
    const availableDrivers = await kv.smembers('available_drivers');
    if (availableDrivers.length === 0) {
      return response.status(400).json({ message: "No drivers available." });
    }
    // For this example, we just pick the first available driver.
    const driverId = availableDrivers[0];

    // 2. Get the driver's details (including location, etc.)
    const driver = await kv.hgetall(driverId);

    // 3. Create a unique booking ID
    const bookingId = `bk_${Date.now()}`;

    // 4. Send the ride request to the specific driver's channel
    const driverChannel = `driver-${driverId}`;
    await pusher.trigger(driverChannel, 'new-ride-request', {
      bookingId: bookingId,
      pickup: bookingDetails.pickup,
      destination: bookingDetails.destination
    });

    console.log(`Sent ride request to driver ${driverId} on channel ${driverChannel}`);

    // 5. Respond to the rider
    response.status(201).json({
      message: 'Booking request sent to driver. Waiting for confirmation...',
      bookingId: bookingId
    });

  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Booking failed.' });
  }
}
