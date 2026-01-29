import React, { useEffect, useState } from 'react';

// Type for Razorpay options
interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: any) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

// Global Razorpay declaration
declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => any;
    }
}

interface RazorpayCheckoutProps {
    orderId: string;
    amount: number; // in paise
    currency?: string;
    keyId: string;
    name: string;
    description?: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    themeColor?: string;
    onSuccess: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
    }) => void;
    onFailure: (error: any) => void;
    onDismiss?: () => void;
}

const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({
    orderId,
    amount,
    currency = 'INR',
    keyId,
    name,
    description = 'Payment',
    prefill,
    themeColor = '#3B82F6', // Default blue
    onSuccess,
    onFailure,
    onDismiss
}) => {
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);

    useEffect(() => {
        // Load Razorpay script dynamically
        const loadRazorpayScript = () => {
            if (document.querySelector('#razorpay-checkout-script')) {
                setIsScriptLoaded(true);
                return;
            }

            const script = document.createElement('script');
            script.id = 'razorpay-checkout-script';
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => setIsScriptLoaded(true);
            script.onerror = () => onFailure(new Error('Razorpay SDK failed to load'));
            document.body.appendChild(script);
        };

        loadRazorpayScript();
    }, [onFailure]);

    // Public method to open checkout
    const openCheckout = () => {
        if (!isScriptLoaded) {
            console.warn('Razorpay SDK not loaded yet');
            return;
        }

        if (!window.Razorpay) {
            console.error('Razorpay SDK not found on window object');
            onFailure(new Error('Razorpay SDK not initialized'));
            return;
        }

        const options: RazorpayOptions = {
            key: keyId,
            amount: amount,
            currency: currency,
            name: name,
            description: description,
            order_id: orderId,
            handler: (response: any) => {
                onSuccess({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                });
            },
            prefill: prefill,
            theme: {
                color: themeColor,
            },
            modal: {
                ondismiss: () => {
                    if (onDismiss) onDismiss();
                }
            }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
    };

    // Expose openCheckout logic via a renderless component pattern or ref roughly? 
    // Actually, easiest usage is typically: Component renders nothing, but has a useEffect or exposes a trigger.
    // BUT: React best practice is usually to have a button calling this, or a hook.
    // Let's make this component render a button OR just expose the method if the parent wants to control UI.
    // Better: Render nothing and auto-open on mount? Or render a button?
    // DECISION: Render nothing. Auto-open when `orderId` changes and is valid? 
    // NO, that causes popups issues.
    // Let's implement this as a component that exposes an `open` function via Ref, OR simply a hook.
    // Re-thinking: A Hook `useRazorpay` is cleaner. Let's do that instead of a component?
    // The plan said "Component". Let's stick to a component that renders a "Pay Now" button by default but accepts children.

    return (
        <button
            onClick={openCheckout}
            className="hidden" // Hidden trigger, parent can ref it or we can change design
            id={`razorpay-trigger-${orderId}`}
        >
            Pay
        </button>
    );
};

// Hook version for better flexibility
export const useRazorpay = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (document.getElementById('razorpay-script')) {
            setIsLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.id = 'razorpay-script';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setIsLoaded(true);
        document.body.appendChild(script);
    }, []);

    const openPayment = (options: RazorpayCheckoutProps) => {
        return new Promise((resolve, reject) => {
            if (!isLoaded) {
                reject(new Error('Razorpay SDK not loaded'));
                return;
            }
            if (!window.Razorpay) {
                reject(new Error('Razorpay SDK not found'));
                return;
            }

            const rzpOptions: RazorpayOptions = {
                key: options.keyId,
                amount: options.amount,
                currency: options.currency || 'INR',
                name: options.name,
                description: options.description || 'Payment',
                order_id: options.orderId,
                handler: (response: any) => {
                    options.onSuccess(response);
                    resolve(response);
                },
                prefill: options.prefill,
                theme: {
                    color: options.themeColor || '#3B82F6'
                },
                modal: {
                    ondismiss: () => {
                        if (options.onDismiss) options.onDismiss();
                        // reject(new Error('Payment cancelled')); // Don't reject, just handle dismiss
                    }
                }
            };

            const rzp = new window.Razorpay(rzpOptions);
            rzp.open();
        });
    };

    return { isLoaded, openPayment };
};

export default RazorpayCheckout;
