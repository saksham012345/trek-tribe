import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 20,
  duration: '20s',
};

export default function () {
  const url = `${__ENV.BACKEND_URL || 'http://localhost:4000'}/api/webhooks/razorpay`;
  const payload = JSON.stringify({ event: 'payment.captured', payload: { /* small sample */ } });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.2);
}
