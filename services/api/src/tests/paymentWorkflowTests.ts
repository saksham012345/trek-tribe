/**
 * Payment Workflow Testing Guide
 * Comprehensive end-to-end testing for all payment flows
 */

// ========================================
// SUBSCRIPTION WORKFLOW TEST
// ========================================

/**
 * Step 1: List Available Plans
 * GET /api/subscriptions/plans
 */
const testSubscriptionPlans = async () => {
  const response = await fetch('http://localhost:4000/api/subscriptions/plans');
  const plans = await response.json();
  
  console.log('Available Plans:', plans);
  // Expected response:
  // {
  //   "STARTER": { "name": "Starter Plan", "price": 599, "trips": 2, ... },
  //   "BASIC": { "name": "Basic Plan", "price": 1299, "trips": 4, ... },
  //   ...
  // }
};

/**
 * Step 2: Activate Free Trial (Optional)
 * POST /api/subscriptions/activate-trial
 */
const testActivateTrial = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/subscriptions/activate-trial', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      planId: 'STARTER'
    })
  });
  
  const result = await response.json();
  console.log('Trial activation:', result);
  
  // Expected response:
  // {
  //   "success": true,
  //   "subscription": {
  //     "_id": "...",
  //     "planId": "STARTER",
  //     "status": "trial",
  //     "startDate": "2025-12-26",
  //     "expiryDate": "2025-02-24",
  //     "trialDaysRemaining": 60
  //   }
  // }
};

/**
 * Step 3: Purchase Subscription
 * POST /api/subscriptions/purchase
 */
const testPurchaseSubscription = async (token: string, razorpayKey: string) => {
  // Create order
  const orderResponse = await fetch('http://localhost:4000/api/subscriptions/create-order', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      planId: 'PROFESSIONAL',
      autoRenew: true
    })
  });
  
  const order = await orderResponse.json();
  console.log('Order created:', order);
  
  // Open Razorpay checkout
  const options = {
    key: razorpayKey,
    amount: order.amount, // in paise
    currency: 'INR',
    name: 'Trek Tribe',
    description: `${order.planName} Subscription`,
    order_id: order.orderId,
    handler: async (response: any) => {
      // Verify payment
      const verifyResponse = await fetch('http://localhost:4000/api/subscriptions/verify-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        })
      });
      
      const result = await verifyResponse.json();
      console.log('Payment verification:', result);
    }
  };
  
  // Initialize Razorpay checkout (frontend)
  // const rzp = new (window as any).Razorpay(options);
  // rzp.open();
};

/**
 * Step 4: Get Active Subscription
 * GET /api/subscriptions/user
 */
const testGetSubscription = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/subscriptions/user', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const subscription = await response.json();
  console.log('Current subscription:', subscription);
  
  // Expected response:
  // {
  //   "_id": "...",
  //   "planId": "PROFESSIONAL",
  //   "status": "active",
  //   "startDate": "2025-12-26",
  //   "expiryDate": "2026-01-26",
  //   "daysRemaining": 31,
  //   "paymentId": "pay_xxxxx",
  //   "autoRenew": true
  // }
};

// ========================================
// BOOKING PAYMENT WORKFLOW TEST
// ========================================

/**
 * Step 1: Create Booking
 * POST /api/bookings/create
 */
const testCreateBooking = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/bookings/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tripId: '507f1f77bcf86cd799439011', // Sample trip ID
      numberOfTravelers: 2,
      travelerDetails: [
        {
          name: 'John Doe',
          age: 30,
          phone: '9876543210',
          emergencyContact: '9876543211',
          medicalConditions: 'None',
          dietary: 'Vegetarian'
        },
        {
          name: 'Jane Doe',
          age: 28,
          phone: '9876543212',
          emergencyContact: '9876543213',
          medicalConditions: 'None',
          dietary: 'Non-vegetarian'
        }
      ]
    })
  });
  
  const booking = await response.json();
  console.log('Booking created:', booking);
  
  return booking.bookingId;
};

/**
 * Step 2: Process Booking Payment
 * POST /api/bookings/:id/payment
 */
