import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface SaveTripButtonProps {
  tripId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SaveTripButton: React.FC<SaveTripButtonProps> = ({ tripId, className = '', size = 'md' }) => {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (user) {
      checkWishlistStatus();
    } else {
      setLoading(false);
    }
  }, [tripId, user]);

  const checkWishlistStatus = async () => {
    try {
      const response = await api.get(`/wishlist/check/${tripId}`);
      setIsSaved((response.data as any).isInWishlist);
    } catch (error) {
      console.error('Error checking wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!user) {
      alert('Please login to save trips to your wishlist');
      return;
    }

    setAnimating(true);
    setLoading(true);

    try {
      if (isSaved) {
        await api.delete(`/wishlist/trip/${tripId}`);
        setIsSaved(false);
      } else {
        await api.post('/wishlist', {
          tripId,
          priority: 'medium'
        });
        setIsSaved(true);
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Already in wishlist, just update state
        setIsSaved(true);
      } else {
        console.error('Error toggling wishlist:', error);
        alert(error.response?.data?.error || 'Failed to update wishlist');
      }
    } finally {
      setLoading(false);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  if (!user || loading) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1.5',
    lg: 'w-10 h-10 p-2'
  };

  return (
    <button
      onClick={handleToggle}
      className={`${className} ${sizeClasses[size]} rounded-full transition-all duration-300 ${
        isSaved
          ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg'
          : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-500 hover:bg-red-50'
      } ${animating ? 'scale-125' : 'hover:scale-110'} transform`}
      title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-label={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
    >
      <Heart className={`w-full h-full ${isSaved ? 'fill-current' : ''}`} />
    </button>
  );
};

export default SaveTripButton;

