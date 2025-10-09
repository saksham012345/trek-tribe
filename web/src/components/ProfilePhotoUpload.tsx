import React, { useState, useRef } from 'react';
import { Camera, Upload, X, User } from 'lucide-react';
import axios from 'axios';

interface ProfilePhotoUploadProps {
  currentPhoto?: string;
  onPhotoUpdate: (photoUrl: string) => void;
  className?: string;
}

const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  currentPhoto,
  onPhotoUpdate,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');

      const response = await axios.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const responseData = response.data as { url: string };
      const photoUrl = responseData.url;
      onPhotoUpdate(photoUrl);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert(error.response?.data?.error || 'Failed to upload photo');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    try {
      await axios.delete('/profile/me/photo');
      onPhotoUpdate('');
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo');
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const displayPhoto = previewUrl || currentPhoto;

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Photo Display */}
      <div className="relative group">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-forest-400 to-nature-500 flex items-center justify-center shadow-lg">
          {displayPhoto ? (
            <img 
              src={displayPhoto} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-16 h-16 text-white" />
          )}
        </div>

        {/* Upload Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={triggerFileSelect}>
          {uploading ? (
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Remove Button */}
        {displayPhoto && !uploading && (
          <button
            onClick={removePhoto}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Upload Button */}
      <div className="text-center">
        <button
          onClick={triggerFileSelect}
          disabled={uploading}
          className="flex items-center space-x-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>{displayPhoto ? 'Change Photo' : 'Upload Photo'}</span>
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500 mt-2">
          JPG, PNG or GIF. Max 5MB.
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default ProfilePhotoUpload;