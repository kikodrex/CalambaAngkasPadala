import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Auth check
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { riderId, action } = req.body;
  
  if (!['verify', 'suspend'].includes(action)) {
    return res.status(400).json({ error: 'invalid_action' });
  }

  try {
    const riderKey = `rider:${riderId}`;
    const riderData = await redis.get(riderKey);

    if (!riderData) {
      return res.status(404).json({ error: 'rider_not_found' });
    }

    // Update status
    const updatedData = {
      ...riderData,
      status: action === 'verify' ? 'active' : 'suspended',
      [action === 'verify' ? 'verifiedAt' : 'suspendedAt']: new Date().toISOString()
    };

    await redis.set(riderKey, updatedData);

    // Sync to registered_riders set
    if (action === 'verify') {
      await redis.sadd('registered_riders', riderId);
    } else {
      await redis.srem('registered_riders', riderId);
    }

    return res.json({
      success: true,
      riderId,
      newStatus: updatedData.status,
      [action === 'verify' ? 'verified' : 'suspended']: true
    });

  } catch (error) {
    console.error(`Admin verification failed:`, error);
    return res.status(500).json({ 
      error: 'processing_error',
      retryable: true 
    });
  }
}
