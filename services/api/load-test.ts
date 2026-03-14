import axios from 'axios';

const URL = 'http://localhost:4000/health';
const CONCURRENCY = 10;
const DURATION_MS = 10000; // 10 seconds

async function runTest() {
    console.log(`🚀 Starting load test on ${URL}...`);
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
            } catch (err) {
                failedRequests++;
            }
            totalRequests++;
        }
    });

    await Promise.all(workers);

    const durationSec = (Date.now() - start) / 1000;
    const rps = totalRequests / durationSec;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    console.log('\n--- Load Test Results ---');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Success: ${successRequests}`);
    console.log(`Failed: ${failedRequests}`);
    console.log(`RPS (Req/Sec): ${rps.toFixed(2)}`);
    console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`P95 Latency: ${p95Latency.toFixed(2)}ms`);
}

runTest().catch(console.error);
