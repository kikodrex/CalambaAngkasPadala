import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Admin panel registration function
async function registerRiderThroughAdmin(riderId) {
  try {
    // Implement your admin registration API call here
    const adminResponse = await fetch(process.env.ADMIN_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({ riderId })
    });
    
    if (!adminResponse.ok) throw new Error('Admin registration failed');
    
    return await adminResponse.json();
  } catch (error) {
    console.error('Admin registration error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are accepted'
      });
    }

    const { riderId, bookingDetails } = req.body;
    
    if (!riderId) {
      return res.status(400).json({
        error: 'MISSING_RIDER_ID',
        message: 'riderId is required'
      });
    }

    const riderKey = `rider:${riderId}`;
    let riderData = await redis.get(riderKey);

    // If rider doesn't exist, attempt admin registration
    if (!riderData) {
      try {
        console.log(`Attempting admin registration for rider ${riderId}`);
        const newRider = await registerRiderThroughAdmin(riderId);
        
        // Store the newly registered rider
        riderData = {
          id: riderId,
          status: 'active',
          ...newRider
        };
        await redis.set(riderKey, riderData);
        
        console.log(`Successfully registered rider ${riderId} via admin`);
      } catch (adminError) {
        return res.status(403).json({
          error: 'RIDER_REGISTRATION_REQUIRED',
          message: 'Rider not registered. Please register via admin panel.',
          riderId,
          adminPortal: process.env.ADMIN_PORTAL_URL
        });
      }
    }

    // Proceed with booking
    const bookingId = `booking:${Date.now()}`;
    await redis.set(bookingId, {
      riderId,
      ...bookingDetails,
      createdAt: new Date().toISOString(),
      status: 'confirmed'
    });

    await redis.lpush(`rider:${riderId}:bookings`, bookingId);

    return res.status(200).json({
      success: true,
      bookingId,
      riderId,
      status: 'confirmed',
      newRegistration: !riderData // Flag if this was a new registration
    });

  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({
      error: 'BOOKING_FAILED',
      message: 'Failed to process booking',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message
      })
    });
  }
}
