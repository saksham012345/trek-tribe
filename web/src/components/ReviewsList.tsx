import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface Review {
  _id: string;
  userId: {
    name: string;
    email: string;
  };
  rating: number;
  review: string;
  highlights: string[];
  wouldRecommend: boolean;
  createdAt: string;
}

interface ReviewsListProps {
  tripId: string;
  allowReview?: boolean;
  currentUserId?: string;
  onWriteReview?: () => void;
}

const ReviewsList: React.FC<ReviewsListProps> = ({ 
  tripId, 
  allowReview = false, 
  currentUserId,
  onWriteReview 
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await api.get(`/reviews/trip/${tripId}`);
        const reviewData = response.data;
        setReviews(reviewData);
        calculateStats(reviewData);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [tripId]);

  const calculateStats = (reviewData: Review[]) => {
    if (reviewData.length === 0) {
      setStats({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      });
      return;
    }

    const totalRating = reviewData.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviewData.length;
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewData.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++;
    });

    setStats({
      averageRating,
      totalReviews: reviewData.length,
      ratingDistribution
    });
  };

  const renderStars = (rating: number, size: string = 'w-4 h-4') => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${size} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const hasUserReviewed = reviews.some(review => review.userId.email === currentUserId);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reviews Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-2xl font-bold text-forest-800">
            Reviews & Ratings
          </h3>
          {stats.totalReviews > 0 && (
            <div className="flex items-center space-x-2 bg-forest-50 px-3 py-1 rounded-full">
              {renderStars(Math.round(stats.averageRating))}
              <span className="text-sm font-semibold text-forest-700">
                {stats.averageRating.toFixed(1)} ({stats.totalReviews} reviews)
              </span>
            </div>
          )}
        </div>
        
        {allowReview && !hasUserReviewed && (
          <button
            onClick={onWriteReview}
            className="px-4 py-2 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-lg font-medium hover:from-forest-700 hover:to-nature-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            ⭐ Write Review
          </button>
        )}
      </div>

      {/* Rating Distribution */}
      {stats.totalReviews > 0 && (
        <div className="bg-forest-50 rounded-xl p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-nature-600 mb-2">
                {stats.averageRating.toFixed(1)}
              </div>
              {renderStars(Math.round(stats.averageRating), 'w-6 h-6')}
              <div className="text-sm text-forest-600 mt-2">
                Based on {stats.totalReviews} reviews
              </div>
            </div>
            
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution];
                const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                
                return (
                  <div key={rating} className="flex items-center space-x-2">
                    <span className="text-sm text-forest-700 w-2">{rating}</span>
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-nature-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-forest-600 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⭐</div>
            <h4 className="text-xl font-bold text-forest-800 mb-2">No reviews yet</h4>
            <p className="text-forest-600">Be the first to share your experience!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="bg-white border border-forest-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-forest-400 to-nature-500 rounded-full flex items-center justify-center text-white font-bold">
                    {review.userId.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-forest-800">
                      {review.userId.name}
                    </div>
                    <div className="text-sm text-forest-500">
                      {formatDate(review.createdAt)}
                    </div>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>
              
              <p className="text-forest-700 mb-4 leading-relaxed">
                {review.review}
              </p>
              
              {review.highlights.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-forest-700 mb-2">
                    Highlights:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {review.highlights.map((highlight, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-nature-100 text-nature-700 text-xs rounded-full"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {review.wouldRecommend && (
                <div className="flex items-center space-x-2 text-sm text-nature-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Would recommend this adventure</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewsList;