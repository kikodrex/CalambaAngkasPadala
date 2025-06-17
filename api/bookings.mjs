// In file: /api/bookings.mjs
import { Redis } from '@upstash/redis';
import Pusher from 'pusher';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

  try {
    const bookingDetails = request.body;
    const availableDrivers = await redis.smembers('available_drivers');

    if (availableDrivers.length === 0) {
      return response.status(400).json({ message: "We're sorry, no drivers are available right now." });
    }

    const driverId = availableDrivers[0];
    const bookingId = `bk_${Date.now()}`;
    
    // In our simplified app, we'll notify all drivers on a general channel
    const channelName = 'booking-channel';
    const eventName = 'new-ride-request';
    
    await pusher.trigger(channelName, eventName, {
        bookingId: bookingId,
        ...bookingDetails
    });

    response.status(201).json({
      message: 'Booking request sent! Searching for a driver...',
      bookingId: bookingId
    });

  } catch (error) {
    console.error("CRITICAL ERROR in /api/bookings:", error);
    response.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}
