import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const PhoneRequirementGuard: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (loading) return;

        // List of paths that shouldn't trigger the guard
        const publicPaths = [
            '/login',
            '/register',
            '/complete-profile',
            '/verify-email',
            '/reset-password',
            '/forgot-password',
            '/terms-conditions',
            '/privacy-policy',
            '/'
        ];

        // If current path is public, don't interfere
        if (publicPaths.includes(location.pathname)) return;

        // Check if user is logged in but missing phone
        if (user) {
            const hasPhone = user.phone && user.phone.trim().length > 0;

            if (!hasPhone) {
                // Prevent infinite loop if already on complete-profile
                if (location.pathname !== '/complete-profile') {
                    console.log('Redirecting to complete-profile: Missing phone number');
                    navigate('/complete-profile', {
                        state: { from: location },
                        replace: true
                    });
                }
            }
        }
    }, [user, loading, navigate, location]);

    return null; // This component doesn't render anything visually
};

export default PhoneRequirementGuard;
