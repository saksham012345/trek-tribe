/**
 * Subscription Plan Purchase Component
 * Frontend integration example
 */

import React, { useState, useEffect } from 'react';
import { paymentService, razorpayHelper, handlePaymentError } from '../services/paymentIntegration';

interface Plan {
  id: string;
  name: string;
  price: number;
  trips: number;
  features: string[];
}

export const SubscriptionPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await paymentService.getPlanList();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    try {
      setProcessing(true);
      setSelectedPlan(planId);

      // Step 1: Create subscription order
      const order = await paymentService.createSubscriptionOrder(planId, true);

      // Step 2: Open Razorpay checkout
      await razorpayHelper.openCheckout({
        amount: order.amount,
        orderId: order.orderId,
        description: `${order.planName} Subscription`,
        prefill: {
          name: '', // Would come from user context
          email: '', // Would come from user context
          contact: '', // Would come from user context
        },
        onSuccess: async (response) => {
          // Step 3: Verify payment
          try {
            const verified = await paymentService.verifySubscriptionPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verified.success) {
              alert('✅ Subscription activated successfully!');
              // Redirect to subscription management page
              window.location.href = '/dashboard/subscription';
            }
          } catch (error) {
            alert(`❌ Verification failed: ${handlePaymentError(error)}`);
          }
        },
        onError: (error) => {
          alert(`❌ Payment failed: ${handlePaymentError(error)}`);
        },
      });
    } catch (error) {
      alert(`❌ ${handlePaymentError(error)}`);
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleTrialActivation = async (planId: string) => {
    try {
      setProcessing(true);
      const result = await paymentService.activateTrial(planId);

      if (result.success) {
        alert('✅ Free trial activated! Enjoy 60 days free access.');
        // Redirect to dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      alert(`❌ ${handlePaymentError(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Loading plans...</div>;

  return (
    <div className="subscription-plans">
      <h2>Choose Your Plan</h2>
      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <h3>{plan.name}</h3>
            <p className="price">₹{plan.price}/month</p>
            <p className="trips">{plan.trips} trips included</p>

            <ul className="features">
              {plan.features.map((feature, i) => (
                <li key={i}>✓ {feature}</li>
              ))}
            </ul>

            <button
              onClick={() => handleTrialActivation(plan.id)}
              disabled={processing || selectedPlan === plan.id}
              className="btn btn-secondary"
            >
              Try Free (60 days)
            </button>

            <button
              onClick={() => handlePurchase(plan.id)}
              disabled={processing || selectedPlan === plan.id}
              className="btn btn-primary"
            >
              {processing && selectedPlan === plan.id ? 'Processing...' : 'Subscribe Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
