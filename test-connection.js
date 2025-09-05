const https = require('https');

function testBackend(url) {
  console.log(`Testing backend at: ${url}`);
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${data}`);
        
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`Error: ${err.message}`);
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

async function main() {
  try {
    const healthResponse = await testBackend('https://trek-tribe-5.onrender.com/health');
    console.log('✅ Backend is healthy!');
    console.log('MongoDB status:', healthResponse.mongodb);
    
    // Test if we can make a registration call
    console.log('\nTesting registration endpoint...');
    // This will likely fail with 405 Method Not Allowed, which is expected for GET
    await testBackend('https://trek-tribe-5.onrender.com/auth/register');
  } catch (error) {
    console.log('❌ Backend test failed:', error.message);
    
    if (error.message.includes('ECONNRESET') || error.message.includes('connection was closed')) {
      console.log('\n🔧 Possible fixes:');
      console.log('1. Your Render service might be sleeping (wait 30 seconds and try again)');
      console.log('2. MongoDB is not configured (add MONGODB_URI environment variable)');
      console.log('3. Build failed (check Render deployment logs)');
    }
  }
}

main();
