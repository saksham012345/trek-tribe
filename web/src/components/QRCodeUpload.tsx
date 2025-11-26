import React, { useState } from 'react';
import api from '../config/api';

interface QRCode {
  _id?: string;
  filename: string;
  originalName: string;
  path: string;
  paymentMethod: string;
  description: string;
  uploadedAt: Date;
  isActive: boolean;
}

interface QRCodeUploadProps {
  qrCodes: QRCode[];
  onQRCodesUpdate: (qrCodes: QRCode[]) => void;
}

const QRCodeUpload: React.FC<QRCodeUploadProps> = ({ qrCodes, onQRCodesUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [newQR, setNewQR] = useState({
    paymentMethod: '',
    description: '',
    file: null as File | null
  });

  const paymentMethods = [
    { value: 'upi', label: 'UPI', icon: '💳' },
    { value: 'gpay', label: 'Google Pay', icon: '📱' },
    { value: 'phonepe', label: 'PhonePe', icon: '💰' },
    { value: 'paytm', label: 'Paytm', icon: '🔵' },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
    { value: 'other', label: 'Other', icon: '💸' }
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (images only)
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPG, PNG, etc.)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setNewQR({ ...newQR, file });
    }
  };

  const uploadQRCode = async () => {
    if (!newQR.file || !newQR.paymentMethod) {
      alert('Please select a file and payment method');
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data URL prefix
        };
        reader.readAsDataURL(newQR.file!);
      });

      const response = await api.post('/profile/me/qr-codes', {
        data: base64Data,
        filename: newQR.file.name,
        mimeType: newQR.file.type,
        paymentMethod: newQR.paymentMethod,
        description: newQR.description || `${paymentMethods.find(m => m.value === newQR.paymentMethod)?.label} QR Code`
      });

      const updatedProfile = response.data;
      onQRCodesUpdate((updatedProfile as any).user.organizerProfile?.qrCodes || []);
      
      // Reset form
      setNewQR({ paymentMethod: '', description: '', file: null });
      
      alert('QR Code uploaded successfully!');
    } catch (error: any) {
      console.error('QR upload error:', error);
      alert(error.response?.data?.message || 'Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const toggleQRStatus = async (qrId: string, isActive: boolean) => {
    try {
      const response = await api.patch(`/profile/me/qr-codes/${qrId}`, {
        isActive: !isActive
      });
      
      const updatedProfile = response.data;
      onQRCodesUpdate((updatedProfile as any).user.organizerProfile?.qrCodes || []);
    } catch (error: any) {
      console.error('QR update error:', error);
      alert('Failed to update QR code status');
    }
  };

  const deleteQRCode = async (qrId: string) => {
    if (!globalThis.confirm('Are you sure you want to delete this QR code?')) return;

    try {
      const response = await api.delete(`/profile/me/qr-codes/${qrId}`);
      const updatedProfile = response.data;
      onQRCodesUpdate((updatedProfile as any).user.organizerProfile?.qrCodes || []);
      alert('QR Code deleted successfully');
    } catch (error: any) {
      console.error('QR delete error:', error);
      alert('Failed to delete QR code');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">💳</span>
          <h3 className="text-lg font-semibold text-blue-900">Payment QR Codes</h3>
        </div>
        <p className="text-blue-700 text-sm">
          Upload QR codes for different payment methods. These will be shown to travelers when they book your trips.
        </p>
      </div>

      {/* Upload New QR Code */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Upload New QR Code</h4>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <select
              value={newQR.paymentMethod}
              onChange={(e) => setNewQR({ ...newQR, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nature-500"
            >
              <option value="">Select payment method</option>
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.icon} {method.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={newQR.description}
              onChange={(e) => setNewQR({ ...newQR, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nature-500"
              placeholder="e.g., Personal UPI, Business Account"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            QR Code Image *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="qr-file-input"
            />
            <label
              htmlFor="qr-file-input"
              className="cursor-pointer inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              📷 Choose Image
            </label>
            <p className="text-gray-500 text-sm mt-2">
              {newQR.file ? newQR.file.name : 'JPG, PNG up to 5MB'}
            </p>
          </div>
        </div>
        
        <button
          onClick={uploadQRCode}
          disabled={uploading || !newQR.file || !newQR.paymentMethod}
          className="w-full bg-nature-600 text-white py-2 px-4 rounded-lg hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : '📤 Upload QR Code'}
        </button>
      </div>

      {/* Existing QR Codes */}
      {qrCodes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Your QR Codes</h4>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {qrCodes.map((qr) => (
              <div key={qr._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {paymentMethods.find(m => m.value === qr.paymentMethod)?.icon || '💳'}
                      </span>
                      <span className="font-medium text-gray-900">
                        {paymentMethods.find(m => m.value === qr.paymentMethod)?.label || qr.paymentMethod}
                      </span>
                    </div>
                    {qr.description && (
                      <p className="text-sm text-gray-600">{qr.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleQRStatus(qr._id!, qr.isActive)}
                      className={`text-xs px-2 py-1 rounded-full ${
                        qr.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {qr.isActive ? '✅ Active' : '⏸️ Inactive'}
                    </button>
                  </div>
                </div>
                
                <div className="mb-3">
                  <img
                    src={qr.path}
                    alt={`${qr.paymentMethod} QR Code`}
                    className="w-full max-w-32 mx-auto rounded border"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleQRStatus(qr._id!, qr.isActive)}
                    className="flex-1 text-xs py-1 px-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    {qr.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteQRCode(qr._id!)}
                    className="flex-1 text-xs py-1 px-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeUpload;