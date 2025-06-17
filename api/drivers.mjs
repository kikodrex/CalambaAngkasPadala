// api/drivers.js

// The in-memory 'database'. IMPORTANT: In a real serverless app,
// this data MUST be stored in a real database (like Vercel KV or a DB service)
// because serverless functions are STATELESS.
const availableDrivers = [
    { id: 'driver001', lat: 14.5547, lon: 121.0244 }, // Makati
    { id: 'driver002', lat: 14.6760, lon: 121.0437 }, // Quezon City
    { id: 'driver003', lat: 10.3157, lon: 123.8854 }, // Cebu City
    { id: 'driver004', lat: 7.0645,  lon: 125.6083 }  // Davao City
];

// This is the serverless function handler
export default function handler(request, response) {
    // Set CORS headers to allow requests from any origin
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight CORS requests
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    // Send the driver data as a JSON response
    response.status(200).json(availableDrivers);
}
