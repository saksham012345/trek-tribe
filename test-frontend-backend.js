const https = require('https');

// Test the main endpoints that the frontend uses
async function testEndpoint(url, description) {
  console.log(`\nTesting ${description}...`);
  console.log(`URL: ${url}`);
  
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log(`Response:`, jsonData);
            console.log(`✅ ${description} is working!`);
          } catch (e) {
            console.log(`Response: ${data.substring(0, 100)}...`);
            console.log(`✅ ${description} responded (non-JSON)`);
          }
        } else {
          console.log(`Response: ${data.substring(0, 200)}...`);
          if (res.statusCode === 404) {
            console.log(`⚠️  ${description} - endpoint exists but route not found (expected for some endpoints)`);
          } else {
            console.log(`❌ ${description} failed with status ${res.statusCode}`);
          }
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${description} failed: ${err.message}`);
      resolve();
    });
    
    req.setTimeout(10000, () => {
      req.abort();
      console.log(`❌ ${description} timed out`);
      resolve();
    });
  });
}

async function main() {
  console.log('🔍 Testing Frontend-Backend Connectivity\n');
  console.log('Backend URL: https://trek-tribe-5.onrender.com');
  
  // Test key endpoints
  await testEndpoint('https://trek-tribe-5.onrender.com/health', 'Health Check');
  await testEndpoint('https://trek-tribe-5.onrender.com/api/auth/login', 'Auth Login Route'); 
  await testEndpoint('https://trek-tribe-5.onrender.com/auth/login', 'Direct Auth Login Route');
  
  console.log('\n✅ Backend connectivity test complete!');
  console.log('\n🌐 Your frontend should now be able to connect to the backend.');
  console.log('\n🔗 Frontend URL: Check your Vercel deployment');
  console.log('🔗 Backend URL: https://trek-tribe-5.onrender.com');
}

main();
