import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const url = `${__ENV.BACKEND_URL || 'http://localhost:4000'}/support/tickets`;
  const payload = JSON.stringify({
    title: 'Load test ticket',
    message: 'This is a sample ticket created by k6',
    email: 'loadtest@example.com'
  });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  check(res, { 'status is 200 or 201': (r) => r.status === 200 || r.status === 201 });
  sleep(1);
}
