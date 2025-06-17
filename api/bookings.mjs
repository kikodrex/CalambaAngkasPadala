// api/bookings.js

export default function handler(request, response) {
    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight CORS requests
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // We only want to handle POST requests for this endpoint
    if (request.method === 'POST') {
        const bookingDetails = request.body;

        console.log('=== New Booking Request Received ===');
        console.log(bookingDetails);
        console.log('====================================');

        // Send a success response back to the frontend
        return response.status(201).json({
            message: 'Booking request received! Searching for a driver...',
            bookingId: `bk_${Date.now()}`
        });
    }

    // If the method is not POST, return an error
    response.setHeader('Allow', ['POST']);
    response.status(405).end(`Method ${request.method} Not Allowed`);
}
