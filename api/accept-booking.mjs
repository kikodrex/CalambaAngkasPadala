// accept-booking.mjs
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    // 1. Validate request method
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are accepted',
      });
    }

    // 2. Parse and validate request body
    const { riderId, bookingDetails } = req.body;
    
    if (!riderId) {
      return res.status(400).json({
        error: 'MISSING_RIDER_ID',
        message: 'riderId is required in the request body',
      });
    }

    // 3. Check rider existence
    const riderKey = `rider:${riderId}`;
    const riderExists = await redis.exists(riderKey);
    
    if (!riderExists) {
      console.warn(`Booking rejected: Rider ${riderId} not registered`);
      return res.status(400).json({
        error: 'RIDER_NOT_REGISTERED',
        message: 'Please complete registration before booking',
        riderId: riderId,
      });
    }

    // 4. Get rider details for validation
    const riderData = await redis.get(riderKey);
    
    // Optional: Check rider status (e.g., suspended riders)
    if (riderData?.status !== 'active') {
      console.warn(`Booking rejected: Rider ${riderId} status is ${riderData?.status || 'inactive'}`);
      return res.status(403).json({
        error: 'RIDER_NOT_ACTIVE',
        message: 'Your account is not eligible for bookings',
      });
    }

    // 5. Process booking
    const bookingId = `booking:${Date.now()}`;
    await redis.set(bookingId, {
      riderId,
      ...bookingDetails,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
    });

    // 6. Update rider's bookings list
    await redis.lpush(`rider:${riderId}:bookings`, bookingId);

    console.log(`Booking created: ${bookingId} for rider ${riderId}`);
    return res.status(200).json({
      success: true,
      bookingId,
      riderId,
      status: 'confirmed',
    });

  } catch (error) {
    console.error('Booking processing failed:', error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to process booking',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
