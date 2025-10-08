import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../config/api';
import { User } from '../types';


interface EditTripProps {
  user: User;
}

const EditTrip: React.FC<EditTripProps> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    destination: '',
    price: '',
    capacity: '',
    categories: [] as string[],
    startDate: '',
    endDate: '',
    itinerary: ''
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [itineraryPdf, setItineraryPdf] = useState<File | null>(null);
  const [currentCoverImage, setCurrentCoverImage] = useState('');
  const [currentItineraryPdf, setCurrentItineraryPdf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature', 'Wildlife', 'Desert', 'Arctic', 'Botanical'];

  useEffect(() => {
    const fetchTrip = async () => {
      if (!id) return;
      
      try {
      const response = await api.get(`/trips/${id}`);
      const trip = response.data as any;
      
      // Check if user is the organizer
      if (trip.organizerId !== user.id) {
        navigate('/trips');
        return;
      }
      
      setFormData({
        title: trip.title,
        description: trip.description,
        destination: trip.destination,
        price: trip.price.toString(),
        capacity: trip.capacity.toString(),
        categories: trip.categories,
        startDate: trip.startDate ? new Date(trip.startDate).toISOString().split('T')[0] : '',
        endDate: trip.endDate ? new Date(trip.endDate).toISOString().split('T')[0] : '',
        itinerary: trip.itinerary || ''
      });
      
      setCurrentCoverImage(trip.coverImage || '');
      setCurrentItineraryPdf(trip.itineraryPdf || '');
        
      } catch (error: any) {
        setError('Failed to fetch trip details');
        console.error('Error fetching trip:', error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchTrip();
  }, [id, user.id, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(category)
        ? formData.categories.filter(c => c !== category)
        : [...formData.categories, category]
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'itinerary') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'cover') {
        if (file.type.startsWith('image/')) {
          setCoverImage(file);
        } else {
          setError('Please select a valid image file for cover image');
        }
      } else if (type === 'itinerary') {
        if (file.type === 'application/pdf') {
          setItineraryPdf(file);
        } else {
          setError('Please select a valid PDF file for itinerary');
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare data for JSON submission
      const updateData = {
        title: formData.title,
        description: formData.description,
        destination: formData.destination,
        price: parseFloat(formData.price),
        capacity: parseInt(formData.capacity),
        categories: formData.categories,
        startDate: formData.startDate,
        endDate: formData.endDate,
        itinerary: formData.itinerary
      };

      // Note: File uploads (coverImage and itineraryPdf) are not yet supported in this version
      // They would require a separate endpoint or multipart handling on the backend
      if (coverImage || itineraryPdf) {
        console.warn('File uploads are not yet implemented in the backend API');
      }

      await axios.put(`/trips/${id}`, updateData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      navigate('/profile');
    } catch (error: any) {
      console.error('Update error:', error);
      setError(error.response?.data?.error || 'Failed to update trip');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      try {
        await axios.delete(`/trips/${id}`);
        navigate('/profile');
      } catch (error: any) {
        setError(error.response?.data?.error || 'Failed to delete trip');
      }
    }
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-forest-200 border-t-forest-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-2">
              Edit Adventure
            </h1>
            <p className="text-forest-600">Update your wilderness expedition details</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Trip Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                🏔️ Adventure Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                placeholder="Enter adventure title"
              />
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                📸 Cover Image
              </label>
              <div className="space-y-3">
                {currentCoverImage && (
                  <div className="text-sm text-forest-600">
                    Current: <span className="font-medium">{currentCoverImage}</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cover')}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
                <p className="text-xs text-forest-500">Upload a beautiful cover image for your adventure (JPG, PNG, WebP)</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                📝 Adventure Description
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={5}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                placeholder="Describe your wilderness adventure in detail..."
              />
            </div>

            {/* Destination */}
            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                📍 Destination
              </label>
              <input
                type="text"
                id="destination"
                name="destination"
                required
                value={formData.destination}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                placeholder="Where is this adventure taking place?"
              />
            </div>

            {/* Price and Capacity */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  💰 Price per person (₹)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  👥 Group Size
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  required
                  min="2"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Maximum participants"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  📅 Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  📅 End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
              </div>
            </div>

            {/* Itinerary */}
            <div>
              <label htmlFor="itinerary" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                🗓️ Detailed Itinerary
              </label>
              <textarea
                id="itinerary"
                name="itinerary"
                rows={4}
                value={formData.itinerary}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                placeholder="Day-by-day breakdown of activities..."
              />
            </div>

            {/* Itinerary PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                📄 Itinerary PDF
              </label>
              <div className="space-y-3">
                {currentItineraryPdf && (
                  <div className="text-sm text-forest-600">
                    Current: <span className="font-medium">{currentItineraryPdf}</span>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'itinerary')}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
                <p className="text-xs text-forest-500">Upload a detailed itinerary PDF (optional)</p>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-forest-700 mb-3 flex items-center gap-2">
                🎯 Adventure Categories
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      formData.categories.includes(category)
                        ? 'bg-gradient-to-r from-nature-600 to-forest-600 text-white shadow-lg transform scale-105'
                        : 'bg-forest-100 text-forest-700 hover:bg-forest-200 hover:scale-105'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t border-forest-200">
              <button
                type="button"
                onClick={handleDelete}
                className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🗑️ Delete Adventure
              </button>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="px-8 py-3 border-2 border-forest-300 text-forest-700 rounded-xl font-semibold hover:bg-forest-100 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      💾 Update Adventure
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditTrip;
