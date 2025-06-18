// api/riders.js

import { Redis } from '@upstash/redis'; // Import Upstash Redis client

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // --- Add a new rider ---
    const { riderId, name, phone } = req.body;

    if (!riderId || !name || !phone) {
      return res.status(400).json({ message: 'Missing riderId, name, or phone' });
    }

    try {
      // Store rider details as a hash (object)
      await redis.hset(`rider:${riderId}`, { riderId, name, phone });
      // Add riderId to a set for easy retrieval of all rider IDs
      await redis.sadd('all_rider_ids', riderId); // Use a set to store all rider IDs

      console.log(`API: riders - Rider ${riderId} (${name}) added.`);
      return res.status(200).json({ message: 'Rider added successfully', riderId });

    } catch (error) {
      console.error('API: riders - Error adding rider:', error);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }

  } else if (req.method === 'GET') {
    // --- Get all registered riders ---
    try {
      // Get all rider IDs from the set
      const riderIds = await redis.smembers('all_rider_ids'); // Get all members from the set

      if (riderIds.length === 0) {
        return res.status(200).json([]); // No riders found
      }

      // Fetch details for each rider ID
      const pipeline = redis.pipeline(); // Use pipeline for efficiency
      riderIds.forEach(id => {
        pipeline.hgetall(`rider:${id}`);
      });
      const ridersData = await pipeline.exec();

      // Filter out any null results if a rider ID was in the set but data was missing
      const registeredRiders = ridersData.filter(r => r !== null && Object.keys(r).length > 0);

      console.log(`API: riders - Fetched ${registeredRiders.length} registered riders.`);
      return res.status(200).json(registeredRiders);

    } catch (error) {
      console.error('API: riders - Error fetching riders:', error);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }

  } else {
    // --- Method Not Allowed ---
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
