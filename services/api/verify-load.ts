import axios from 'axios';

const URL = 'http://localhost:4000/health';
const CONCURRENCY = 10;
const DURATION_MS = 5000; // 5 seconds

async function runTest() {
    console.log(`🚀 Starting verification load test on ${URL}...`);
    let totalRequests = 0;
    let successRequests = 0;
    const start = Date.now();
    const latencies: number[] = [];

    const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (Date.now() - start < DURATION_MS) {
            const reqStart = Date.now();
            try {
                await axios.get(URL);
                successRequests++;
                latencies.push(Date.now() - reqStart);
            } catch (err) { }
            totalRequests++;
        }
    });

    await Promise.all(workers);

    const durationSec = (Date.now() - start) / 1000;
    const rps = totalRequests / durationSec;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    console.log('\n--- VERIFICATION RESULTS ---');
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Success: ${successRequests}`);
    console.log(`RPS: ${rps.toFixed(2)}`);
    console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
}

runTest().catch(console.error);
