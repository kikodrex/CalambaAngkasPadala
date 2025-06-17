// In file: /api/driver-status.mjs
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).end();
  }

  try {
    const { driverId, status, location } = request.body;
    if (status === 'online') {
      await redis.sadd('available_drivers', driverId);
      await redis.hset(driverId, { id: driverId, ...location });
    } else { // offline
      await redis.srem('available_drivers', driverId);
    }
    response.status(200).json({ success: true, status: `Driver ${driverId} is now ${status}` });
  } catch (error) {
    console.error("Error updating driver status:", error);
    response.status(500).json({ error: 'Failed to update driver status.' });
  }
}
