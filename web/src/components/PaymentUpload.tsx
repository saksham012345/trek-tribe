import React, { useState } from 'react';
import api from '../config/api';

interface PaymentUploadProps {
  bookingId: string;
  totalAmount: number;
  onUploadSuccess: () => void;
  onCancel: () => void;
}

const PaymentUpload: React.FC<PaymentUploadProps> = ({
  bookingId,
  totalAmount,
  onUploadSuccess,
  onCancel
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a payment screenshot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('paymentScreenshot', file);

      const response = await api.post(`/bookings/${bookingId}/payment-screenshot`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onUploadSuccess();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to upload payment screenshot');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      const fakeEvent = {
        target: { files: [droppedFile] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    } else {
      setError('Please drop an image file');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-forest-800 mb-2">
                Upload Payment Screenshot
              </h2>
              <p className="text-forest-600">
                Total Amount: <span className="font-semibold text-nature-600">₹{totalAmount.toLocaleString()}</span>
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Payment Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💳 Payment Instructions</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• Transfer ₹{totalAmount.toLocaleString()} to the organizer's bank account</p>
                <p>• Take a screenshot of your payment confirmation</p>
                <p>• Upload the screenshot below for verification</p>
                <p>• Your booking will be confirmed once payment is verified</p>
              </div>
            </div>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                file ? 'border-green-300 bg-green-50' : 'border-forest-300 bg-forest-50 hover:border-nature-400 hover:bg-nature-50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {preview ? (
                <div className="space-y-4">
                  <img
                    src={preview}
                    alt="Payment screenshot preview"
                    className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-green-700 font-medium">
                    ✅ Screenshot ready for upload
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-4xl mb-2">📸</div>
                  <div>
                    <p className="text-lg font-medium text-forest-800 mb-1">
                      Drop your payment screenshot here
                    </p>
                    <p className="text-sm text-forest-600 mb-4">
                      or click to browse files
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="payment-screenshot"
                    />
                    <label
                      htmlFor="payment-screenshot"
                      className="inline-flex items-center px-4 py-2 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors cursor-pointer"
                    >
                      Choose File
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Supported formats: JPG, PNG, GIF, WebP (Max 10MB)
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 border-2 border-forest-300 text-forest-700 rounded-xl font-semibold hover:bg-forest-100 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    📤 Upload Screenshot
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentUpload;