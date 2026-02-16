/**
 * Direct Email Service Test
 * Tests email sending without any API calls
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function testEmailDirect() {
  console.log('\n🔍 Email Configuration Check\n');
  console.log('================================');
  
  // Check environment variables
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const disableEmail = process.env.DISABLE_EMAIL;
  
  console.log('GMAIL_USER:', gmailUser ? '✅ Set' : '❌ Not set');
  console.log('GMAIL_APP_PASSWORD:', gmailPassword ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_USER:', emailUser ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_PASSWORD:', emailPassword ? '✅ Set' : '❌ Not set');
  console.log('DISABLE_EMAIL:', disableEmail || 'false');
  console.log('');
  
  // Determine which credentials to use
  const finalUser = gmailUser || emailUser;
  const finalPassword = gmailPassword || emailPassword;
  
  if (!finalUser || !finalPassword) {
    console.log('❌ Error: Email credentials not configured!');
    console.log('Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    process.exit(1);
  }
  
  console.log('Using credentials:');
  console.log('  Email:', finalUser);
  console.log('  Password:', finalPassword ? '***' + finalPassword.slice(-4) : 'Not set');
  console.log('');
  
  // Create transporter
  console.log('📧 Creating email transporter...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: finalUser,
      pass: finalPassword
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Test connection
  console.log('🔌 Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
  } catch (error: any) {
    console.log('❌ SMTP connection failed!');
    console.log('Error:', error.message);
    console.log('');
    console.log('Common issues:');
    console.log('  1. App password is incorrect');
    console.log('  2. 2-Step Verification not enabled on Gmail');
    console.log('  3. "Less secure app access" needs to be enabled');
    console.log('  4. Gmail account is locked or suspended');
    console.log('');
    console.log('To fix:');
    console.log('  1. Go to https://myaccount.google.com/security');
    console.log('  2. Enable 2-Step Verification');
    console.log('  3. Generate App Password at https://myaccount.google.com/apppasswords');
    console.log('  4. Update GMAIL_APP_PASSWORD in .env file');
    process.exit(1);
  }
  
  // Send test email
  console.log('');
  console.log('📤 Sending test email...');
  
  const testEmail = 'tanejs404@gmail.com';
  const testOtp = '123456';
  
  const mailOptions = {
    from: `Trek Tribe <${finalUser}>`,
    to: testEmail,
    subject: 'Test Email - Trek Tribe',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧪 Email Service Test</h1>
          </div>
          <div class="content">
            <h2>Test Email Successful!</h2>
            <p>If you're reading this, the email service is working correctly.</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Test OTP Code:</p>
              <div class="otp-code">${testOtp}</div>
            </div>
            
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>From: ${finalUser}</li>
              <li>To: ${testEmail}</li>
              <li>Service: Gmail SMTP</li>
              <li>Status: ✅ Working</li>
            </ul>
            
            <p>You can now proceed with testing the full registration flow.</p>
          </div>
          <div class="footer">
            <p>Trek Tribe - Email Service Test</p>
            <p>This is an automated test email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('');
    console.log('📬 Email Details:');
    console.log('  From:', finalUser);
    console.log('  To:', testEmail);
    console.log('  Message ID:', info.messageId);
    console.log('');
    console.log('🎉 SUCCESS! Email service is working!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check your email at:', testEmail);
    console.log('  2. Look for email from:', finalUser);
    console.log('  3. Check spam folder if not in inbox');
    console.log('  4. If received, run: .\\start-testing.ps1');
    console.log('');
  } catch (error: any) {
    console.log('❌ Failed to send test email!');
    console.log('Error:', error.message);
    console.log('');
    console.log('Possible issues:');
    console.log('  1. Gmail daily sending limit reached');
    console.log('  2. Recipient email is invalid');
    console.log('  3. Gmail account needs verification');
    console.log('  4. Network/firewall blocking SMTP');
    process.exit(1);
  }
}

testEmailDirect().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
