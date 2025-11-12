/**
 * HTML Email Templates for Trek-Tribe
 * Professional branded email templates for all user communications
 */

const BRAND_COLOR = '#10b981'; // Trek-Tribe green
const SECONDARY_COLOR = '#059669';

/**
 * Base HTML email template with consistent styling
 */
const baseTemplate = (content: string, preheader: string = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Trek-Tribe</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${SECONDARY_COLOR} 100%);
            padding: 30px 20px;
            text-align: center;
        }
        .logo {
            color: #ffffff;
            font-size: 28px;
            font-weight: bold;
            text-decoration: none;
        }
        .content {
            padding: 40px 30px;
        }
        .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: ${BRAND_COLOR};
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            transition: background-color 0.3s;
        }
        .button:hover {
            background-color: ${SECONDARY_COLOR};
        }
        .info-box {
            background-color: #f0fdf4;
            border-left: 4px solid ${BRAND_COLOR};
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .warning-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        h1 {
            color: #111827;
            font-size: 24px;
            margin: 0 0 20px 0;
        }
        h2 {
            color: #1f2937;
            font-size: 20px;
            margin: 30px 0 15px 0;
        }
        p {
            color: #4b5563;
            margin: 15px 0;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #6b7280;
            text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .detail-row {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">${preheader}</span>
    <div class="container">
        <div class="header">
            <a href="${process.env.FRONTEND_URL || 'https://trek-tribe.com'}" class="logo">
                🏔️ Trek-Tribe
            </a>
        </div>
        ${content}
        <div class="footer">
            <p style="margin-bottom: 15px;">
                <strong>Trek-Tribe</strong> - Connect, Explore, Adventure Together
            </p>
            <p style="font-size: 13px; color: #9ca3af;">
                You received this email because you are a member of Trek-Tribe.<br>
                Questions? Contact us at <a href="mailto:support@trek-tribe.com" style="color: ${BRAND_COLOR};">support@trek-tribe.com</a>
            </p>
            <div class="social-links">
                <a href="#">Facebook</a> | 
                <a href="#">Instagram</a> | 
                <a href="#">Twitter</a>
            </div>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
                © ${new Date().getFullYear()} Trek-Tribe. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
`;

/**
 * Booking Confirmation Email
 */
export const bookingConfirmationTemplate = (data: {
    userName: string;
    tripTitle: string;
    tripDestination: string;
    startDate: string;
    endDate: string;
    totalTravelers: number;
    totalAmount: number;
    organizerName: string;
    organizerEmail: string;
    organizerPhone: string;
    bookingId: string;
}) => {
    const content = `
        <div class="content">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Hi ${data.userName},</p>
            <p>Great news! Your booking for <strong>${data.tripTitle}</strong> has been confirmed. Get ready for an amazing adventure!</p>
            
            <div class="info-box">
                <h2 style="margin-top: 0;">Trip Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Trip Name:</span>
                    <span class="detail-value">${data.tripTitle}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Destination:</span>
                    <span class="detail-value">${data.tripDestination}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Dates:</span>
                    <span class="detail-value">${data.startDate} - ${data.endDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Travelers:</span>
                    <span class="detail-value">${data.totalTravelers} ${data.totalTravelers === 1 ? 'person' : 'people'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value"><strong>₹${data.totalAmount.toLocaleString('en-IN')}</strong></span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value">${data.bookingId}</span>
                </div>
            </div>

            <h2>📞 Organizer Contact</h2>
            <p>
                <strong>${data.organizerName}</strong><br>
                Email: <a href="mailto:${data.organizerEmail}" style="color: ${BRAND_COLOR};">${data.organizerEmail}</a><br>
                Phone: ${data.organizerPhone}
            </p>

            <p>Please reach out to the organizer for any trip-specific questions or special requirements.</p>

            <a href="${process.env.FRONTEND_URL}/bookings/${data.bookingId}" class="button">
                View Booking Details
            </a>

            <h2>✅ What's Next?</h2>
            <p>
                1. <strong>Save this email</strong> for your records<br>
                2. <strong>Contact the organizer</strong> for any pre-trip requirements<br>
                3. <strong>Prepare for your adventure</strong> and pack accordingly<br>
                4. <strong>Join our community</strong> to connect with fellow travelers
            </p>

            <p style="margin-top: 30px;">
                Have a fantastic trip! We can't wait to hear about your adventures.
            </p>
        </div>
    `;

    return baseTemplate(content, `Your booking for ${data.tripTitle} is confirmed!`);
};

/**
 * Payment Receipt Email
 */
export const paymentReceiptTemplate = (data: {
    userName: string;
    receiptId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    description: string;
    items?: Array<{ name: string; quantity: number; amount: number }>;
}) => {
    const itemsHtml = data.items ? `
        <h2>Items</h2>
        ${data.items.map(item => `
            <div class="detail-row">
                <span class="detail-label">${item.name} x ${item.quantity}</span>
                <span class="detail-value">₹${item.amount.toLocaleString('en-IN')}</span>
            </div>
        `).join('')}
    ` : '';

    const content = `
        <div class="content">
            <h1>💳 Payment Receipt</h1>
            <p>Hi ${data.userName},</p>
            <p>Thank you for your payment. Here's your receipt for your records.</p>
            
            <div class="info-box">
                <h2 style="margin-top: 0;">Payment Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Receipt ID:</span>
                    <span class="detail-value">${data.receiptId}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${data.paymentDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Method:</span>
                    <span class="detail-value">${data.paymentMethod}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction ID:</span>
                    <span class="detail-value">${data.transactionId}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${data.description}</span>
                </div>
                ${itemsHtml}
                <div class="detail-row" style="border-bottom: none; margin-top: 15px; padding-top: 15px; border-top: 2px solid ${BRAND_COLOR};">
                    <span class="detail-label" style="font-size: 18px;">Total Amount Paid:</span>
                    <span class="detail-value" style="font-size: 18px; color: ${BRAND_COLOR};"><strong>₹${data.amount.toLocaleString('en-IN')}</strong></span>
                </div>
            </div>

            <a href="${process.env.FRONTEND_URL}/receipts/${data.receiptId}" class="button">
                Download PDF Receipt
            </a>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                This is an automated receipt. Please save it for your records. If you have any questions about this payment, please contact our support team.
            </p>
        </div>
    `;

    return baseTemplate(content, `Payment receipt for ₹${data.amount.toLocaleString('en-IN')}`);
};

/**
 * Subscription Activated Email
 */
export const subscriptionActivatedTemplate = (data: {
    userName: string;
    planName: string;
    planTrips: number;
    expiryDate: string;
    amount: number;
    features: string[];
}) => {
    const content = `
        <div class="content">
            <h1>🎊 Subscription Activated!</h1>
            <p>Hi ${data.userName},</p>
            <p>Your <strong>${data.planName}</strong> subscription is now active. Start posting trips and grow your travel business!</p>
            
            <div class="info-box">
                <h2 style="margin-top: 0;">Subscription Details</h2>
                <div class="detail-row">
                    <span class="detail-label">Plan:</span>
                    <span class="detail-value">${data.planName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Trip Allowance:</span>
                    <span class="detail-value">${data.planTrips} trips</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Valid Until:</span>
                    <span class="detail-value">${data.expiryDate}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Amount Paid:</span>
                    <span class="detail-value"><strong>₹${data.amount.toLocaleString('en-IN')}</strong></span>
                </div>
            </div>

            <h2>✨ Your Benefits</h2>
            <ul style="color: #4b5563;">
                ${data.features.map(feature => `<li style="margin: 8px 0;">${feature}</li>`).join('')}
            </ul>

            <a href="${process.env.FRONTEND_URL}/organizer/dashboard" class="button">
                Go to Dashboard
            </a>

            <p style="margin-top: 30px;">
                Ready to create your first trip? Head to your organizer dashboard and start connecting with travelers!
            </p>
        </div>
    `;

    return baseTemplate(content, `Your ${data.planName} is now active!`);
};

/**
 * Trial Expiry Warning Email (7 days before)
 */
export const trialExpiryWarningTemplate = (data: {
    userName: string;
    daysRemaining: number;
    expiryDate: string;
    tripsPosted: number;
    tripsLimit: number;
}) => {
    const content = `
        <div class="content">
            <h1>⏰ Your Free Trial is Ending Soon</h1>
            <p>Hi ${data.userName},</p>
            <p>Your 60-day free trial will expire in <strong>${data.daysRemaining} days</strong> on ${data.expiryDate}.</p>
            
            <div class="warning-box">
                <h2 style="margin-top: 0;">Trial Summary</h2>
                <div class="detail-row">
                    <span class="detail-label">Trips Posted:</span>
                    <span class="detail-value">${data.tripsPosted} / ${data.tripsLimit}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Trial Ends:</span>
                    <span class="detail-value">${data.expiryDate}</span>
                </div>
            </div>

            <p>To continue posting trips and accessing all features, choose a subscription plan that fits your needs.</p>

            <h2>📦 Our Plans</h2>
            <ul style="color: #4b5563;">
                <li><strong>Basic Plan</strong> - ₹1,499/month - 5 trips</li>
                <li><strong>Premium Plan</strong> - ₹2,100/month - 10 trips + CRM + AI tools</li>
            </ul>

            <a href="${process.env.FRONTEND_URL}/organizer/subscriptions" class="button">
                Choose Your Plan
            </a>

            <p style="margin-top: 30px;">
                Don't let your momentum stop! Continue growing your travel business with Trek-Tribe.
            </p>
        </div>
    `;

    return baseTemplate(content, `Your free trial ends in ${data.daysRemaining} days`);
};

/**
 * Trial Expired Email
 */
export const trialExpiredTemplate = (data: {
    userName: string;
    expiredDate: string;
}) => {
    const content = `
        <div class="content">
            <h1>Your Free Trial Has Ended</h1>
            <p>Hi ${data.userName},</p>
            <p>Your 60-day free trial expired on ${data.expiredDate}. We hope you enjoyed exploring Trek-Tribe!</p>
            
            <div class="info-box">
                <p style="margin: 0;">
                    To continue posting trips and connecting with travelers, please subscribe to one of our plans.
                </p>
            </div>

            <h2>Why Subscribe?</h2>
            <ul style="color: #4b5563;">
                <li>Post unlimited trips within your plan limit</li>
                <li>Access to booking management tools</li>
                <li>Payment integration for seamless transactions</li>
                <li>Analytics and insights dashboard</li>
                <li>Priority customer support</li>
                <li>CRM tools (Premium plan)</li>
            </ul>

            <a href="${process.env.FRONTEND_URL}/organizer/subscriptions" class="button">
                View Subscription Plans
            </a>

            <p style="margin-top: 30px;">
                We'd love to have you continue as part of the Trek-Tribe community!
            </p>
        </div>
    `;

    return baseTemplate(content, 'Your free trial has ended');
};

/**
 * Password Reset Email
 */
export const passwordResetTemplate = (data: {
    userName: string;
    resetLink: string;
    expiryMinutes: number;
}) => {
    const content = `
        <div class="content">
            <h1>🔐 Reset Your Password</h1>
            <p>Hi ${data.userName},</p>
            <p>We received a request to reset your Trek-Tribe password. Click the button below to create a new password.</p>
            
            <a href="${data.resetLink}" class="button">
                Reset Password
            </a>

            <div class="warning-box">
                <p style="margin: 0;">
                    <strong>⚠️ Security Notice:</strong><br>
                    This link will expire in ${data.expiryMinutes} minutes. If you didn't request this reset, please ignore this email and your password will remain unchanged.
                </p>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                For security reasons, we never send passwords via email. If you're having trouble, contact our support team.
            </p>
        </div>
    `;

    return baseTemplate(content, 'Reset your Trek-Tribe password');
};

/**
 * Welcome Email for New Users
 */
export const welcomeEmailTemplate = (data: {
    userName: string;
    userRole: string;
}) => {
    const roleContent = data.userRole === 'organizer' ? `
        <h2>🚀 Get Started as an Organizer</h2>
        <p>As a trip organizer, you have access to powerful tools:</p>
        <ul style="color: #4b5563;">
            <li>Create and manage trips</li>
            <li>Handle bookings and payments</li>
            <li>Access analytics and insights</li>
            <li>Communicate with travelers</li>
            <li>60-day free trial included!</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}/organizer/dashboard" class="button">
            Start Creating Trips
        </a>
    ` : `
        <h2>🗺️ Start Your Adventure</h2>
        <p>As a traveler, you can:</p>
        <ul style="color: #4b5563;">
            <li>Discover amazing trips</li>
            <li>Book with verified organizers</li>
            <li>Connect with fellow travelers</li>
            <li>Share your experiences</li>
            <li>Build your travel profile</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}/explore" class="button">
            Explore Trips
        </a>
    `;

    const content = `
        <div class="content">
            <h1>🎉 Welcome to Trek-Tribe!</h1>
            <p>Hi ${data.userName},</p>
            <p>We're thrilled to have you join our community of adventure seekers and travel enthusiasts!</p>
            
            ${roleContent}

            <h2>💡 Pro Tips</h2>
            <ul style="color: #4b5563;">
                <li>Complete your profile to build trust</li>
                <li>Upload a profile picture</li>
                <li>Join our community groups</li>
                <li>Follow your favorite organizers</li>
            </ul>

            <p style="margin-top: 30px;">
                Questions? Our support team is here to help at <a href="mailto:support@trek-tribe.com" style="color: ${BRAND_COLOR};">support@trek-tribe.com</a>
            </p>
        </div>
    `;

    return baseTemplate(content, 'Welcome to Trek-Tribe!');
};

/**
 * OTP Verification Email
 */
export const otpVerificationTemplate = (data: {
    userName: string;
    otp: string;
    expiryMinutes: number;
}) => {
    const content = `
        <div class="content">
            <h1>🔢 Verify Your Email</h1>
            <p>Hi ${data.userName},</p>
            <p>Use the code below to verify your email address and complete your Trek-Tribe registration.</p>
            
            <div class="info-box" style="text-align: center;">
                <h2 style="font-size: 36px; letter-spacing: 8px; margin: 20px 0; color: ${BRAND_COLOR};">
                    ${data.otp}
                </h2>
            </div>

            <p style="text-align: center; color: #6b7280;">
                This code will expire in <strong>${data.expiryMinutes} minutes</strong>
            </p>

            <div class="warning-box">
                <p style="margin: 0;">
                    <strong>⚠️ Security Tip:</strong><br>
                    Never share this code with anyone. Trek-Tribe staff will never ask for your verification code.
                </p>
            </div>
        </div>
    `;

    return baseTemplate(content, `Your verification code: ${data.otp}`);
};

export const emailTemplates = {
    bookingConfirmation: bookingConfirmationTemplate,
    paymentReceipt: paymentReceiptTemplate,
    subscriptionActivated: subscriptionActivatedTemplate,
    trialExpiryWarning: trialExpiryWarningTemplate,
    trialExpired: trialExpiredTemplate,
    passwordReset: passwordResetTemplate,
    welcomeEmail: welcomeEmailTemplate,
    otpVerification: otpVerificationTemplate,
};
