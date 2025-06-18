import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Automatic registration function
async function autoRegisterRider(riderId) {
  const defaultRiderProfile = {
    id: riderId,
    status: 'pending_verification',
    registeredAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  try {
    // 1. Check if this is a retry attempt
    const existing = await redis.get(`rider:${riderId}`);
    if (existing) return existing;

    // 2. Register in admin system (mock implementation)
    const adminResponse = await mockAdminRegistration(riderId);
    
    // 3. Save to Redis with TTL (7 days expiration)
    const riderData = { 
      ...defaultRiderProfile,
      ...adminResponse,
      status: adminResponse?.verified ? 'active' : 'pending_verification'
    };
    
    await redis.setex(`rider:${riderId}`, 60 * 60 * 24 * 7, riderData);
    await redis.sadd('registered_riders', riderId);
    
    return riderData;
  } catch (error) {
    console.error(`Auto-registration failed for ${riderId}:`, error);
    // Fallback: Save basic profile even if admin registration fails
    await redis.setex(`rider:${riderId}`, 60 * 60 * 24, defaultRiderProfile);
    return defaultRiderProfile;
  }
}

// Mock admin registration (replace with real API call)
async function mockAdminRegistration(riderId) {
  const mockDelay = () => new Promise(resolve => setTimeout(resolve, 500));
  
  await mockDelay();
  
  return {
    verified: Math.random() > 0.3, // 70% success rate for demo
    adminNotes: `Automatically registered at ${new Date().toISOString()}`,
    tier: 'standard'
  };
}

export default async function handler(req, res) {
  // 1. Validate request
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'method_not_allowed',
      message: 'Only POST requests are accepted'
    });
  }

  const { riderId, bookingDetails } = req.body;
  if (!riderId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'Missing riderId in request body'
    });
  }

  try {
    // 2. Check or create rider
    let riderData = await redis.get(`rider:${riderId}`);
    let isNewRegistration = false;

    if (!riderData) {
      riderData = await autoRegisterRider(riderId);
      isNewRegistration = true;
      console.log(`Auto-registered rider ${riderId}`);
    }

    // 3. Validate rider status
    if (riderData.status !== 'active') {
      return res.status(403).json({
        error: 'rider_not_active',
        message: 'Rider account requires verification',
        verificationUrl: `${process.env.ADMIN_PORTAL}/verify/${riderId}`,
        isNewRegistration,
        riderStatus: riderData.status
      });
    }

    // 4. Process booking
    const bookingId = `booking:${Date.now()}:${riderId}`;
    await redis.setex(bookingId, 60 * 60 * 24, {
      riderId,
      ...bookingDetails,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    });

    // 5. Update rider's booking history
    await redis.lpush(`rider:${riderId}:bookings`, bookingId);

    return res.status(200).json({
      success: true,
      bookingId,
      riderId,
      isNewRegistration,
      status: 'confirmed'
    });

  } catch (error) {
    console.error(`Booking error for ${riderId}:`, error);
    return res.status(500).json({
      error: 'processing_error',
      message: 'Could not complete booking',
      retryable: true,
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
}
