import { Router } from 'express';
import { z } from 'zod';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { autoPayService } from '../services/autoPayService';
import { logger } from '../utils/logger';

const router = Router();

// Setup auto-pay for organizer
const setupAutoPaySchema = z.object({
  razorpayCustomerId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  paymentAmount: z.number().min(100) // Minimum ₹1 in paise
});

router.post('/setup', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const parsed = setupAutoPaySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: parsed.error.flatten() 
      });
    }

    const { razorpayCustomerId, paymentMethodId, paymentAmount } = parsed.data;

    await autoPayService.setupAutoPay({
      userId,
      razorpayCustomerId,
      paymentMethodId,
      paymentAmount
    });

    logger.info('Auto-pay setup successful', { userId });

    res.json({
      success: true,
      message: 'Auto-pay setup completed successfully'
    });
  } catch (error: any) {
    logger.error('Error setting up auto-pay', { 
      error: error.message, 
      userId: (req as any).auth.userId 
    });
    res.status(500).json({ 
      error: 'Failed to setup auto-pay',
      message: error.message 
    });
  }
});

// Get auto-pay status
router.get('/status', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const status = await autoPayService.getAutoPayStatus(userId);

    if (!status) {
      return res.status(404).json({
        error: 'Auto-pay not configured'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('Error getting auto-pay status', { 
      error: error.message, 
      userId: (req as any).auth.userId 
    });
    res.status(500).json({ 
      error: 'Failed to get auto-pay status',
      message: error.message 
    });
  }
});

// Cancel auto-pay
router.post('/cancel', authenticateJwt, requireRole(['organizer']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    await autoPayService.cancelAutoPay(userId);

    logger.info('Auto-pay cancelled', { userId });

    res.json({
      success: true,
      message: 'Auto-pay cancelled successfully'
    });
  } catch (error: any) {
    logger.error('Error cancelling auto-pay', { 
      error: error.message, 
      userId: (req as any).auth.userId 
    });
    res.status(500).json({ 
      error: 'Failed to cancel auto-pay',
      message: error.message 
    });
  }
});

// Admin endpoint to manually trigger scheduled payment processing
router.post('/process-scheduled', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    await autoPayService.processScheduledPayments();

    res.json({
      success: true,
      message: 'Scheduled payments processed successfully'
    });
  } catch (error: any) {
    logger.error('Error processing scheduled payments', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to process scheduled payments',
      message: error.message 
    });
  }
});

// Admin endpoint to send payment reminders
router.post('/send-reminders', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    await autoPayService.sendPaymentReminders();

    res.json({
      success: true,
      message: 'Payment reminders sent successfully'
    });
  } catch (error: any) {
    logger.error('Error sending payment reminders', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to send payment reminders',
      message: error.message 
    });
  }
});

export default router;
