import React, { useState, useRef } from 'react';
import { Plus, X, Upload, MapPin, Calendar, Users } from 'lucide-react';
import axios from 'axios';

interface TripImage {
  id: string;
  imageUrl: string;
  caption: string;
  location?: string;
  date?: string;
  participants?: number;
}

interface PreviousTripImagesProps {
  images: TripImage[];
  onImagesUpdate: (images: TripImage[]) => void;
  editing?: boolean;
  maxImages?: number;
}

const PreviousTripImages: React.FC<PreviousTripImagesProps> = ({
  images,
  onImagesUpdate,
  editing = false,
  maxImages = 12
}) => {
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageForm, setImageForm] = useState({
    caption: '',
    location: '',
    date: '',
    participants: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const selectedFiles = Array.from(files).slice(0, maxImages - images.length);
    
    if (selectedFiles.length === 0) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    await uploadImages(selectedFiles);
  };

  const uploadImages = async (files: File[]) => {
    try {
      setUploading(true);

      const uploadPromises = files.map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select image files only');
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File size must be less than 10MB');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'previous-trip');

        const response = await axios.post('/api/uploads/trip-images', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const responseData = response.data as { url: string };
        return {
          id: `temp-${Date.now()}-${Math.random()}`,
          imageUrl: responseData.url,
          caption: '',
          location: '',
          date: '',
          participants: 0
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      onImagesUpdate([...images, ...uploadedImages]);
    } catch (error: any) {
      console.error('Error uploading images:', error);
      alert(error.response?.data?.error || error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.id !== imageId);
    onImagesUpdate(updatedImages);
  };

  const startEditingImage = (image: TripImage) => {
    setEditingImage(image.id);
    setImageForm({
      caption: image.caption,
      location: image.location || '',
      date: image.date || '',
      participants: image.participants?.toString() || ''
    });
  };

  const saveImageDetails = () => {
    if (!editingImage) return;

    const updatedImages = images.map(img => 
      img.id === editingImage 
        ? {
            ...img,
            caption: imageForm.caption,
            location: imageForm.location,
            date: imageForm.date,
            participants: imageForm.participants ? parseInt(imageForm.participants) : 0
          }
        : img
    );

    onImagesUpdate(updatedImages);
    setEditingImage(null);
    setImageForm({ caption: '', location: '', date: '', participants: '' });
  };

  const cancelEditing = () => {
    setEditingImage(null);
    setImageForm({ caption: '', location: '', date: '', participants: '' });
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-forest-800">Previous Trip Gallery</h3>
          <p className="text-sm text-forest-600">Showcase your successful adventures</p>
        </div>
        
        {editing && images.length < maxImages && (
          <button
            onClick={triggerFileSelect}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-nature-600 hover:bg-nature-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Images</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Images Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-forest-200">
              {/* Image */}
              <div className="relative aspect-video">
                <img 
                  src={image.imageUrl} 
                  alt={image.caption || 'Previous trip'} 
                  className="w-full h-full object-cover"
                />
                
                {editing && (
                  <div className="absolute top-2 right-2 flex space-x-2">
                    <button
                      onClick={() => startEditingImage(image)}
                      className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-1 transition-colors"
                      title="Edit details"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeImage(image.id)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Image Details */}
              <div className="p-4">
                {editingImage === image.id ? (
                  /* Edit Form */
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Caption"
                      value={imageForm.caption}
                      onChange={(e) => setImageForm({...imageForm, caption: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                    />
                    
                    <input
                      type="text"
                      placeholder="Location"
                      value={imageForm.location}
                      onChange={(e) => setImageForm({...imageForm, location: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={imageForm.date}
                        onChange={(e) => setImageForm({...imageForm, date: e.target.value})}
                        className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                      
                      <input
                        type="number"
                        placeholder="Participants"
                        value={imageForm.participants}
                        onChange={(e) => setImageForm({...imageForm, participants: e.target.value})}
                        className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={saveImageDetails}
                        className="flex-1 bg-nature-600 hover:bg-nature-700 text-white py-2 rounded-lg font-medium transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="space-y-2">
                    {image.caption && (
                      <p className="font-medium text-forest-800">{image.caption}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-3 text-sm text-forest-600">
                      {image.location && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{image.location}</span>
                        </div>
                      )}
                      
                      {image.date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(image.date).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {image.participants && image.participants > 0 && (
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{image.participants} people</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-6xl mb-4">🏔️</div>
          <h4 className="text-xl font-bold text-forest-800 mb-2">No trip images yet</h4>
          <p className="text-forest-600 mb-4">Share photos from your successful adventures to build trust with potential travelers</p>
          
          {editing && (
            <button
              onClick={triggerFileSelect}
              disabled={uploading}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-nature-600 hover:bg-nature-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Upload Trip Images</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default PreviousTripImages;