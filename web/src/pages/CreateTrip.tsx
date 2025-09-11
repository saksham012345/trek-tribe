import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin';
}

interface CreateTripProps {
  user: User;
}

const CreateTrip: React.FC<CreateTripProps> = ({ user }) => {
  const navigate = useNavigate();
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature', 'Wildlife', 'Desert', 'Arctic', 'Botanical'];

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
      // Create FormData for file uploads
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('destination', formData.destination);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('capacity', formData.capacity);
      formDataToSend.append('categories', JSON.stringify(formData.categories));
      formDataToSend.append('startDate', formData.startDate);
      formDataToSend.append('endDate', formData.endDate);
      formDataToSend.append('itinerary', formData.itinerary);

      if (coverImage) {
        formDataToSend.append('coverImage', coverImage);
      }
      if (itineraryPdf) {
        formDataToSend.append('itineraryPdf', itineraryPdf);
      }

      await axios.post('/trips', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      navigate('/trips');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-2">
              Create New Adventure
            </h1>
            <p className="text-forest-600">Plan an epic wilderness expedition for fellow adventurers</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Trip Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter trip title"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your trip in detail"
              />
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
                Destination
              </label>
              <input
                type="text"
                id="destination"
                name="destination"
                required
                value={formData.destination}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Where are you going?"
              />
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                📸 Cover Image
              </label>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'cover')}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
                {coverImage && (
                  <div className="text-sm text-forest-600">
                    Selected: <span className="font-medium">{coverImage.name}</span>
                  </div>
                )}
                <p className="text-xs text-forest-500">Upload a beautiful cover image for your adventure (JPG, PNG, WebP)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-2">
                  Group Size
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  required
                  min="2"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Maximum participants"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Itinerary Text */}
            <div>
              <label htmlFor="itinerary" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                🗺️ Detailed Itinerary
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
                📄 Itinerary PDF (Optional)
              </label>
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'itinerary')}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
                {itineraryPdf && (
                  <div className="text-sm text-forest-600">
                    Selected: <span className="font-medium">{itineraryPdf.name}</span>
                  </div>
                )}
                <p className="text-xs text-forest-500">Upload a detailed itinerary PDF for participants to download</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      formData.categories.includes(category)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/trips')}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateTrip;
