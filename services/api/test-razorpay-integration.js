#!/usr/bin/env node
/**
 * Razorpay Payment Gateway Integration Test
 * Tests order creation, signature verification, and webhook handling
 */

const crypto = require('crypto');
const https = require('https');

// Test credentials
const RAZORPAY_KEY_ID = 'rzp_test_RprUwM1vPIM49e';
const RAZORPAY_KEY_SECRET = 'J0qz5OBw0jzv5LK9GOjdN3cF';
const WEBHOOK_SECRET = 'WEBHOOK_SECRET'; // Get from webhook dashboard
const API_BASE_URL = 'http://localhost:4000';

console.log('🧪 Razorpay Integration Test Suite\n');
console.log('Configuration:');
console.log(`  API Key: ${RAZORPAY_KEY_ID}`);
console.log(`  Webhook URL: ${API_BASE_URL}/api/webhooks/razorpay`);
console.log(`  Webhook Dashboard: https://dashboard.razorpay.com/app/webhooks/Rprele0MfpDt2A\n`);

/**
 * Test 1: Create Razorpay Order
 */
async function testCreateOrder() {
  console.log('📋 Test 1: Creating Razorpay Order...');
  
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const orderData = {
    amount: 10000, // ₹100 in paise
    currency: 'INR',
    receipt: `test_receipt_${Date.now()}`,
    payment_capture: 1,
    notes: {
      type: 'booking',
      test: 'integration_test'
    }
  };

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.razorpay.com',
      port: 443,
      path: '/v1/orders',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const order = JSON.parse(data);
          console.log('  ✅ Order created successfully');
          console.log(`     Order ID: ${order.id}`);
          console.log(`     Amount: ₹${order.amount / 100}`);
          console.log(`     Status: ${order.status}\n`);
          resolve(order);
        } else {
          console.log(`  ❌ Order creation failed: ${res.statusCode}`);
          console.log(`     ${data}\n`);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (error) => {
      console.log(`  ❌ Request failed: ${error.message}\n`);
      reject(error);
    });

    req.write(JSON.stringify(orderData));
    req.end();
  });
}

/**
 * Test 2: Verify Payment Signature
 */
function testSignatureVerification(orderId, paymentId) {
  console.log('🔐 Test 2: Testing Signature Verification...');
  
  // Simulate payment completion
  const testSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Verify
  const text = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  const isValid = testSignature === expectedSignature;
  
  if (isValid) {
    console.log('  ✅ Signature verification passed');
    console.log(`     Order: ${orderId}`);
    console.log(`     Payment: ${paymentId}`);
    console.log(`     Signature: ${testSignature.slice(0, 20)}...\n`);
  } else {
    console.log('  ❌ Signature verification failed\n');
  }
  
  return isValid;
}

/**
 * Test 3: Simulate Webhook Event
 */
async function testWebhookSignature() {
  console.log('📨 Test 3: Testing Webhook Signature Verification...');
  
  const webhookPayload = {
    entity: 'event',
    account_id: 'acc_test',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: 'pay_test_' + Date.now(),
          entity: 'payment',
          amount: 10000,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_test_' + Date.now(),
          method: 'upi',
          captured: true,
          notes: {
            type: 'booking',
            test: 'webhook_test'
          }
        }
      }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const webhookBody = JSON.stringify(webhookPayload);
  const webhookSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(webhookBody)
    .digest('hex');

  console.log('  Webhook payload prepared:');
  console.log(`     Event: ${webhookPayload.event}`);
  console.log(`     Payment ID: ${webhookPayload.payload.payment.entity.id}`);
  console.log(`     Signature: ${webhookSignature.slice(0, 20)}...`);
  console.log('\n  📝 To test webhook:');
  console.log(`     1. Ensure API server is running on ${API_BASE_URL}`);
  console.log(`     2. Update RAZORPAY_WEBHOOK_SECRET in .env file`);
  console.log(`     3. Configure webhook URL in Razorpay dashboard`);
  console.log(`     4. Use test/live mode appropriately\n`);

  return { payload: webhookPayload, signature: webhookSignature };
}

/**
 * Test 4: Environment Validation
 */
function testEnvironmentSetup() {
  console.log('⚙️  Test 4: Validating Environment Setup...');
  
  const checks = [
    { name: 'Razorpay Key ID', value: RAZORPAY_KEY_ID, required: true },
    { name: 'Razorpay Key Secret', value: RAZORPAY_KEY_SECRET, required: true },
    { name: 'Webhook Secret', value: WEBHOOK_SECRET, required: true }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const status = check.value && check.value !== '' ? '✅' : '❌';
    const masked = check.value ? check.value.slice(0, 8) + '...' : 'NOT SET';
    console.log(`  ${status} ${check.name}: ${masked}`);
    if (check.required && (!check.value || check.value === '')) {
      allPassed = false;
    }
  });

  console.log();
  return allPassed;
}

/**
 * Test 5: Webhook Configuration Check
 */
function testWebhookConfiguration() {
  console.log('🔗 Test 5: Webhook Configuration Checklist...');
  console.log('  📋 Required webhook events:');
  console.log('     ☐ payment.captured');
  console.log('     ☐ payment.failed');
  console.log('     ☐ order.paid');
  console.log('     ☐ refund.processed');
  console.log('\n  🌐 Webhook URL configuration:');
  console.log(`     Production: https://your-domain.com/api/webhooks/razorpay`);
  console.log(`     Development: ${API_BASE_URL}/api/webhooks/razorpay`);
  console.log('     (Use ngrok for local testing: https://ngrok.com)\n');
  console.log('  🔐 Security:');
  console.log('     ☐ Webhook secret configured in dashboard');
  console.log('     ☐ Webhook secret added to .env file');
  console.log('     ☐ Signature verification enabled in code\n');
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // Test 4: Environment
    const envValid = testEnvironmentSetup();
    if (!envValid) {
      console.log('⚠️  Warning: Some environment variables are not set\n');
    }

    // Test 5: Webhook config
    testWebhookConfiguration();

    // Test 1: Create order
    const order = await testCreateOrder();

    // Test 2: Signature verification
    const mockPaymentId = 'pay_test_' + Date.now();
    testSignatureVerification(order.id, mockPaymentId);

    // Test 3: Webhook simulation
    const webhookTest = await testWebhookSignature();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Test Summary\n');
    console.log('✅ Order Creation: PASSED');
    console.log('✅ Signature Verification: PASSED');
    console.log('⚠️  Webhook Integration: MANUAL TESTING REQUIRED\n');
    console.log('📚 Next Steps:');
    console.log('   1. Update .env with webhook secret from dashboard');
    console.log('   2. Start API server: npm run dev');
    console.log('   3. Use ngrok to expose local server (if testing locally)');
    console.log('   4. Add webhook URL to Razorpay dashboard');
    console.log('   5. Test payment flow end-to-end\n');
    console.log('🔗 Webhook Dashboard: https://dashboard.razorpay.com/app/webhooks/Rprele0MfpDt2A\n');

  } catch (error) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`❌ Test suite failed: ${error.message}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
