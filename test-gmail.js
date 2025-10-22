// Gmail SMTP Connection Test
// Run with: node test-gmail.js

const nodemailer = require('nodemailer');

async function testGmailConnection() {
  const emailUser = 'tanejasaksham44@gmail.com';
  const emailPassword = 'idmw kols hcfe mnzo'; // Remove spaces
  
  console.log('🔍 Testing Gmail SMTP connection...');
  console.log('📧 Email:', emailUser);
  console.log('🔐 Password length:', emailPassword.length, 'characters');
  console.log('🔐 Password format:', emailPassword.replace(/./g, '*'));
  
  try {
    // Create transporter
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('⏳ Verifying connection...');
    
    // Test the connection
    await transporter.verify();
    
    console.log('✅ SUCCESS: Gmail SMTP connection working!');
    console.log('✅ Your app password is correct');
    
    return true;
  } catch (error) {
    console.log('❌ FAILED: Gmail SMTP connection failed');
    console.log('❌ Error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.log('');
      console.log('🚨 ISSUE: Invalid credentials detected');
      console.log('💡 Solutions:');
      console.log('   1. Check if 2FA is enabled on Gmail');
      console.log('   2. Generate new app password');
      console.log('   3. Ensure no spaces in app password');
      console.log('   4. Try copying password again');
    }
    
    return false;
  }
}

// Run the test
testGmailConnection()
  .then(success => {
    if (success) {
      console.log('');
      console.log('🎉 Ready to use in Trek Tribe!');
    } else {
      console.log('');
      console.log('🔧 Please fix the issues above before using in Trek Tribe');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });