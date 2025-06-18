import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up
    { duration: '1m', target: 200 },  // Peak load
    { duration: '20s', target: 0 },   // Cool-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],   // <1% errors
    http_req_duration: ['p(95)<500'], // 95% under 500ms
  },
};

export default function () {
  // 70% known riders, 30% new riders
  const riderId = __ITER % 10 < 7 ? 
    `rider_known_${__ITER % 100}` : 
    `rider_new_${Date.now()}_${__ITER}`;

  const payload = JSON.stringify({
    riderId,
    bookingDetails: {
      pickup: `Location_${__ITER % 10}`,
      destination: `Location_${__ITER % 20}`
    }
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(
    'https://api.example.com/accept-booking', 
    payload, 
    params
  );

  check(res, {
    'is status 200': (r) => r.status === 200,
    'verified rider': (r) => JSON.parse(r.body).success === true,
  });

  sleep(0.5); // Simulate user think time
}
