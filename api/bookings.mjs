// In file: /api/bookings.mjs

import Pusher from 'pusher';

// Initialize Pusher using the secure environment variables
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  if (request.method === 'POST') {
    const bookingDetails = request.body;
    console.log('New Booking Request Received:', bookingDetails);

    // --- PUSHER INTEGRATION ---
    // In a real app, you would create a unique channel for each booking.
    // For this tutorial, we will use a single, hardcoded channel name.
    const channelName = 'booking-channel';
    const eventName = 'driver-assigned';
    
    // This is the data we will push to the rider's browser.
    const driverData = {
      name: "Juan Dela Cruz",
      vehicle: "Yamaha NMAX - Red",
      eta: "5 mins",
      lat: bookingDetails.pickup.lat + 0.005, // Simulate driver nearby
      lon: bookingDetails.pickup.lon + 0.005
    };
    
    // Simulate a delay as if we are finding a driver
    setTimeout(async () => {
      try {
        console.log(`Triggering Pusher event '${eventName}' on channel '${channelName}'`);
        await pusher.trigger(channelName, eventName, driverData);
        console.log("Pusher event triggered successfully.");
      } catch (error) {
        console.error("Pusher trigger error:", error);
      }
    }, 5000); // 5-second delay

    // Immediately confirm to the user that we are searching.
    return response.status(201).json({
        message: 'Booking request received! Searching for a driver...',
        bookingId: `bk_${Date.now()}`
    });
  }

  response.status(405).end(`Method ${request.method} Not Allowed`);
}
