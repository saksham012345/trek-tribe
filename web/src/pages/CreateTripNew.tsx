import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User } from '../types';

interface CreateTripProps {
  user: User;
}

// Enhanced interfaces for advanced features
interface ScheduleDay {
  day: number;
  title: string;
  activities: string[];
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

const CreateTrip: React.FC<CreateTripProps> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    location: null as LocationCoordinates | null,
    difficultyLevel: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    includedItems: [] as string[],
    excludedItems: [] as string[],
    requirements: [] as string[],
    cancellationPolicy: 'moderate'
  });
  
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  const [itineraryPdf, setItineraryPdf] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const categories = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature', 'Wildlife', 'Desert', 'Arctic', 'Botanical', 'Photography', 'Spiritual', 'Culinary', 'Historical', 'Sports'];
  
  const includedItemsOptions = [
    'Accommodation', 'Meals', 'Transportation', 'Guide', 'Equipment', 
    'Permits', 'Insurance', 'First Aid', 'Photography', 'Activities'
  ];
  
  const requirementsOptions = [
    'Good Physical Fitness', 'Swimming Ability', 'Previous Experience',
    'Medical Certificate', 'Valid ID/Passport', 'Special Equipment',
    'Age Restrictions', 'No Health Conditions'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleArrayChange = (field: keyof typeof formData, value: string) => {
    const currentArray = formData[field] as string[];
    setFormData({
      ...formData,
      [field]: currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value]
    });
  };
  
  // Enhanced file upload with progress tracking
  const uploadFileToServer = async (file: File): Promise<string> => {
    // Convert file to base64 for our API
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
          resolve(response.data.file.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCategoryChange = (category: string) => {
    handleArrayChange('categories', category);
  };
  
  // Schedule management
  const addScheduleDay = () => {
    const newDay = {
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

  const handleMultipleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validImages = files.filter(file => file.type.startsWith('image/'));
    
    if (validImages.length !== files.length) {
      setError('Some files were not valid images and were skipped');
    }
    
    if (validImages.length > 10) {
      setError('Maximum 10 images allowed');
      return;
    }
    
    setImages([...images, ...validImages].slice(0, 10));
    setError('');
  };
  
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (coverImageIndex >= newImages.length) {
      setCoverImageIndex(Math.max(0, newImages.length - 1));
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'itinerary') => {
    const file = e.target.files?.[0];
    if (file && type === 'itinerary') {
      if (file.type === 'application/pdf') {
        setItineraryPdf(file);
        setError('');
      } else {
        setError('Please select a valid PDF file for itinerary');
      }
    }
  };
  
  // Step navigation
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
  
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.title.trim() !== '' && formData.description.trim() !== '' && formData.destination.trim() !== '';
      case 2:
        return formData.price !== '' && formData.capacity !== '' && formData.startDate !== '' && formData.endDate !== '';
      case 3:
        return formData.categories.length > 0;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Enhanced validation
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.description.trim()) throw new Error('Description is required');
      if (!formData.destination.trim()) throw new Error('Destination is required');
      if (!formData.price || parseFloat(formData.price) <= 0) throw new Error('Valid price is required');
      if (!formData.capacity || parseInt(formData.capacity) < 2) throw new Error('Capacity must be at least 2');
      if (formData.categories.length === 0) throw new Error('At least one category is required');
      
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) throw new Error('Start date cannot be in the past');
      if (startDate >= endDate) throw new Error('End date must be after start date');

      // Upload files with progress tracking
      let uploadedImageUrls: string[] = [];
      let uploadedPdfUrl: string | undefined;
      
      setUploadProgress(10);
      
      if (images.length > 0) {
        setUploadProgress(20);
        const imageUploadPromises = images.map(image => uploadFileToServer(image));
        uploadedImageUrls = await Promise.all(imageUploadPromises);
        setUploadProgress(50);
      }
      
      if (itineraryPdf) {
        setUploadProgress(70);
        uploadedPdfUrl = await uploadFileToServer(itineraryPdf);
        setUploadProgress(80);
      }

      // Prepare enhanced trip data
      const tripData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        destination: formData.destination.trim(),
        price: parseFloat(formData.price),
        capacity: parseInt(formData.capacity),
        categories: formData.categories,
        startDate: formData.startDate,
        endDate: formData.endDate,
        itinerary: formData.itinerary.trim() || 'Detailed itinerary will be provided upon booking.',
        schedule: schedule.filter(day => day.title.trim() && day.activities.some(a => a.trim())),
        images: uploadedImageUrls,
        coverImage: uploadedImageUrls[coverImageIndex] || uploadedImageUrls[0],
        itineraryPdf: uploadedPdfUrl,
        location: formData.location,
        difficultyLevel: formData.difficultyLevel,
        includedItems: formData.includedItems,
        excludedItems: formData.excludedItems,
        requirements: formData.requirements,
        cancellationPolicy: formData.cancellationPolicy
      };

      setUploadProgress(90);
      
      // Submit with timeout
      const response = await Promise.race([
        axios.post('/trips', tripData, {
          headers: { 'Content-Type': 'application/json' }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout - please try again')), 15000)
        )
      ]) as any;
      
      setUploadProgress(100);
      console.log('Trip created successfully:', response?.data);
      
      // Success notification
      alert(`🎉 Trip "${formData.title}" created successfully! Redirecting...`);
      
      setTimeout(() => {
        navigate('/trips');
      }, 1000);
      
    } catch (error: any) {
      console.error('Error creating trip:', error);
      
      let errorMessage = 'Failed to create trip';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        if (typeof error.response.data.error === 'string') {
          errorMessage = error.response.data.error;
        } else if (error.response.data.error.fieldErrors) {
          const fieldErrors = error.response.data.error.fieldErrors;
          const firstError = Object.values(fieldErrors)[0];
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        }
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to create trips. Please ensure you have organizer role.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-forest-800 mb-2">✨ Basic Information</h2>
              <p className="text-forest-600">Tell us about your amazing adventure</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-semibold text-forest-700 mb-3">
                  🎯 Adventure Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Epic Himalayan Trek, Bali Cultural Journey, etc."
                />
              </div>
              
              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-semibold text-forest-700 mb-3">
                  📝 Adventure Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50 resize-none"
                  placeholder="Describe what makes this adventure special, what participants can expect, and what makes it unique..."
                />
              </div>
              
              <div>
                <label htmlFor="destination" className="block text-sm font-semibold text-forest-700 mb-3">
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
                  placeholder="Manali, Himachal Pradesh, India"
                />
              </div>
              
              <div>
                <label htmlFor="difficultyLevel" className="block text-sm font-semibold text-forest-700 mb-3">
                  ⚡ Difficulty Level
                </label>
                <select
                  id="difficultyLevel"
                  name="difficultyLevel"
                  value={formData.difficultyLevel}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                >
                  <option value="beginner">🟢 Beginner - Easy for everyone</option>
                  <option value="intermediate">🟡 Intermediate - Moderate fitness required</option>
                  <option value="advanced">🔴 Advanced - High fitness & experience needed</option>
                </select>
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-forest-800 mb-2">💰 Pricing & Schedule</h2>
              <p className="text-forest-600">Set your dates and pricing details</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="price" className="block text-sm font-semibold text-forest-700 mb-3">
                  💰 Price per Person (₹)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  required
                  min="1"
                  step="1"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="5000"
                />
              </div>
              
              <div>
                <label htmlFor="capacity" className="block text-sm font-semibold text-forest-700 mb-3">
                  👥 Group Size (Max Participants)
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  required
                  min="2"
                  max="50"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="8"
                />
              </div>
              
              <div>
                <label htmlFor="startDate" className="block text-sm font-semibold text-forest-700 mb-3">
                  🗓️ Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
              </div>
              
              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold text-forest-700 mb-3">
                  🏁 End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="cancellationPolicy" className="block text-sm font-semibold text-forest-700 mb-3">
                🔄 Cancellation Policy
              </label>
              <select
                id="cancellationPolicy"
                name="cancellationPolicy"
                value={formData.cancellationPolicy}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
              >
                <option value="flexible">Flexible - Full refund 24h before</option>
                <option value="moderate">Moderate - 50% refund 3 days before</option>
                <option value="strict">Strict - No refund after booking</option>
              </select>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-forest-800 mb-2">🏷️ Categories & Details</h2>
              <p className="text-forest-600">Choose categories and specify what's included</p>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-forest-700 mb-4">
                🎯 Adventure Categories (Select all that apply)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                      formData.categories.includes(category)
                        ? 'bg-nature-500 text-white border-nature-500 shadow-lg transform scale-105'
                        : 'bg-forest-50 text-forest-700 border-forest-200 hover:border-nature-300 hover:bg-nature-50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-3">
                  ✅ What's Included
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-forest-200 rounded-xl p-4 bg-forest-50/30">
                  {includedItemsOptions.map((item) => (
                    <label key={item} className="flex items-center space-x-3 cursor-pointer hover:bg-forest-100/50 p-2 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.includedItems.includes(item)}
                        onChange={() => handleArrayChange('includedItems', item)}
                        className="w-4 h-4 text-nature-600 border-forest-300 rounded focus:ring-nature-500"
                      />
                      <span className="text-sm text-forest-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-3">
                  📋 Requirements
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-forest-200 rounded-xl p-4 bg-forest-50/30">
                  {requirementsOptions.map((requirement) => (
                    <label key={requirement} className="flex items-center space-x-3 cursor-pointer hover:bg-forest-100/50 p-2 rounded-lg">
                      <input
                        type="checkbox"
                        checked={formData.requirements.includes(requirement)}
                        onChange={() => handleArrayChange('requirements', requirement)}
                        className="w-4 h-4 text-nature-600 border-forest-300 rounded focus:ring-nature-500"
                      />
                      <span className="text-sm text-forest-700">{requirement}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-forest-800 mb-2">📸 Media & Itinerary</h2>
              <p className="text-forest-600">Add photos and detailed schedule</p>
            </div>
            
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-forest-700 mb-3">
                🖼️ Adventure Photos (Max 10 images)
              </label>
              <div className="border-2 border-dashed border-forest-300 rounded-xl p-6 text-center hover:border-nature-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultipleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 bg-nature-500 text-white rounded-lg hover:bg-nature-600 transition-colors"
                >
                  📷 Choose Images
                </button>
                <p className="mt-2 text-sm text-forest-600">JPG, PNG, WebP up to 10MB each</p>
              </div>
              
              {/* Image Preview */}
              {images.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-forest-700 mb-2">Selected Images ({images.length}/10)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Upload ${index + 1}`}
                          className={`w-full h-24 object-cover rounded-lg border-2 ${
                            coverImageIndex === index 
                              ? 'border-nature-500 ring-2 ring-nature-200' 
                              : 'border-forest-200'
                          }`}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCoverImageIndex(index)}
                            className={`px-2 py-1 text-xs rounded ${
                              coverImageIndex === index 
                                ? 'bg-nature-500 text-white' 
                                : 'bg-white text-forest-700'
                            }`}
                          >
                            {coverImageIndex === index ? '⭐ Cover' : 'Set Cover'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Itinerary */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="itinerary" className="block text-sm font-semibold text-forest-700 mb-3">
                  🗺️ Detailed Itinerary
                </label>
                <textarea
                  id="itinerary"
                  name="itinerary"
                  rows={6}
                  value={formData.itinerary}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50 resize-none"
                  placeholder="Day 1: Arrival and orientation...&#10;Day 2: Morning hike to base camp...&#10;Day 3: Summit day..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-3">
                  📄 Itinerary PDF (Optional)
                </label>
                <div className="border-2 border-dashed border-forest-300 rounded-xl p-6 text-center hover:border-nature-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'itinerary')}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="inline-flex items-center px-4 py-2 bg-forest-500 text-white rounded-lg hover:bg-forest-600 transition-colors cursor-pointer"
                  >
                    📋 Choose PDF
                  </label>
                  <p className="mt-2 text-sm text-forest-600">Detailed itinerary for participants</p>
                  
                  {itineraryPdf && (
                    <div className="mt-3 text-sm text-forest-700 bg-forest-50 p-2 rounded">
                      ✅ Selected: {itineraryPdf.name}
                    </div>
                  )}
                </div>
                
                {/* Schedule Builder */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-forest-700">
                      📅 Day-by-Day Schedule
                    </label>
                    <button
                      type="button"
                      onClick={addScheduleDay}
                      className="px-3 py-1 bg-nature-500 text-white text-sm rounded-lg hover:bg-nature-600 transition-colors"
                    >
                      ➕ Add Day
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {schedule.map((day, dayIndex) => (
                      <div key={dayIndex} className="border border-forest-200 rounded-lg p-3 bg-forest-50/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-forest-700">Day {day.day}</span>
                          <button
                            type="button"
                            onClick={() => removeScheduleDay(dayIndex)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                        
                        <input
                          type="text"
                          placeholder="Day title (e.g., 'Summit Day', 'Rest & Explore')"
                          value={day.title}
                          onChange={(e) => updateScheduleDay(dayIndex, 'title', e.target.value)}
                          className="w-full px-3 py-2 mb-2 text-sm border border-forest-300 rounded focus:outline-none focus:ring-1 focus:ring-nature-500"
                        />
                        
                        {day.activities.map((activity, activityIndex) => (
                          <div key={activityIndex} className="flex gap-2 mb-1">
                            <input
                              type="text"
                              placeholder="Activity description"
                              value={activity}
                              onChange={(e) => {
                                const newActivities = [...day.activities];
                                newActivities[activityIndex] = e.target.value;
                                updateScheduleDay(dayIndex, 'activities', newActivities);
                              }}
                              className="flex-1 px-3 py-1 text-sm border border-forest-300 rounded focus:outline-none focus:ring-1 focus:ring-nature-500"
                            />
                            {day.activities.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeActivity(dayIndex, activityIndex)}
                                className="px-2 py-1 text-red-500 hover:text-red-700 text-sm"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={() => addActivity(dayIndex)}
                          className="mt-2 px-3 py-1 text-xs bg-forest-200 text-forest-700 rounded hover:bg-forest-300 transition-colors"
                        >
                          ➕ Add Activity
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return <div>Step content not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-forest-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              🏔️ Create Epic Adventure
            </h1>
            <p className="text-forest-100">Design an unforgettable journey for fellow adventurers</p>
            
            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-forest-100">Step {currentStep} of {totalSteps}</span>
                <span className="text-sm font-medium text-forest-100">{Math.round((currentStep / totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-forest-500/30 rounded-full h-2">
                <div 
                  className="bg-white rounded-full h-2 transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Form Content */}
          <div className="p-8">
            <form onSubmit={handleSubmit}>
              {/* Error Display */}
              {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-r-lg flex items-center gap-3 animate-pulse">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold">Oops! Something went wrong</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}
              
              {/* Upload Progress */}
              {loading && uploadProgress > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Uploading files...</span>
                    <span className="text-sm font-medium text-blue-700">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 rounded-full h-2 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Step Content */}
              <div className="min-h-[500px]">
                {renderStepContent()}
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/trips')}
                  className="px-5 py-2.5 border-2 border-forest-300 text-forest-700 rounded-xl hover:bg-forest-50 transition-colors"
                >
                  ← Cancel
                </button>
                
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-5 py-2.5 bg-forest-200 text-forest-800 rounded-xl hover:bg-forest-300 transition-colors"
                    >
                      ← Back
                    </button>
                  )}
                  
                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!isStepValid(currentStep)}
                      className={`px-5 py-2.5 rounded-xl text-white transition-colors ${
                        isStepValid(currentStep)
                          ? 'bg-nature-600 hover:bg-nature-700'
                          : 'bg-nature-300 cursor-not-allowed'
                      }`}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-forest-700 text-white rounded-xl hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? '🚀 Creating Adventure...' : '🎉 Create Trip'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTrip;
