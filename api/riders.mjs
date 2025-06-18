// riders.mjs
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limiter for admin actions
const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1m'),
  prefix: 'rate-limit:admin'
});

export default async function handler(req, res) {
  try {
    // 1. Authenticate admin (example using JWT)
    const authToken = req.headers.authorization?.split(' ')[1];
    if (!verifyAdminToken(authToken)) {
      return res.status(401).json({ 
        error: 'unauthorized',
        message: 'Invalid admin credentials' 
      });
    }

    // 2. Apply rate limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { success } = await adminLimiter.limit(ip);
    if (!success) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Too many requests'
      });
    }

    // 3. Handle GET requests (fetch riders)
    if (req.method === 'GET') {
      const { riderId } = req.query;
      
      if (riderId) {
        // Single rider lookup
        const rider = await redis.get(`rider:${riderId}`);
        if (!rider) {
          return res.status(404).json({
            error: 'rider_not_found',
            message: `Rider ${riderId} not registered`,
            action: {
              type: 'registration',
              endpoint: '/api/riders',
              method: 'POST'
            }
          });
        }
        return res.json(rider);
      }

      // Bulk rider fetch
      const riderIds = await redis.smembers('registered_riders');
      const pipeline = redis.pipeline();
      riderIds.forEach(id => pipeline.get(`rider:${id}`));
      const results = await pipeline.exec();
      
      const riders = results.map(([err, data]) => {
        if (err) throw err;
        return data;
      }).filter(Boolean);

      return res.json(riders);
    }

    // 4. Handle POST requests (create/update riders)
    if (req.method === 'POST') {
      const { riderId, name, phone, action } = req.body;

      if (action === 'verify') {
        // Admin verification endpoint
        return handleVerification(req, res);
      }

      // Auto-registration flow
      if (!riderId || !name) {
        return res.status(400).json({
          error: 'invalid_input',
          message: 'Missing riderId or name'
        });
      }

      const riderKey = `rider:${riderId}`;
      const riderData = {
        riderId,
        name,
        phone: phone || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Check for existing rider
      const exists = await redis.exists(riderKey);
      if (exists) {
        return res.status(409).json({
          error: 'rider_exists',
          message: `Rider ${riderId} already registered`
        });
      }

      // Save to Redis
      await redis.set(riderKey, riderData);
      await redis.sadd('registered_riders', riderId);

      // Notify admin channel (optional)
      await redis.publish('admin:notifications', JSON.stringify({
        type: 'new_rider',
        riderId,
        name
      }));

      return res.status(201).json({
        success: true,
        riderId,
        requiresVerification: true,
        verificationUrl: `${process.env.ADMIN_PORTAL}/verify/${riderId}`
      });
    }

    // 5. Handle unsupported methods
    return res.status(405).json({
      error: 'method_not_allowed',
      message: 'Only GET and POST methods are supported'
    });

  } catch (error) {
    console.error('Riders API error:', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    });
  }
}

// Helper function for verification workflow
async function handleVerification(req, res) {
  const { riderId, status } = req.body;
  
  if (!['verified', 'suspended'].includes(status)) {
    return res.status(400).json({
      error: 'invalid_status',
      message: 'Status must be "verified" or "suspended"'
    });
  }

  const riderKey = `rider:${riderId}`;
  const rider = await redis.get(riderKey);
  
  if (!rider) {
    return res.status(404).json({
      error: 'rider_not_found',
      message: `Rider ${riderId} not found`
    });
  }

  // Update rider status
  const updatedRider = {
    ...rider,
    status,
    updatedAt: new Date().toISOString(),
    [status === 'verified' ? 'verifiedAt' : 'suspendedAt']: new Date().toISOString()
  };

  await redis.set(riderKey, updatedRider);
  
  return res.json({
    success: true,
    riderId,
    newStatus: status
  });
}

// Mock auth verification (replace with your actual auth logic)
function verifyAdminToken(token) {
  // In production, use JWT verification
  return process.env.NODE_ENV === 'development' || 
         token === process.env.ADMIN_SECRET;
}
