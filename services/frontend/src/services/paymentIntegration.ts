/**
 * Payment Integration Guide for Frontend
 * Updated to use deployed backend: https://trekktribe.onrender.com
 */

import axios from 'axios';

// ========================================
// API Configuration
// ========================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://trekktribe.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========================================
// Payment Integration Services
// ========================================

export const paymentService = {
  /**
   * Subscription Payment Flow
   */
  async getPlanList() {
    const response = await api.get('/api/subscriptions/plans');
    return response.data;
  },

  async activateTrial(planId: string) {
    const response = await api.post('/api/subscriptions/activate-trial', {
      planId,
    });
    return response.data;
  },

  async createSubscriptionOrder(planId: string, autoRenew: boolean = true) {
    const response = await api.post('/api/subscriptions/create-order', {
      planId,
      autoRenew,
      paymentMethod: 'razorpay',
    });
    return response.data;
  },

  async verifySubscriptionPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const response = await api.post('/api/subscriptions/verify-payment', {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return response.data;
  },

  async getUserSubscription() {
    const response = await api.get('/api/subscriptions/user');
    return response.data;
  },

  async cancelSubscription(subscriptionId: string, reason: string = '') {
    const response = await api.post('/api/subscriptions/cancel', {
      subscriptionId,
      reason,
    });
    return response.data;
  },

  /**
   * Booking Payment Flow
   */
  async createBooking(tripId: string, numberOfTravelers: number, travelerDetails: any[]) {
    const response = await api.post('/api/bookings/create', {
      tripId,
      numberOfTravelers,
      travelerDetails,
    });
    return response.data;
  },

  async getBookingDetails(bookingId: string) {
    const response = await api.get(`/api/bookings/${bookingId}`);
    return response.data;
  },

  async createBookingPaymentOrder(bookingId: string) {
    const response = await api.post(`/api/bookings/${bookingId}/create-order`);
    return response.data;
  },

  async verifyBookingPayment(
    bookingId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const response = await api.post(`/api/bookings/${bookingId}/verify-payment`, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return response.data;
  },

  async initiateRefund(bookingId: string, reason: string, notes?: string) {
    const response = await api.post(`/api/bookings/${bookingId}/refund`, {
      reason,
      notes,
    });
    return response.data;
  },

  /**
   * Organizer Onboarding & Settlement
   */
  async onboardOrganizer(onboardingData: any) {
    const response = await api.post('/api/marketplace/organizer/onboard', onboardingData);
    return response.data;
  },

  async getOrganizerStatus(organizerId?: string) {
    const url = organizerId 
      ? `/api/marketplace/organizer/status/${organizerId}`
      : '/api/marketplace/organizer/status';
    const response = await api.get(url);
    return response.data;
  },

  async requestSettlement(amount: number, forceSettle: boolean = false) {
    const response = await api.post('/api/marketplace/settlements/request', {
      amount,
      forceSettle,
    });
    return response.data;
  },

  async getSettlementLedger(limit: number = 10) {
    const response = await api.get(`/api/marketplace/settlements/ledger?limit=${limit}`);
    return response.data;
  },
};

// ========================================
// Razorpay Checkout Helper
// ========================================

export const razorpayHelper = {
  /**
   * Initialize Razorpay checkout for payments
   */
  async openCheckout(options: {
    amount: number;
    orderId: string;
    description: string;
    prefill?: {
      name: string;
      email: string;
      contact: string;
    };
    onSuccess: (response: any) => void;
    onError: (error: any) => void;
  }) {
    // Load Razorpay script if not already loaded
    if (!(window as any).Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.head.appendChild(script);

      return new Promise((resolve, reject) => {
        script.onload = () => {
          resolve(this.createCheckoutInstance(options));
        };
        script.onerror = reject;
      });
    }

    return this.createCheckoutInstance(options);
  },

  createCheckoutInstance(options: any) {
    const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY || '';

    const checkoutOptions = {
      key: razorpayKey,
      amount: options.amount,
      currency: 'INR',
      name: 'Trek Tribe',
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill || {},
      handler: (response: any) => {
        options.onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          options.onError(new Error('Checkout closed'));
        },
      },
      theme: {
        color: '#3399cc',
      },
    };

    const rzp = new (window as any).Razorpay(checkoutOptions);
    rzp.open();

    return rzp;
  },
};

// ========================================
// Error Handling
// ========================================

export const handlePaymentError = (error: any): string => {
  if (error.response?.status === 402) {
    return 'Subscription required. Please activate a plan first.';
  }
  if (error.response?.status === 401) {
    return 'Unauthorized. Please log in again.';
  }
  if (error.response?.status === 400) {
    return error.response.data?.message || 'Invalid request data.';
  }
  if (error.response?.status === 500) {
    return 'Server error. Please try again later.';
  }
  return error.message || 'Payment processing failed.';
};

export default api;
