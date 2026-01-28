export const SUBSCRIPTION_PLANS = {
    STARTER: {
        id: 'STARTER',
        name: 'Starter Plan',
        price: 599, // Price in INR
        amount: 59900, // Price in Paise (for Razorpay)
        currency: 'INR',
        trips: 2,
        duration: 30,
        crmAccess: false,
        leadCapture: false,
        phoneNumbers: false,
        features: [
            'List up to 2 trips',
            'Basic analytics',
            'Email support',
            '2 months free service included',
            '60-day free trial available'
        ],
        trialDays: 60,
        description: 'Perfect for beginners just starting with trek organization'
    },
    BASIC: {
        id: 'BASIC',
        name: 'Basic Plan',
        price: 1299,
        amount: 129900,
        currency: 'INR',
        trips: 4,
        duration: 30,
        crmAccess: false,
        leadCapture: false,
        phoneNumbers: false,
        features: [
            'List up to 4 trips',
            'Basic analytics',
            'Email support',
            'Payment integration',
            '2 months free service included',
            '60-day free trial available'
        ],
        trialDays: 60,
        description: 'Great for growing organizers with regular trips'
    },
    PROFESSIONAL: {
        id: 'PROFESSIONAL',
        name: 'Professional Plan',
        price: 2199,
        amount: 219900,
        currency: 'INR',
        trips: 6,
        duration: 30,
        crmAccess: true,
        leadCapture: true,
        phoneNumbers: true,
        features: [
            'List up to 6 trips',
            'Advanced analytics',
            'Priority support',
            'AI assistant tools',
            'Email templates',
            '✨ Full CRM Access',
            '✨ Lead Capture & Management',
            '✨ Phone Numbers in Leads',
            '2 months free service included',
            '60-day free trial available'
        ],
        trialDays: 60,
        description: 'Great for professional trip organizers'
    },
    PREMIUM: {
        id: 'PREMIUM',
        name: 'Premium Plan',
        price: 3999,
        amount: 399900,
        currency: 'INR',
        trips: 15,
        duration: 30,
        crmAccess: true,
        leadCapture: true,
        phoneNumbers: true,
        features: [
            'List up to 15 trips',
            '✨ Full CRM Access',
            '✨ Lead Capture & Management',
            '✨ Phone Numbers in Leads',
            '✨ Lead Verification System',
            'Advanced analytics with AI',
            '24/7 Priority support',
            'Full AI assistant suite',
            'Email & SMS templates',
            'API access',
            'Custom branding',
            '2 months free service included',
            '60-day free trial available'
        ],
        trialDays: 60,
        description: 'Premium solution for scaling trek organizations'
    },
    ENTERPRISE: {
        id: 'ENTERPRISE',
        name: 'Enterprise Plan',
        price: 7999,
        amount: 799900,
        currency: 'INR',
        trips: 40,
        duration: 30,
        crmAccess: true,
        leadCapture: true,
        phoneNumbers: true,
        features: [
            'List up to 40 trip listings',
            '✨ Full CRM Access',
            '✨ Lead Capture & Management',
            '✨ Phone Numbers in Leads',
            '✨ Lead Verification System',
            'Advanced analytics with AI',
            '24/7 Priority support',
            'Full AI assistant suite',
            'Email & SMS templates',
            'API access with webhooks',
            'Custom branding',
            'Advanced integrations',
            '2 months free service included',
            '60-day free trial available'
        ],
        trialDays: 60,
        description: 'Ultimate solution for high-volume trek organizations'
    }
};

// Default plan for auto-pay initialization (if no specific plan selected)
export const DEFAULT_AUTOPAY_PLAN = SUBSCRIPTION_PLANS.PROFESSIONAL;
