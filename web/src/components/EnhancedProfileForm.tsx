import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

interface UserPreferences {
  categories?: string[];
  budgetRange?: [number, number];
  locations?: string[];
  difficultyLevels?: string[];
  accommodationTypes?: string[];
  tripDurations?: string[];
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    tripUpdates: boolean;
    promotions: boolean;
  };
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

interface OrganizerProfile {
  bio?: string;
  experience?: string;
  specialties?: string[];
  certifications?: string[];
  languages?: string[];
  yearsOfExperience?: number;
  totalTripsOrganized?: number;
  achievements?: string[];
  uniqueUrl?: string;
  businessInfo?: {
    companyName?: string;
    licenseNumber?: string;
    insuranceDetails?: string;
  };
  paymentQR?: string;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
}

interface EnhancedUser {
  name: string;
  email: string;
  phone?: string;
  bio?: string;
  location?: string;
  dateOfBirth?: string;
  gender?: string;
  occupation?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  emergencyContact?: EmergencyContact;
  preferences?: UserPreferences;
  socialLinks?: SocialLinks;
  organizerProfile?: OrganizerProfile;
  privacySettings?: PrivacySettings;
  role: string;
}

interface EnhancedProfileFormProps {
  onClose?: () => void;
}

const EnhancedProfileForm: React.FC<EnhancedProfileFormProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('basic');
  const [profileData, setProfileData] = useState<EnhancedUser>({
    name: '',
    email: '',
    role: 'traveler'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uniqueUrlSuggestion, setUniqueUrlSuggestion] = useState('');

  const categoryOptions = ['Adventure', 'Cultural', 'Beach', 'Mountain', 'City', 'Nature', 'Wildlife'];
  const difficultyLevels = ['beginner', 'intermediate', 'advanced'];
  const accommodationTypes = ['Hotel', 'Hostel', 'Camping', 'Homestay', 'Resort'];
  const tripDurations = ['1 day', '2-3 days', '4-7 days', '1-2 weeks', '2+ weeks'];
  const specialties = ['Trekking', 'Mountaineering', 'Wildlife Safari', 'Cultural Tours', 'Photography', 'Adventure Sports'];
  const languages = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Mandarin'];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile/enhanced');
      const responseData = response.data as { data: { user: EnhancedUser } };
      setProfileData(responseData.data.user);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any, nested?: string) => {
    if (nested) {
      setProfileData(prev => ({
        ...prev,
        [nested]: {
          ...prev[nested as keyof EnhancedUser] as any,
          [field]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleArrayChange = (field: string, value: string, nested?: string) => {
    const target = nested ? (profileData[nested as keyof EnhancedUser] as any) : profileData;
    const currentArray = target?.[field] || [];
    
    const updatedArray = currentArray.includes(value)
      ? currentArray.filter((item: string) => item !== value)
      : [...currentArray, value];

    handleInputChange(field, updatedArray, nested);
  };

  const generateUniqueUrl = async () => {
    try {
      const response = await api.post('/profile/generate-unique-url', {
        baseName: profileData.name || profileData.organizerProfile?.businessInfo?.companyName || ''
      });
      const responseData = response.data as { data: { suggestion: string } };
      setUniqueUrlSuggestion(responseData.data.suggestion);
      handleInputChange('uniqueUrl', responseData.data.suggestion, 'organizerProfile');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate URL');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      await api.put('/profile/enhanced', profileData);
      setSuccess('Profile updated successfully!');
      
      setTimeout(() => {
        setSuccess('');
        if (onClose) onClose();
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '👤' },
    { id: 'contact', label: 'Contact & Emergency', icon: '📞' },
    { id: 'preferences', label: 'Travel Preferences', icon: '⚙️' },
    { id: 'social', label: 'Social Links', icon: '🌐' },
    ...(profileData.role === 'organizer' ? [{ id: 'organizer', label: 'Organizer Profile', icon: '🏢' }] : []),
    { id: 'privacy', label: 'Privacy Settings', icon: '🔒' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Enhanced Profile Settings</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 mb-4">
          {success}
        </div>
      )}

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-gray-50 border-r">
          <nav className="p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors mb-2 ${
                  currentTab === tab.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6">
          {currentTab === 'basic' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Basic Information</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profileData.dateOfBirth || ''}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={profileData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={profileData.location || ''}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="City, Country"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={profileData.occupation || ''}
                    onChange={(e) => handleInputChange('occupation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={profileData.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {currentTab === 'contact' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Contact & Emergency Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="text-lg font-medium mb-4">Emergency Contact</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={profileData.emergencyContact?.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value, 'emergencyContact')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={profileData.emergencyContact?.relationship || ''}
                      onChange={(e) => handleInputChange('relationship', e.target.value, 'emergencyContact')}
                      placeholder="Mother, Father, Spouse, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Phone
                    </label>
                    <input
                      type="tel"
                      value={profileData.emergencyContact?.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value, 'emergencyContact')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={profileData.emergencyContact?.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value, 'emergencyContact')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'preferences' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Travel Preferences</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Preferred Categories
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categoryOptions.map((category) => (
                    <label key={category} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={profileData.preferences?.categories?.includes(category) || false}
                        onChange={() => handleArrayChange('categories', category, 'preferences')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Difficulty Levels
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {difficultyLevels.map((level) => (
                    <label key={level} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={profileData.preferences?.difficultyLevels?.includes(level) || false}
                        onChange={() => handleArrayChange('difficultyLevels', level, 'preferences')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget Range (₹)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={profileData.preferences?.budgetRange?.[0] || ''}
                      onChange={(e) => handleInputChange('budgetRange', [parseInt(e.target.value) || 0, profileData.preferences?.budgetRange?.[1] || 0], 'preferences')}
                      placeholder="Min"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="flex items-center">to</span>
                    <input
                      type="number"
                      value={profileData.preferences?.budgetRange?.[1] || ''}
                      onChange={(e) => handleInputChange('budgetRange', [profileData.preferences?.budgetRange?.[0] || 0, parseInt(e.target.value) || 0], 'preferences')}
                      placeholder="Max"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3">Notification Preferences</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.preferences?.notifications?.email || false}
                      onChange={(e) => handleInputChange('notifications', { ...profileData.preferences?.notifications, email: e.target.checked }, 'preferences')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Email Notifications</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.preferences?.notifications?.tripUpdates || false}
                      onChange={(e) => handleInputChange('notifications', { ...profileData.preferences?.notifications, tripUpdates: e.target.checked }, 'preferences')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Trip Updates</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.preferences?.notifications?.promotions || false}
                      onChange={(e) => handleInputChange('notifications', { ...profileData.preferences?.notifications, promotions: e.target.checked }, 'preferences')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Promotional Emails</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'social' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Social Media Links</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={profileData.socialLinks?.instagram || ''}
                    onChange={(e) => handleInputChange('instagram', e.target.value, 'socialLinks')}
                    placeholder="https://instagram.com/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={profileData.socialLinks?.facebook || ''}
                    onChange={(e) => handleInputChange('facebook', e.target.value, 'socialLinks')}
                    placeholder="https://facebook.com/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Twitter
                  </label>
                  <input
                    type="url"
                    value={profileData.socialLinks?.twitter || ''}
                    onChange={(e) => handleInputChange('twitter', e.target.value, 'socialLinks')}
                    placeholder="https://twitter.com/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={profileData.socialLinks?.linkedin || ''}
                    onChange={(e) => handleInputChange('linkedin', e.target.value, 'socialLinks')}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={profileData.socialLinks?.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value, 'socialLinks')}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'organizer' && profileData.role === 'organizer' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Organizer Profile</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unique Profile URL
                </label>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <div className="flex">
                      <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-lg">
                        trek-tribe.com/organizer/
                      </span>
                      <input
                        type="text"
                        value={profileData.organizerProfile?.uniqueUrl || ''}
                        onChange={(e) => handleInputChange('uniqueUrl', e.target.value, 'organizerProfile')}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-unique-url"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateUniqueUrl}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Generate
                  </button>
                </div>
                {uniqueUrlSuggestion && (
                  <p className="text-sm text-gray-600 mt-1">
                    Suggested: {uniqueUrlSuggestion}
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    value={profileData.organizerProfile?.yearsOfExperience || ''}
                    onChange={(e) => handleInputChange('yearsOfExperience', parseInt(e.target.value), 'organizerProfile')}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Trips Organized
                  </label>
                  <input
                    type="number"
                    value={profileData.organizerProfile?.totalTripsOrganized || ''}
                    onChange={(e) => handleInputChange('totalTripsOrganized', parseInt(e.target.value), 'organizerProfile')}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Bio
                </label>
                <textarea
                  rows={4}
                  value={profileData.organizerProfile?.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value, 'organizerProfile')}
                  placeholder="Tell potential travelers about your expertise and experience..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Specialties
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {specialties.map((specialty) => (
                    <label key={specialty} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={profileData.organizerProfile?.specialties?.includes(specialty) || false}
                        onChange={() => handleArrayChange('specialties', specialty, 'organizerProfile')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{specialty}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Languages
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {languages.map((language) => (
                    <label key={language} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={profileData.organizerProfile?.languages?.includes(language) || false}
                        onChange={() => handleArrayChange('languages', language, 'organizerProfile')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{language}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="text-lg font-medium mb-4">Business Information</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={profileData.organizerProfile?.businessInfo?.companyName || ''}
                      onChange={(e) => handleInputChange('businessInfo', { ...profileData.organizerProfile?.businessInfo, companyName: e.target.value }, 'organizerProfile')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      License Number
                    </label>
                    <input
                      type="text"
                      value={profileData.organizerProfile?.businessInfo?.licenseNumber || ''}
                      onChange={(e) => handleInputChange('businessInfo', { ...profileData.organizerProfile?.businessInfo, licenseNumber: e.target.value }, 'organizerProfile')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insurance Details
                  </label>
                  <textarea
                    rows={2}
                    value={profileData.organizerProfile?.businessInfo?.insuranceDetails || ''}
                    onChange={(e) => handleInputChange('businessInfo', { ...profileData.organizerProfile?.businessInfo, insuranceDetails: e.target.value }, 'organizerProfile')}
                    placeholder="Insurance company, policy number, coverage details..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {currentTab === 'privacy' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Privacy Settings</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Profile Visibility
                </label>
                <div className="space-y-2">
                  {['public', 'private', 'friends'].map((visibility) => (
                    <label key={visibility} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="profileVisibility"
                        value={visibility}
                        checked={profileData.privacySettings?.profileVisibility === visibility}
                        onChange={(e) => handleInputChange('privacySettings', { ...profileData.privacySettings, profileVisibility: e.target.value })}
                        className="border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm capitalize">{visibility}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-medium mb-3">Information Visibility</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.privacySettings?.showEmail || false}
                      onChange={(e) => handleInputChange('privacySettings', { ...profileData.privacySettings, showEmail: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show email address to other users</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.privacySettings?.showPhone || false}
                      onChange={(e) => handleInputChange('privacySettings', { ...profileData.privacySettings, showPhone: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show phone number to other users</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={profileData.privacySettings?.showLocation || false}
                      onChange={(e) => handleInputChange('privacySettings', { ...profileData.privacySettings, showLocation: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show location to other users</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t">
            <div className="flex justify-end space-x-4">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProfileForm;