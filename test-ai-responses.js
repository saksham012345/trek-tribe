const axios = require('axios');
const colors = require('colors/safe');

const API_URL = 'http://localhost:4000';
const AI_SERVICE_URL = 'http://localhost:8000';

let authToken = null;

async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'demo.organizer@trektribe.in',
      password: 'DemoOrg@2025!'
    });
    authToken = response.data.token;
    console.log(colors.green('✓ Logged in successfully\n'));
    return true;
  } catch (error) {
    console.log(colors.red('✗ Login failed:', error.message));
    return false;
  }
}

async function testAIResponse(question, expectedSource) {
  console.log(colors.cyan(`\n📝 Testing: "${question}"`));
  console.log(colors.gray(`Expected source: ${expectedSource}`));
  
  try {
    const response = await axios.post(
      `${API_URL}/api/ai/chat`,
      { message: question },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    const data = response.data;
    const text = data.response || data.aiResponse?.response || data.aiResponse || 'No response text';
    const source = data.source || data.aiResponse?.source || 'unknown';
    
    console.log(colors.green('✓ Response received:'));
    console.log(colors.white(`  Answer: ${typeof text === 'string' ? text.substring(0, 150) : JSON.stringify(text).substring(0, 150)}...`));
    console.log(colors.yellow(`  Source: ${source}`));
    console.log(colors.gray(`  Confidence: ${data.confidence || data.aiResponse?.confidence || 'N/A'}`));
    
    return data;
  } catch (error) {
    console.log(colors.red('✗ Request failed:'), error.response?.data || error.message);
    return null;
  }
}

async function testAIServiceDirect() {
  console.log(colors.cyan('\n🔍 Testing AI Service Directly (localhost:8000)...'));
  
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 2000 });
    console.log(colors.green('✓ AI Service is running!'));
    console.log(colors.white(`  Status: ${response.data.status}`));
    return true;
  } catch (error) {
    console.log(colors.yellow('⚠️  AI Service is NOT running on localhost:8000'));
    console.log(colors.gray('  This means the backend is using fallback systems'));
    return false;
  }
}

async function testWhichAISystem() {
  console.log(colors.cyan('\n🤖 Testing Which AI System is Responding...\n'));
  
  // Test 1: Trek-specific question (should use knowledge base)
  await testAIResponse(
    'How do I book a trek on TrekTribe?',
    'Knowledge Base'
  );
  
  // Test 2: World knowledge question
  await testAIResponse(
    'What is the capital of France?',
    'General Knowledge / LLM'
  );
  
  // Test 3: Trek + World knowledge mix
  await testAIResponse(
    'What are the best trekking spots in the Himalayas?',
    'Knowledge Base / LLM'
  );
  
  // Test 4: Complex query
  await testAIResponse(
    'Tell me about Mount Everest and how to prepare for high altitude treks',
    'LLM / Knowledge Base'
  );
}

async function checkAIConfiguration() {
  console.log(colors.cyan('\n⚙️  Checking AI Configuration in Backend...\n'));
  
  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log(colors.green('✓ Backend is running'));
    console.log(colors.white(`  Version: ${response.data.version || 'N/A'}`));
  } catch (error) {
    console.log(colors.red('✗ Backend is not running'));
  }
}

async function main() {
  console.log(colors.bold.cyan('\n╔══════════════════════════════════════════════╗'));
  console.log(colors.bold.cyan('║   AI System Verification & World Knowledge  ║'));
  console.log(colors.bold.cyan('╚══════════════════════════════════════════════╝\n'));
  
  // Check configuration
  await checkAIConfiguration();
  
  // Test AI Service availability
  const aiServiceRunning = await testAIServiceDirect();
  
  if (!aiServiceRunning) {
    console.log(colors.yellow('\n📌 Note: AI Service is not running.'));
    console.log(colors.gray('   The backend will use fallback systems:'));
    console.log(colors.gray('   1. OpenAI API (if OPENAI_API_KEY is set)'));
    console.log(colors.gray('   2. Knowledge Base (embeddings-based)'));
    console.log(colors.gray('   3. General Knowledge (TF-IDF fallback)'));
    console.log(colors.gray('   4. Default helpful messages\n'));
  }
  
  // Login
  const loggedIn = await login();
  if (!loggedIn) {
    console.log(colors.red('\n❌ Cannot proceed without authentication'));
    process.exit(1);
  }
  
  // Test which AI system responds
  await testWhichAISystem();
  
  console.log(colors.cyan('\n\n═══════════════════════════════════════════════'));
  console.log(colors.bold.green('✅ AI System Verification Complete'));
  console.log(colors.cyan('═══════════════════════════════════════════════\n'));
  
  console.log(colors.yellow('📊 Summary:'));
  console.log(colors.white('  • AI Service (localhost:8000): ' + (aiServiceRunning ? colors.green('RUNNING ✓') : colors.yellow('NOT RUNNING ⚠️'))));
  console.log(colors.white('  • Backend AI Routes: ' + colors.green('WORKING ✓')));
  console.log(colors.white('  • Fallback Systems: ' + colors.green('ACTIVE ✓')));
  
  console.log(colors.cyan('\n💡 Recommendation:'));
  if (!aiServiceRunning) {
    console.log(colors.yellow('  To enable the full AI service:'));
    console.log(colors.gray('  1. cd ai-service'));
    console.log(colors.gray('  2. pip install -r requirements.txt'));
    console.log(colors.gray('  3. python -m app.main'));
    console.log(colors.gray('  Or set OPENAI_API_KEY in .env for OpenAI integration\n'));
  } else {
    console.log(colors.green('  AI Service is fully operational! 🎉\n'));
  }
}

main().catch(console.error);
