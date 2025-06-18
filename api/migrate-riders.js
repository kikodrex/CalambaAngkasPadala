import { createClient } from 'redis';

const legacyClient = createClient({
  url: 'redis://legacy-db:6379'
});

const upstashClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function migrateRiders() {
  await legacyClient.connect();

  // 1. Migrate rider profiles
  const legacyRiders = await legacyClient.keys('rider_*');
  
  for (const legacyKey of legacyRiders) {
    const riderId = legacyKey.replace('rider_', '');
    const riderData = await legacyClient.get(legacyKey);
    
    await upstashClient.set(`rider:${riderId}`, {
      ...JSON.parse(riderData),
      migratedAt: new Date().toISOString()
    });

    await upstashClient.sadd('registered_riders', riderId);
  }

  // 2. Migrate bookings (last 30 days)
  const recentBookings = await legacyClient.keys('booking_*');
  
  for (const bookingKey of recentBookings) {
    const bookingData = await legacyClient.get(bookingKey);
    const newKey = bookingKey.replace('_', ':'); // booking_123 → booking:123
    
    await upstashClient.setex(newKey, 
      60 * 60 * 24 * 30, // 30-day TTL
      JSON.parse(bookingData)
    );
  }

  console.log(`Migration complete: ${legacyRiders.length} riders migrated`);
  await legacyClient.quit();
}

migrateRiders().catch(console.error);
