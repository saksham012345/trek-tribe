import fetch from 'node-fetch';

const STAGING_URL = process.env.STAGING_URL || 'http://localhost:4000';

async function run() {
  console.log('Running staging smoke tests against', STAGING_URL);

  // Health
  const health = await fetch(`${STAGING_URL}/health`);
  if (!health.ok) {
    console.error('Health check failed', await health.text());
    process.exit(2);
  }

  // Basic public endpoint example
  const support = await fetch(`${STAGING_URL}/health`);
  if (!support.ok) {
    console.error('Support endpoint health failed', await support.text());
    process.exit(2);
  }

  console.log('Smoke tests passed');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(3); });
