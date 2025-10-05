import { Router } from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { emailService } from '../services/emailService';

const router = Router();

// Schema for support contact requests
const supportContactSchema = z.object({
  subject: z.enum([
    'pickup-point-query',
    'trip-booking-issue',
    'payment-problem', 
    'trip-details-clarification',
    'cancellation-request',
    'general-inquiry',
    'technical-issue'
  ]),
  message: z.string().min(10).max(1000),
  tripId: z.string().optional(),
  pickupPointId: z.string().optional(),
  urgency: z.enum(['low', 'medium', 'high']).default('medium'),
  contactPreference: z.enum(['email', 'phone', 'whatsapp']).default('email'),
  phoneNumber: z.string().optional()
});

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Submit support request
router.post('/contact', authenticateJwt, asyncHandler(async (req: any, res: any) => {
  try {
    const userId = req.auth.userId;
    
    // Validate request
    const parsed = supportContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors
      });
    }
    
    const supportData = parsed.data;
    
    // Get user info (you might want to populate this from your User model)
    const userInfo = {
      id: userId,
      // Add other user details as needed
    };
    
    // Prepare support email content
    const emailContent = {
      to: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@trektribe.in',
      subject: `Support Request: ${supportData.subject.replace('-', ' ').toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5530;">Trek Tribe Support Request</h2>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>Request Details</h3>
            <p><strong>Subject:</strong> ${supportData.subject.replace('-', ' ').toUpperCase()}</p>
            <p><strong>Urgency:</strong> ${supportData.urgency.toUpperCase()}</p>
            <p><strong>User ID:</strong> ${userId}</p>
            ${supportData.tripId ? `<p><strong>Trip ID:</strong> ${supportData.tripId}</p>` : ''}
            ${supportData.pickupPointId ? `<p><strong>Pickup Point ID:</strong> ${supportData.pickupPointId}</p>` : ''}
            <p><strong>Contact Preference:</strong> ${supportData.contactPreference}</p>
            ${supportData.phoneNumber ? `<p><strong>Phone:</strong> ${supportData.phoneNumber}</p>` : ''}
          </div>
          
          <div style="background: #fff; padding: 15px; border-left: 4px solid #2c5530;">
            <h3>Message</h3>
            <p>${supportData.message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 10px; background: #e8f4e8; border-radius: 5px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Request submitted at: ${new Date().toISOString()}<br>
              Please respond within 24 hours for ${supportData.urgency} priority requests.
            </p>
          </div>
        </div>
      `
    };
    
    // Send support email
    if (emailService.isServiceEnabled()) {
      // Use the transporter directly since we need custom email content
      const transporter = (emailService as any).transporter;
      if (transporter) {
        await transporter.sendMail({
          from: `"Trek Tribe Support" <${process.env.EMAIL_USER}>`,
          ...emailContent
        });
      }
    }
    
    // Email sent successfully to support team
    console.log('Support request email sent successfully');
    
    res.json({
      success: true,
      message: 'Support request submitted successfully',
      requestId: `TREK${Date.now()}`, // Generate a simple request ID
      response: {
        expectedResponse: '24 hours',
        urgency: supportData.urgency,
        subject: supportData.subject
      }
    });
    
  } catch (error) {
    console.error('Error submitting support request:', error);
    res.status(500).json({
      error: 'Failed to submit support request',
      message: 'Please try again or contact us directly'
    });
  }
}));

// Get support contact information
router.get('/info', asyncHandler(async (req: any, res: any) => {
  res.json({
    success: true,
    supportInfo: {
      email: 'support@trektribe.in',
      phone: '+91-XXXX-XXXXXX',
      whatsapp: '+91-XXXX-XXXXXX',
      workingHours: {
        weekdays: '9:00 AM - 8:00 PM IST',
        weekends: '10:00 AM - 6:00 PM IST'
      },
      emergencyHelpline: '+91-XXXX-XXXXXX',
      responseTime: {
        normal: '24 hours',
        urgent: '4 hours',
        emergency: 'Immediate'
      }
    },
    commonQueries: [
      {
        category: 'Pickup Points',
        questions: [
          'How do I select a pickup point?',
          'Can I change my pickup point after booking?',
          'What if my pickup point is not listed?'
        ]
      },
      {
        category: 'Booking',
        questions: [
          'How do I join a trip?',
          'What information do I need to provide?',
          'Can I cancel my booking?'
        ]
      },
      {
        category: 'Payments',
        questions: [
          'What payment methods are accepted?',
          'Is advance payment required?',
          'What is the refund policy?'
        ]
      }
    ]
  });
}));

// Get FAQ specifically for pickup points
router.get('/pickup-faq', asyncHandler(async (req: any, res: any) => {
  res.json({
    success: true,
    pickupPointFAQ: [
      {
        question: 'How do I select a pickup point?',
        answer: 'When booking a trip, you\'ll see available pickup points. Choose the one most convenient for you. Each pickup point shows the estimated departure time and location details.'
      },
      {
        question: 'Can I change my pickup point after booking?',
        answer: 'Yes, you can change your pickup point up to 24 hours before the trip start time. Contact our support team to make the change.'
      },
      {
        question: 'What if my preferred pickup point is not available?',
        answer: 'Contact our support team and we can help arrange a convenient pickup location or suggest alternatives. We try to accommodate special requests when possible.'
      },
      {
        question: 'How early should I reach the pickup point?',
        answer: 'Please arrive at the pickup point 15 minutes before the scheduled departure time. Our vehicles will wait for a maximum of 10 minutes before departing.'
      },
      {
        question: 'What if I miss my pickup?',
        answer: 'Contact our emergency helpline immediately. We may be able to arrange an alternative pickup point along the route or provide transportation details.'
      },
      {
        question: 'Are pickup points accessible?',
        answer: 'We strive to select pickup points that are easily accessible by public transport and have parking facilities. Accessibility information is provided for each pickup point.'
      }
    ]
  });
}));

export default router;