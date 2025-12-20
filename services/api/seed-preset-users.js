const axios = require('axios');

const API_URL = process.env.TEST_API_URL || 'https://trek-tribe-38in.onrender.com';
const SEED_TOKEN = process.env.TEST_SEED_TOKEN;

if (!SEED_TOKEN) {
  console.error('TEST_SEED_TOKEN not set. Please set it to the same value as SEED_TOKEN in Render.');
  process.exit(1);
}

(async () => {
  try {
    console.log('Seeding preset users on API...');
    const resp = await axios.post(`${API_URL}/api/internal/seed/preset-users`, {}, { headers: { 'x-seed-token': SEED_TOKEN } });
    console.log('Seed result:', resp.data);
    console.log('Done.');
  } catch (err) {
    if (err.response) {
      console.error('Seed failed:', err.response.status, err.response.data);
    } else {
      console.error('Seed failed:', err.message);
    }
    process.exit(1);
  }
})();
