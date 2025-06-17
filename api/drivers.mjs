// In file: /api/drivers.mjs
import { Redis } from '@upstash/redis';

// Initialize the Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(request, response) {
  try {
    const driverIds = await redis.smembers('available_drivers');
    const drivers = [];
    for (const id of driverIds) {
      const driverData = await redis.hgetall(id);
      if (driverData) drivers.push(driverData);
    }
    response.status(200).json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    response.status(500).json({ error: 'Failed to fetch drivers.' });
  }
}
