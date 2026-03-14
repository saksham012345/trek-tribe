import axios from 'axios';

const URL = 'https://trek-tribe-1-56gm.onrender.com/health';
const CONCURRENCY = 5; // Reduced concurrency for production safety
const DURATION_MS = 15000; // 15 seconds

async function runTest() {
    console.log(`🚀 Starting production load test on ${URL}...`);
    console.log(`📊 Concurrency: ${CONCURRENCY}, Duration: ${DURATION_MS / 1000}s`);

    let totalRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;
    const start = Date.now();
    const latencies: number[] = [];

    const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (Date.now() - start < DURATION_MS) {
            const reqStart = Date.now();
            try {
                await axios.get(URL);
                successRequests++;
                latencies.push(Date.now() - reqStart);
            } catch (err: any) {
                failedRequests++;
                // Log status to see if it's rate limited (429)
                if (err.response?.status === 429) {
                    console.log('⚠️ Rate limit (429) encountered');
                }
            }
            totalRequests++;
        }
    });

    await Promise.all(workers);

    const durationSec = (Date.now() - start) / 1000;
    const rps = totalRequests / durationSec;
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95Latency = latencies.length > 0 ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;

    console.log('\n--- Production Load Test Results ---');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Success: ${successRequests}`);
    console.log(`Failed (including 429s): ${failedRequests}`);
    console.log(`RPS (Req/Sec): ${rps.toFixed(2)}`);
    console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`P95 Latency: ${p95Latency.toFixed(2)}ms`);
}

runTest().catch(console.error);
