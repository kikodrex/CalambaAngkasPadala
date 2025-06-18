// api/driver-status.js

import { Redis } from '@upstash/redis'; // Updated import

const redis = new Redis({ // Changed 'kv' to 'redis'
  url: process.env.UPSTASH_REDIS_REST_URL, // Updated ENV VAR NAME
  token: process.env.UPSTASH_REDIS_REST_TOKEN, // Updated ENV VAR NAME
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { driverId, status, location } = req.body;

    if (!driverId || !status) {
        return res.status(400).json({ message: 'Missing driverId or status' });
    }

    try {
        if (status === 'online' && location) {
            // Store driver's live location and status
            await redis.hset(`driver:${driverId}`, { status: 'online', lat: location.lat, lon: location.lon, last_update: Date.now() }); // Changed 'kv' to 'redis'
            // Optionally, you might trigger a Pusher event here to broadcast driver locations
            // pusher.trigger('driver-locations', 'location-update', { driverId, location });
            console.log(`API: driver-status - Driver ${driverId} online at [${location.lat}, ${location.lon}]`);
        } else if (status === 'offline') {
            // Mark driver offline
            await redis.hset(`driver:${driverId}`, { status: 'offline', last_update: Date.now() }); // Changed 'kv' to 'redis'
            console.log(`API: driver-status - Driver ${driverId} is offline.`);
        } else {
            return res.status(400).json({ message: 'Invalid status or missing location for online status.' });
        }

        res.status(200).json({ message: 'Driver status updated' });
    } catch (error) {
        console.error('API: driver-status - Error updating driver status:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
