import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Verify webhook endpoint
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'trek_tribe_webhook_token';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WhatsApp webhook verified!');
      res.status(200).send(challenge);
    } else {
      console.log('❌ WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Receive webhook events
router.post('/webhook', (req, res) => {
  try {
    const body = req.body;
    
    // Check if this is a WhatsApp status update
    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach((entry: any) => {
        const changes = entry.changes || [];
        
        changes.forEach((change: any) => {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Handle message status updates
            if (value.statuses) {
              value.statuses.forEach((status: any) => {
                console.log(`📱 WhatsApp message ${status.id} status: ${status.status}`);
                
                // You can log delivery status, read receipts, etc.
                switch (status.status) {
                  case 'sent':
                    console.log('✅ Message sent to WhatsApp servers');
                    break;
                  case 'delivered':
                    console.log('✅ Message delivered to recipient');
                    break;
                  case 'read':
                    console.log('✅ Message read by recipient');
                    break;
                  case 'failed':
                    console.log('❌ Message delivery failed');
                    break;
                }
              });
            }
            
            // Handle incoming messages (replies to OTP)
            if (value.messages) {
              value.messages.forEach((message: any) => {
                const from = message.from;
                const messageBody = message.text?.body || '';
                
                console.log(`📨 Received WhatsApp reply from ${from}: ${messageBody}`);
                
                // You could handle OTP confirmations here if needed
                // For now, we just log the reply
              });
            }
          }
        });
      });
    }
    
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
    res.status(400).send('ERROR');
  }
});

export default router;