import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EmailVerificationModal from '../components/EmailVerificationModal';

const VerifyEmail: React.FC = () => {
    const { user, updateUser, refreshUser, logout } = useAuth();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        // specific roles override verification
        if (user.role === 'admin' || user.role === 'agent') {
            navigate('/');
            return;
        }

        if (user.emailVerified) {
            navigate('/');
            return;
        }

        // Show modal if user is waiting for verification
        setShowModal(true);
    }, [user, navigate]);

    const handleVerified = async () => {
        // Refresh user data to get updated verification status from backend
        if (refreshUser) {
            await refreshUser();
        } else {
            updateUser({ emailVerified: true });
        }
        navigate('/');
    };

    const handleClose = () => {
        // If they close the verification modal without verifying, prevent loop by logging out
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-forest-50 relative">
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-forest-600">Waiting for verification...</p>
            </div>

            <EmailVerificationModal
                open={showModal}
                email={user.email}
                userId={user.id || (user as any)._id}
                onVerified={handleVerified}
                onClose={handleClose}
            />
        </div>
    );
};

export default VerifyEmail;
