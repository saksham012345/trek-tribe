import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
// Most icons removed as they're not currently used in the UI
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

interface ScheduleDay {
  day: number;
  title: string;
  activities: string[];
}

interface TripData {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  categories: string[];
  startDate: string;
  endDate: string;
  itinerary?: string;
  coverImage?: string;
  images?: string[];
  itineraryPdf?: string;
  paymentQR?: string;
  schedule?: ScheduleDay[];
  organizerId: string;
  participants: string[];
  status: 'active' | 'cancelled' | 'completed';
}

const EnhancedEditTrip: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    destination: '',
    price: '',
    capacity: '',
    categories: [] as string[],
    startDate: '',
    endDate: '',
    itinerary: '',
    status: 'active' as 'active' | 'cancelled' | 'completed'
  });

  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newItineraryPdf, setNewItineraryPdf] = useState<File | null>(null);
  const [newPaymentQR, setNewPaymentQR] = useState<File | null>(null);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const categories = [
    'Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature', 
    'Wildlife', 'Desert', 'Arctic', 'Botanical', 'Photography', 
    'Spiritual', 'Culinary', 'Historical', 'Sports'
  ];

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${id}`);
      const tripData = response.data as TripData;
      
      // Verify ownership
      if (tripData.organizerId !== user?.id) {
        navigate('/trips');
        return;
      }
      
      setTrip(tripData);
      setFormData({
        title: tripData.title,
        description: tripData.description,
        destination: tripData.destination,
        price: tripData.price.toString(),
        capacity: tripData.capacity.toString(),
        categories: tripData.categories || [],
        startDate: tripData.startDate ? new Date(tripData.startDate).toISOString().split('T')[0] : '',
        endDate: tripData.endDate ? new Date(tripData.endDate).toISOString().split('T')[0] : '',
        itinerary: tripData.itinerary || '',
        status: tripData.status || 'active'
      });
      
      setSchedule(tripData.schedule || []);
    } catch (error: any) {
      setError('Failed to fetch trip details');
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.includes(category)
        ? formData.categories.filter(c => c !== category)
        : [...formData.categories, category]
    });
  };

  // Schedule management
  const addScheduleDay = () => {
    const newDay: ScheduleDay = {
      day: schedule.length + 1,
      title: '',
      activities: ['']
    };
    setSchedule([...schedule, newDay]);
  };

  const updateScheduleDay = (dayIndex: number, field: keyof ScheduleDay, value: any) => {
    const updatedSchedule = [...schedule];
    if (field === 'activities') {
      updatedSchedule[dayIndex].activities = value;
    } else {
      (updatedSchedule[dayIndex] as any)[field] = value;
    }
    setSchedule(updatedSchedule);
  };

  const addActivity = (dayIndex: number) => {
    const updatedSchedule = [...schedule];
    updatedSchedule[dayIndex].activities.push('');
    setSchedule(updatedSchedule);
  };

  const removeActivity = (dayIndex: number, activityIndex: number) => {
    const updatedSchedule = [...schedule];
    updatedSchedule[dayIndex].activities.splice(activityIndex, 1);
    setSchedule(updatedSchedule);
  };

  const removeScheduleDay = (dayIndex: number) => {
    const updatedSchedule = schedule.filter((_, index) => index !== dayIndex)
      .map((day, index) => ({ ...day, day: index + 1 }));
    setSchedule(updatedSchedule);
  };

  // File handling
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validImages = files.filter(file => file.type.startsWith('image/'));
    
    if (validImages.length !== files.length) {
      setError('Some files were not valid images and were skipped');
    }
    
    if (validImages.length + (trip?.images?.length || 0) > 10) {
      setError('Maximum 10 images allowed per trip');
      return;
    }
    
    setNewImages([...newImages, ...validImages]);
    setError('');
  };

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageUrl: string) => {
    setImagesToDelete([...imagesToDelete, imageUrl]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'itinerary' | 'paymentQR') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'itinerary' && file.type === 'application/pdf') {
        setNewItineraryPdf(file);
        setError('');
      } else if (type === 'paymentQR' && file.type.startsWith('image/')) {
        setNewPaymentQR(file);
        setError('');
      } else {
        setError(`Please select a valid ${type === 'itinerary' ? 'PDF' : 'image'} file`);
      }
    }
  };

  // Upload file to server
  const uploadFileToServer = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const response = await axios.post('/files/upload/base64', {
            data: base64Data,
            filename: file.name,
            mimeType: file.type
          });
          const responseData = response.data as { file: { url: string } };
          resolve(responseData.file.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Upload new files if any
      let newImageUrls: string[] = [];
      let newItineraryUrl = '';
      let newPaymentQRUrl = '';

      if (newImages.length > 0) {
        newImageUrls = await Promise.all(
          newImages.map(image => uploadFileToServer(image))
        );
      }

      if (newItineraryPdf) {
        newItineraryUrl = await uploadFileToServer(newItineraryPdf);
      }

      if (newPaymentQR) {
        newPaymentQRUrl = await uploadFileToServer(newPaymentQR);
      }

      // Prepare update data
      const updateData = {
        title: formData.title,
        description: formData.description,
        destination: formData.destination,
        price: parseFloat(formData.price),
        capacity: parseInt(formData.capacity),
        categories: formData.categories,
        startDate: formData.startDate,
        endDate: formData.endDate,
        itinerary: formData.itinerary,
        status: formData.status,
        schedule: schedule.filter(day => day.title.trim()),
        ...(newImageUrls.length > 0 && {
          images: [
            ...(trip?.images?.filter(img => !imagesToDelete.includes(img)) || []),
            ...newImageUrls
          ]
        }),
        ...(newItineraryUrl && { itineraryPdf: newItineraryUrl }),
        ...(newPaymentQRUrl && { paymentQR: newPaymentQRUrl })
      };

      await axios.put(`/trips/${id}`, updateData);
      
      alert('Trip updated successfully!');
      navigate('/my-profile');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update trip');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (trip?.participants && trip.participants.length > 0) {
      const confirmMessage = `This trip has ${trip.participants.length} participant(s). Deleting it will cancel their bookings. Are you sure you want to continue?`;
      if (!window.confirm(confirmMessage)) return;
    }

    if (window.confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      try {
        await axios.delete(`/trips/${id}`);
        alert('Trip deleted successfully');
        navigate('/my-profile');
      } catch (error: any) {
        setError(error.response?.data?.error || 'Failed to delete trip');
      }
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-forest-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Trip not found</h2>
          <p className="text-gray-600 mt-2">The trip you're trying to edit doesn't exist or you don't have permission to edit it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-forest-800 mb-2">
                ✏️ Edit Trip
              </h1>
              <p className="text-forest-600">
                Updating: <span className="font-semibold">{trip.title}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                🗑️ Delete Trip
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step <= currentStep 
                    ? 'bg-nature-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 4 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < currentStep ? 'bg-nature-600' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {/* Step Content */}
          <div className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trip Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Destination *
                    </label>
                    <input
                      type="text"
                      name="destination"
                      value={formData.destination}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price per Person (₹) *
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Capacity *
                    </label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Current participants: {trip?.participants?.length || 0}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Categories
                  </label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {categories.map((category) => (
                      <label
                        key={category}
                        className={`cursor-pointer px-3 py-2 rounded-lg text-sm font-medium text-center border-2 transition-all ${
                          formData.categories.includes(category)
                            ? 'bg-nature-100 border-nature-500 text-nature-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-nature-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.categories.includes(category)}
                          onChange={() => handleCategoryToggle(category)}
                          className="hidden"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            )}

            {/* Add other steps here for images, schedule, etc. */}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex gap-4">
              {currentStep === totalSteps ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-nature-600 hover:bg-nature-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-lg"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedEditTrip;