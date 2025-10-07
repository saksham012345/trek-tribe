import React, { useState } from 'react';
import api from '../config/api';

interface User {
  id: string;
  name: string;
}

interface ReviewModalProps {
  tripId: string;
  tripTitle: string;
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ 
  tripId, 
  tripTitle, 
  user, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [formData, setFormData] = useState({
    rating: 5,
    review: '',
    wouldRecommend: true,
    highlights: [] as string[],
    improvements: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const highlightOptions = [
    'Amazing Guide', 'Beautiful Scenery', 'Great Group', 'Well Organized', 
    'Good Value', 'Perfect Weather', 'Memorable Experience', 'Safety First',
    'Comfortable Accommodation', 'Delicious Food'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'range' || type === 'number' ? Number(value) : value
    }));
  };

  const handleHighlightToggle = (highlight: string) => {
    setFormData(prev => ({
      ...prev,
      highlights: prev.highlights.includes(highlight)
        ? prev.highlights.filter(h => h !== highlight)
        : [...prev.highlights, highlight]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/reviews`, {
        tripId,
        rating: formData.rating,
        review: formData.review,
        wouldRecommend: formData.wouldRecommend,
        highlights: formData.highlights,
        improvements: formData.improvements
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getRatingEmoji = (rating: number) => {
    if (rating >= 5) return '🤩';
    if (rating >= 4) return '😊';
    if (rating >= 3) return '😐';
    if (rating >= 2) return '😕';
    return '😞';
  };

  const getRatingText = (rating: number) => {
    if (rating >= 5) return 'Absolutely Amazing!';
    if (rating >= 4) return 'Really Good';
    if (rating >= 3) return 'Good';
    if (rating >= 2) return 'Okay';
    return 'Needs Improvement';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-2">
                Share Your Experience
              </h2>
              <p className="text-forest-600">
                <span className="font-semibold">{tripTitle}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div className="text-center space-y-4">
              <div className="text-6xl">{getRatingEmoji(formData.rating)}</div>
              <div className="space-y-2">
                <label className="block text-lg font-semibold text-forest-800">
                  How was your adventure?
                </label>
                <input
                  type="range"
                  name="rating"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={handleChange}
                  className="w-full h-3 bg-forest-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${(formData.rating - 1) * 25}%, #e5e7eb ${(formData.rating - 1) * 25}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-sm text-forest-600">
                  <span>Poor</span>
                  <span className="font-semibold text-lg text-nature-600">
                    {formData.rating}/5 - {getRatingText(formData.rating)}
                  </span>
                  <span>Excellent</span>
                </div>
              </div>
            </div>

            {/* Written Review */}
            <div>
              <label htmlFor="review" className="block text-sm font-semibold text-forest-700 mb-3">
                Tell us about your experience
              </label>
              <textarea
                id="review"
                name="review"
                rows={4}
                value={formData.review}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 resize-none"
                placeholder="Share your adventure story, what you loved, memorable moments..."
                required
              />
            </div>

            {/* Highlights */}
            <div>
              <label className="block text-sm font-semibold text-forest-700 mb-3">
                What were the highlights? (Select all that apply)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {highlightOptions.map((highlight) => (
                  <button
                    key={highlight}
                    type="button"
                    onClick={() => handleHighlightToggle(highlight)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                      formData.highlights.includes(highlight)
                        ? 'bg-nature-500 text-white border-nature-500 shadow-lg'
                        : 'bg-forest-50 text-forest-700 border-forest-200 hover:border-nature-300 hover:bg-nature-50'
                    }`}
                  >
                    {highlight}
                  </button>
                ))}
              </div>
            </div>

            {/* Improvements */}
            <div>
              <label htmlFor="improvements" className="block text-sm font-semibold text-forest-700 mb-3">
                Any suggestions for improvement? (Optional)
              </label>
              <textarea
                id="improvements"
                name="improvements"
                rows={2}
                value={formData.improvements}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 resize-none"
                placeholder="How could this adventure be even better?"
              />
            </div>

            {/* Recommendation */}
            <div className="bg-forest-50 rounded-xl p-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="wouldRecommend"
                  checked={formData.wouldRecommend}
                  onChange={handleChange}
                  className="w-5 h-5 text-nature-600 border-2 border-forest-300 rounded focus:ring-nature-500"
                />
                <span className="text-forest-800 font-medium">
                  I would recommend this adventure to others
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-6 border-t border-forest-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-forest-300 text-forest-700 rounded-xl font-semibold hover:bg-forest-100 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.review.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sharing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    ⭐ Share Review
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;