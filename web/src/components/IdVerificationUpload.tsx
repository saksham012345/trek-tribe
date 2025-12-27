import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import api from '../config/api';

interface IdVerificationUploadProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type DocumentType = 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'voter_id';

const IdVerificationUpload: React.FC<IdVerificationUploadProps> = ({ userId, onSuccess, onCancel }) => {
  const [documentType, setDocumentType] = useState<DocumentType>('aadhaar');
  const [documentNumber, setDocumentNumber] = useState('');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [frontPreview, setFrontPreview] = useState('');
  const [backPreview, setBackPreview] = useState('');

  const documentConfig = {
    aadhaar: {
      name: 'Aadhaar Card',
      pattern: /^\d{12}$/,
      requiresBack: true,
      requiresExpiry: false,
      placeholder: '1234 5678 9012',
      example: '12 digits'
    },
    pan: {
      name: 'PAN Card',
      pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      requiresBack: false,
      requiresExpiry: false,
      placeholder: 'ABCDE1234F',
      example: 'Format: ABCDE1234F'
    },
    passport: {
      name: 'Passport',
      pattern: /^[A-Z]{1}[0-9]{7}$/,
      requiresBack: false,
      requiresExpiry: true,
      placeholder: 'A1234567',
      example: 'Format: A1234567'
    },
    driving_license: {
      name: 'Driving License',
      pattern: /^[A-Z0-9]{10,16}$/,
      requiresBack: true,
      requiresExpiry: true,
      placeholder: 'DL-0420110012345',
      example: 'State-specific format'
    },
    voter_id: {
      name: 'Voter ID',
      pattern: /^[A-Z]{3}[0-9]{7}$/,
      requiresBack: true,
      requiresExpiry: false,
      placeholder: 'ABC1234567',
      example: 'Format: ABC1234567'
    }
  };

  const config = documentConfig[documentType];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      setError('Please upload a valid image file (JPG, JPEG, or PNG)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError('');

    // Set file and preview
    if (side === 'front') {
      setFrontImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setFrontPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setBackImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setBackPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadToFirebase = async (file: File, path: string): Promise<string> => {
    // TODO: Implement Firebase upload
    // For now, using placeholder URL
    // In production, use Firebase Storage SDK
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        }
      });
      return response.data.url;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate document number
    if (!config.pattern.test(documentNumber)) {
      setError(`Invalid ${config.name} number. ${config.example}`);
      return;
    }

    // Validate front image
    if (!frontImage) {
      setError('Please upload the front image of your document');
      return;
    }

    // Validate back image if required
    if (config.requiresBack && !backImage) {
      setError('Please upload the back image of your document');
      return;
    }

    // Validate expiry date if required
    if (config.requiresExpiry && !expiryDate) {
      setError('Please enter the expiry date');
      return;
    }

    if (config.requiresExpiry && new Date(expiryDate) < new Date()) {
      setError('Document has expired. Please use a valid document');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload images to Firebase Storage
      const frontPath = `id-documents/${userId}/${documentType}-front-${Date.now()}.jpg`;
      const frontUrl = await uploadToFirebase(frontImage, frontPath);

      let backUrl: string | undefined;
      if (backImage) {
        const backPath = `id-documents/${userId}/${documentType}-back-${Date.now()}.jpg`;
        backUrl = await uploadToFirebase(backImage, backPath);
      }

      // Submit verification request
      const response = await api.post('/id-verification/submit', {
        documentType,
        documentNumber,
        documentFront: frontUrl,
        documentBack: backUrl,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined
      });

      if (response.data.success) {
        onSuccess();
      } else {
        setError(response.data.message || 'Failed to submit verification');
      }
    } catch (error: any) {
      console.error('Verification submission error:', error);
      setError(error.response?.data?.message || 'Failed to submit verification request');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-gray-900">ID Verification Required</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={uploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Why do we need this?</p>
              <p>
                ID verification helps us ensure the safety and security of all participants. 
                Your documents will be verified within 24-48 hours.
              </p>
            </div>
          </div>

          {/* Document Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            >
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="voter_id">Voter ID</option>
            </select>
          </div>

          {/* Document Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {config.name} Number
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
              placeholder={config.placeholder}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              disabled={uploading}
              required
            />
            <p className="mt-1 text-xs text-gray-500">{config.example}</p>
          </div>

          {/* Front Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Front Image
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
              {frontPreview ? (
                <div className="relative">
                  <img
                    src={frontPreview}
                    alt="Front preview"
                    className="w-full h-48 object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFrontImage(null);
                      setFrontPreview('');
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Click to upload front image</span>
                  <span className="text-xs text-gray-500 mt-1">JPG, JPEG or PNG (Max 5MB)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={(e) => handleFileChange(e, 'front')}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Back Image Upload (if required) */}
          {config.requiresBack && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Back Image
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
                {backPreview ? (
                  <div className="relative">
                    <img
                      src={backPreview}
                      alt="Back preview"
                      className="w-full h-48 object-contain rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setBackImage(null);
                        setBackPreview('');
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-12 h-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Click to upload back image</span>
                    <span className="text-xs text-gray-500 mt-1">JPG, JPEG or PNG (Max 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={(e) => handleFileChange(e, 'back')}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Expiry Date (if required) */}
          {config.requiresExpiry && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={uploading}
                required
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit for Verification
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IdVerificationUpload;