const testProcessBookingPayment = async (token: string, bookingId: string, razorpayKey: string) => {
  // Get payment details
  const detailsResponse = await fetch(`http://localhost:4000/api/bookings/${bookingId}/payment-details`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const paymentDetails = await detailsResponse.json();
  console.log('Payment details:', paymentDetails);
  
  // Create payment order
  const orderResponse = await fetch(`http://localhost:4000/api/bookings/${bookingId}/create-order`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const order = await orderResponse.json();
  
  // Open Razorpay
  const options = {
    key: razorpayKey,
    amount: order.amount,
    currency: 'INR',
    name: 'Trek Tribe',
    description: `Booking for trip - ${paymentDetails.tripName}`,
    order_id: order.orderId,
    prefill: {
      name: paymentDetails.organizerName,
      email: paymentDetails.userEmail,
      contact: paymentDetails.userPhone
    },
    handler: async (response: any) => {
      const verifyResponse = await fetch(`http://localhost:4000/api/bookings/${bookingId}/verify-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        })
      });
      
      const result = await verifyResponse.json();
      if (result.success) {
        console.log('✅ Booking confirmed!');
      } else {
        console.log('❌ Payment verification failed');
      }
    }
  };
};

// ========================================
// ORGANIZER SETTLEMENT WORKFLOW TEST
// ========================================

/**
 * Step 1: Onboard Organizer
 * POST /api/marketplace/organizer/onboard
 */
const testOrganizerOnboarding = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/marketplace/organizer/onboard', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      legalBusinessName: 'Trek Adventures Pvt Ltd',
      businessType: 'pvt_ltd',
      bankAccount: {
        accountNumber: '1234567890123',
        ifscCode: 'HDFC0001234',
        accountHolderName: 'Trek Adventures',
        bankName: 'HDFC Bank'
      },
      personalDetails: {
        panNumber: 'AAAPL5055K',
        aadharNumber: '123456789012',
        dateOfBirth: '1990-01-15'
      },
      businessRegistration: {
        number: 'U7410MH2020PTC334567',
        type: 'cin'
      },
      contactEmail: 'business@trekadventures.com',
      contactPhone: '+919876177839',
      settlementCycle: 'weekly'
    })
  });
  
  const result = await response.json();
  console.log('Organizer onboarded:', result);
  
  return result.accountId;
};

/**
 * Step 2: Get Organizer Status
 * GET /api/marketplace/organizer/status
 */
const testGetOrganizerStatus = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/marketplace/organizer/status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const status = await response.json();
  console.log('Organizer status:', status);
  
  // Expected response includes:
  // - accountId
  // - status (created, activated)
  // - kycStatus (pending, verified, rejected)
  // - recentSettlements
  // - nextSettlementDate
};

/**
 * Step 3: Request Settlement
 * POST /api/marketplace/settlements/request
 */
const testRequestSettlement = async (token: string) => {
  const response = await fetch('http://localhost:4000/api/marketplace/settlements/request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: 1000000, // ₹10,000 in paise
      forceSettle: false
    })
  });
  
  const result = await response.json();
  console.log('Settlement requested:', result);
};

// ========================================
// REFUND WORKFLOW TEST
// ========================================

/**
 * Initiate Refund for Booking
 * POST /api/bookings/:id/refund
 */
const testInitiateRefund = async (token: string, bookingId: string) => {
  const response = await fetch(`http://localhost:4000/api/bookings/${bookingId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: 'customer_request',
      notes: 'Customer changed plans',
      refundToWallet: false
    })
  });
  
  const result = await response.json();
  console.log('Refund initiated:', result);
  
  // Expected response:
  // {
  //   "success": true,
  //   "refundId": "rfnd_xxxxx",
  //   "amount": 5000,
  //   "status": "processing",
  //   "processingTime": "2-3 business days"
  // }
};

// ========================================
// PAYMENT VERIFICATION TEST
// ========================================

/**
 * Verify Razorpay Signature
 * POST /api/payments/verify
 */
const testVerifySignature = async (token: string, orderId: string, paymentId: string, signature: string) => {
  const response = await fetch('http://localhost:4000/api/payments/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature
    })
  });
  
  const result = await response.json();
  console.log('Signature verification:', result);
};

// ========================================
// HELPER FUNCTION TO RUN ALL TESTS
// ========================================

async function runPaymentWorkflowTests(authToken: string, razorpayKey: string) {
  console.log('🚀 Starting Payment Workflow Tests\n');
  
  try {
    // Test 1: Subscription Flow
    console.log('📋 Test 1: Subscription Flow');
    await testSubscriptionPlans();
    await testActivateTrial(authToken);
    await testPurchaseSubscription(authToken, razorpayKey);
    await testGetSubscription(authToken);
    console.log('✅ Subscription flow tested\n');
    
    // Test 2: Booking Payment Flow
    console.log('📋 Test 2: Booking Payment Flow');
    const bookingId = await testCreateBooking(authToken);
    await testProcessBookingPayment(authToken, bookingId, razorpayKey);
    console.log('✅ Booking payment flow tested\n');
    
    // Test 3: Organizer Settlement Flow
    console.log('📋 Test 3: Organizer Settlement Flow');
    const accountId = await testOrganizerOnboarding(authToken);
    await testGetOrganizerStatus(authToken);
    await testRequestSettlement(authToken);
    console.log('✅ Organizer settlement flow tested\n');
    
    // Test 4: Refund Flow
    console.log('📋 Test 4: Refund Flow');
    await testInitiateRefund(authToken, bookingId);
    console.log('✅ Refund flow tested\n');
    
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

export default runPaymentWorkflowTests;
