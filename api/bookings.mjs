// In file: /api/bookings.mjs

import { kv } from '@vercel/kv';
import Pusher from 'pusher';

export default async function handler(request, response) {
    console.log("--- /api/bookings function started ---");

    if (request.method !== 'POST') {
        return response.status(405).end();
    }
    
    // DEBUG: Log the environment variables to see what the server is using.
    console.log("Attempting to use Pusher App ID:", process.env.PUSHER_APP_ID);
    console.log("Attempting to use Pusher Key:", process.env.PUSHER_KEY);
    console.log("Attempting to use Pusher Cluster:", process.env.PUSHER_CLUSTER);
    // We never log the secret for security reasons.

    try {
        // Initialize Pusher using the secure environment variables from Vercel
        const pusher = new Pusher({
            appId: process.env.PUSHER_APP_ID,
            key: process.env.PUSHER_KEY,
            secret: process.env.PUSHER_SECRET,
            cluster: process.env.PUSHER_CLUSTER,
            useTLS: true
        });
        console.log("Pusher SDK initialized successfully.");

        const bookingDetails = request.body;

        // Find the nearest available driver (simplified: gets the first one)
        const availableDrivers = await kv.smembers('available_drivers');
        console.log("Available drivers found in DB:", availableDrivers);

        if (!availableDrivers || availableDrivers.length === 0) {
            return response.status(400).json({ message: "We're sorry, no drivers are available right now." });
        }
        
        const driverId = availableDrivers[0];
        const bookingId = `bk_${Date.now()}`;
        const driverChannel = `private-driver-${driverId}`; // In a real app, you'd target a specific driver

        // For our enhanced driver panel, we need to send the booking to a specific channel.
        // But for simplicity to close the loop, we will use the general booking channel.
        const channelName = 'booking-channel';
        const eventName = 'new-ride-request';

        console.log(`Triggering Pusher event '${eventName}' on channel '${channelName}'`);
        await pusher.trigger(channelName, eventName, {
            bookingId: bookingId,
            ...bookingDetails
        });
        console.log("Pusher event triggered successfully.");

        response.status(201).json({
            message: 'Booking request sent! Searching for a driver...',
            bookingId: bookingId
        });

    } catch (error) {
        console.error("CRITICAL ERROR in /api/bookings:", error);
        // This will send a detailed error back if Pusher fails to initialize
        response.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}
