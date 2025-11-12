import React, { useState, useEffect } from 'react';
import api from '../../config/api';

interface SubscriptionCardProps {
  onUpgrade?: () => void;
}

interface SubscriptionData {
  hasSubscription: boolean;
  subscription?: {
    plan: string;
    tripsUsed: number;
    tripsPerCycle: number;
    tripsRemaining: number;
    subscriptionEndDate: string;
    daysUntilExpiry: number;
    isExpired: boolean;
    isTrial: boolean;
    hasCRMAccess: boolean;
    hasAIAccess: boolean;
  };
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ onUpgrade }) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscriptions/my');
      setSubscription(response.data as SubscriptionData);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!subscription?.hasSubscription || subscription.subscription?.isTrial) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-purple-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-purple-900">🎁 Free Trial Active</h3>
            <p className="text-purple-700 text-sm mt-1">
              {subscription?.subscription?.daysUntilExpiry || 60} days remaining
            </p>
          </div>
          <span className="px-3 py-1 bg-purple-200 text-purple-800 text-xs font-semibold rounded-full">
            TRIAL
          </span>
        </div>
        
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-purple-700">Trips Used:</span>
            <span className="font-bold text-purple-900">
              {subscription?.subscription?.tripsUsed || 0} / {subscription?.subscription?.tripsPerCycle || 5}
            </span>
          </div>
          
          <div className="w-full bg-purple-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ 
                width: `${((subscription?.subscription?.tripsUsed || 0) / (subscription?.subscription?.tripsPerCycle || 5)) * 100}%` 
              }}
            ></div>
          </div>
        </div>

        <button
          onClick={onUpgrade}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
        >
          🚀 Upgrade to Premium
        </button>
      </div>
    );
  }

  const sub = subscription.subscription!;
  const isExpiringSoon = sub.daysUntilExpiry <= 7;

  return (
    <div className={`rounded-xl shadow-lg p-6 border-2 ${
      sub.isExpired 
        ? 'bg-red-50 border-red-300' 
        : sub.plan === 'premium' 
        ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300'
        : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 capitalize">
            {sub.plan === 'premium' ? '👑' : '📦'} {sub.plan} Plan
          </h3>
          <p className={`text-sm mt-1 ${
            sub.isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-700'
          }`}>
            {sub.isExpired 
              ? '⚠️ Subscription Expired' 
              : `${sub.daysUntilExpiry} days remaining`
            }
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
          sub.isExpired 
            ? 'bg-red-200 text-red-800'
            : sub.plan === 'premium'
            ? 'bg-amber-200 text-amber-800'
            : 'bg-green-200 text-green-800'
        }`}>
          {sub.plan.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Trips Remaining:</span>
          <span className="font-bold text-gray-900">
            {sub.tripsRemaining} / {sub.tripsPerCycle}
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              sub.plan === 'premium' 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            style={{ width: `${(sub.tripsUsed / sub.tripsPerCycle) * 100}%` }}
          ></div>
        </div>

        <div className="text-xs text-gray-600">
          Expires: {new Date(sub.subscriptionEndDate).toLocaleDateString()}
        </div>
      </div>

      {sub.plan === 'premium' && (
        <div className="bg-white rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Premium Features:</p>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className={sub.hasCRMAccess ? '✅' : '❌'}>✅</span>
              <span>CRM Access</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={sub.hasAIAccess ? '✅' : '❌'}>✅</span>
              <span>AI Tools & Insights</span>
            </div>
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>Priority Support</span>
            </div>
          </div>
        </div>
      )}

      {sub.isExpired ? (
        <button
          onClick={onUpgrade}
          className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-all shadow-md"
        >
          🔄 Renew Subscription
        </button>
      ) : sub.plan === 'basic' ? (
        <button
          onClick={onUpgrade}
          className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-amber-700 hover:to-yellow-700 transition-all shadow-md"
        >
          ⬆️ Upgrade to Premium
        </button>
      ) : null}
    </div>
  );
};

export default SubscriptionCard;
