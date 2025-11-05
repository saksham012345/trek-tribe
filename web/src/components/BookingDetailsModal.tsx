import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Users, DollarSign, FileText, Image as ImageIcon, Download, ChevronLeft, ChevronRight, Maximize2, ExternalLink, Eye } from 'lucide-react';
import api from '../config/api';

interface BookingDetails {
  _id: string;
  tripTitle: string;
  tripDescription: string;
  tripDestination: string;
  tripStartDate: string;
  tripEndDate: string;
  tripPrice: number;
  tripStatus: string;
  tripCoverImage?: string;
  tripImages: string[];
  tripItinerary?: string;
  tripItineraryPdf?: string;
  tripSchedule: Array<{
    day: number;
    title: string;
    activities: string[];
  }>;
  tripCapacity: number;
  tripParticipantCount: number;
  organizer: {
    name: string;
    phone: string;
    email: string;
  };
  mainBooker: {
    name: string;
    email: string;
    phone: string;
  };
  participants: any[];
  numberOfGuests: number;
  totalAmount: number;
  pricePerPerson: number;
  selectedPackage?: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentVerificationStatus: string;
  paymentVerificationNotes?: string;
  paymentScreenshot?: {
    url: string;
    originalName: string;
    uploadedAt: string;
  };
  bookingStatus: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingDetailsModalProps {
  bookingId: string;
  onClose: () => void;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({ bookingId, onClose }) => {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'images' | 'itinerary' | 'payment'>('overview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
    setSelectedImageIndex(0);
    setImageLoading(true);
    setActiveTab('overview');
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}/details`);
      setBooking((response.data as any).booking);
    } catch (error: any) {
      console.error('Error fetching booking details:', error);
      setError(error.response?.data?.error || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { color: 'bg-green-100 text-green-800', icon: '✅', text: 'Confirmed' },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: '⏳', text: 'Pending' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: '❌', text: 'Cancelled' },
      completed: { color: 'bg-blue-100 text-blue-800', icon: '🎉', text: 'Completed' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <span className={`px-3 py-1 ${config.color} rounded-full text-sm font-medium`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus: string, verificationStatus: string) => {
    if (verificationStatus === 'verified') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">✅ Payment Verified</span>;
    } else if (verificationStatus === 'rejected') {
      return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">❌ Payment Rejected</span>;
    } else if (paymentStatus === 'completed') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">✅ Payment Completed</span>;
    } else if (paymentStatus === 'partial') {
      return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">⏳ Awaiting Verification</span>;
    } else {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">📤 Payment Required</span>;
    }
  };

  const allImages = booking ? [
    ...(booking.tripCoverImage ? [booking.tripCoverImage] : []),
    ...(booking.tripImages || [])
  ].filter((img): img is string => Boolean(img && typeof img === 'string')) : [];

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nature-600"></div>
            <span className="ml-3 text-forest-800">Loading booking details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-forest-800">{booking.tripTitle}</h2>
            <p className="text-forest-600 flex items-center mt-1">
              <MapPin className="w-4 h-4 mr-1" />
              {booking.tripDestination}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: '📋' },
            { id: 'images', label: 'Images', icon: '🖼️' },
            { id: 'itinerary', label: 'Itinerary', icon: '🗓️' },
            { id: 'payment', label: 'Payment', icon: '💳' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-nature-600 border-b-2 border-nature-600 bg-nature-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Trip Overview */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-forest-800 mb-4">Trip Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-nature-600 mr-3" />
                      <div>
                        <p className="font-medium text-forest-800">Trip Dates</p>
                        <p className="text-gray-600">
                          {new Date(booking.tripStartDate).toLocaleDateString()} - {new Date(booking.tripEndDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-nature-600 mr-3" />
                      <div>
                        <p className="font-medium text-forest-800">Participants</p>
                        <p className="text-gray-600">{booking.tripParticipantCount} / {booking.tripCapacity}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-nature-600 mr-3" />
                      <div>
                        <p className="font-medium text-forest-800">Price per Person</p>
                        <p className="text-gray-600">₹{booking.pricePerPerson.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-forest-800 mb-4">Booking Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-forest-800">Booking Status</p>
                      <div className="mt-1">{getStatusBadge(booking.bookingStatus)}</div>
                    </div>
                    <div>
                      <p className="font-medium text-forest-800">Payment Status</p>
                      <div className="mt-1">{getPaymentStatusBadge(booking.paymentStatus, booking.paymentVerificationStatus)}</div>
                    </div>
                    <div>
                      <p className="font-medium text-forest-800">Total Amount</p>
                      <p className="text-2xl font-bold text-nature-600">₹{booking.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Description</h3>
                <p className="text-gray-700 leading-relaxed">{booking.tripDescription}</p>
              </div>

              {/* Organizer Info */}
              <div className="bg-forest-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Trip Organizer</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-forest-800">{booking.organizer.name}</p>
                    <p className="text-gray-600">📞 {booking.organizer.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">📧 {booking.organizer.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-forest-800">Trip Images</h3>
                {allImages.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {allImages.length} {allImages.length === 1 ? 'image' : 'images'}
                  </span>
                )}
              </div>
              
              {allImages.length > 0 ? (
                <div>
                  {/* Main Image Display */}
                  <div className="relative mb-6 group">
                    <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-lg relative">
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nature-600"></div>
                        </div>
                      )}
                      <img
                        src={allImages[selectedImageIndex]}
                        alt={`${booking.tripTitle} ${selectedImageIndex + 1}`}
                        className="w-full h-full object-cover transition-opacity duration-300"
                        onLoad={() => setImageLoading(false)}
                        onError={(e) => {
                          setImageLoading(false);
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x450?text=Image+Not+Available';
                        }}
                      />
                      
                      {/* Fullscreen Button */}
                      <button
                        onClick={() => setIsFullscreen(true)}
                        className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-lg p-2 transition-all opacity-0 group-hover:opacity-100"
                        title="View fullscreen"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Navigation Arrows */}
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full p-3 transition-all shadow-lg z-10"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full p-3 transition-all shadow-lg z-10"
                          aria-label="Next image"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                    
                    {/* Image Counter */}
                    <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm">
                      {selectedImageIndex + 1} / {allImages.length}
                    </div>
                  </div>

                  {/* Thumbnail Grid */}
                  {allImages.length > 1 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {allImages.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setSelectedImageIndex(index);
                            setImageLoading(true);
                          }}
                          className={`aspect-video rounded-lg overflow-hidden border-2 transition-all relative group ${
                            selectedImageIndex === index 
                              ? 'border-nature-500 ring-2 ring-nature-200 scale-105' 
                              : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${booking.tripTitle} thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Image';
                            }}
                          />
                          {selectedImageIndex === index && (
                            <div className="absolute inset-0 bg-nature-500 bg-opacity-20 flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No images available for this trip</p>
                  <p className="text-sm text-gray-500 mt-2">Images will appear here once uploaded by the organizer</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-forest-800">Trip Itinerary</h3>
                {(booking.tripItineraryPdf || booking.tripItinerary || (booking.tripSchedule && booking.tripSchedule.length > 0)) && (
                  <span className="text-sm text-gray-600">📋 Complete Details</span>
                )}
              </div>
              
              {/* PDF Itinerary */}
              {booking.tripItineraryPdf && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200 shadow-sm">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-blue-100 rounded-lg p-3">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 mb-1">Detailed Itinerary PDF</p>
                        <p className="text-sm text-blue-700 mb-2">Complete trip plan with all details, schedules, and important information</p>
                        <p className="text-xs text-blue-600">Click below to view or download</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={booking.tripItineraryPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </a>
                      <a
                        href={booking.tripItineraryPdf}
                        download
                        className="flex items-center px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </div>
                  </div>
                  
                  {/* PDF Preview Embed */}
                  <div className="mt-4 rounded-lg overflow-hidden border border-blue-200 bg-white">
                    <iframe
                      src={`${booking.tripItineraryPdf}#toolbar=0&navpanes=0&scrollbar=0`}
                      className="w-full h-96"
                      title="Itinerary PDF Preview"
                    />
                  </div>
                </div>
              )}

              {/* Text Itinerary */}
              {booking.tripItinerary && (
                <div className="bg-gradient-to-br from-forest-50 to-nature-50 rounded-xl p-6 mb-6 border border-forest-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-forest-100 rounded-lg p-2">
                      <FileText className="w-5 h-5 text-forest-600" />
                    </div>
                    <h4 className="font-semibold text-forest-800 text-lg">Itinerary Overview</h4>
                  </div>
                  <div className="bg-white rounded-lg p-5 border border-forest-200">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{booking.tripItinerary}</p>
                  </div>
                </div>
              )}

              {/* Schedule */}
              {booking.tripSchedule && booking.tripSchedule.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-nature-100 rounded-lg p-2">
                      <Calendar className="w-5 h-5 text-nature-600" />
                    </div>
                    <h4 className="font-semibold text-forest-800 text-lg">Day-wise Schedule</h4>
                  </div>
                  <div className="space-y-4">
                    {booking.tripSchedule.map((day, index) => (
                      <div key={index} className="border-2 border-gray-200 rounded-xl p-5 hover:border-nature-300 transition-colors bg-white shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="bg-nature-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                            {day.day}
                          </div>
                          <h5 className="font-semibold text-forest-800 text-lg">{day.title}</h5>
                        </div>
                        <ul className="space-y-2 ml-4">
                          {day.activities.map((activity, actIndex) => (
                            <li key={actIndex} className="text-gray-700 flex items-start group">
                              <span className="w-2 h-2 bg-nature-500 rounded-full mt-2 mr-3 flex-shrink-0 group-hover:scale-150 transition-transform"></span>
                              <span className="flex-1">{activity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!booking.tripItinerary && !booking.tripItineraryPdf && (!booking.tripSchedule || booking.tripSchedule.length === 0) && (
                <div className="text-center py-16 bg-gray-50 rounded-xl">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">No itinerary information available</p>
                  <p className="text-sm text-gray-500">The organizer will provide itinerary details soon</p>
                </div>
              )}
            </div>
          )}
          
          {/* Fullscreen Image Modal */}
          {isFullscreen && allImages.length > 0 && (
            <div className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex items-center justify-center p-4">
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2"
                aria-label="Close fullscreen"
              >
                <X className="w-8 h-8" />
              </button>
              
              <div className="relative max-w-7xl w-full h-full flex items-center justify-center">
                <img
                  src={allImages[selectedImageIndex]}
                  alt={`${booking.tripTitle} ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
                
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-4 transition-all backdrop-blur-sm"
                    >
                      <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-4 transition-all backdrop-blur-sm"
                    >
                      <ChevronRight className="w-8 h-8" />
                    </button>
                    
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-full text-lg font-medium backdrop-blur-sm">
                      {selectedImageIndex + 1} / {allImages.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-forest-800">Payment Information</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-forest-800 mb-3">Payment Details</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Number of Guests:</span>
                      <span className="font-medium">{booking.numberOfGuests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price per Person:</span>
                      <span className="font-medium">₹{booking.pricePerPerson.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-3">
                      <span className="text-forest-800">Total Amount:</span>
                      <span className="text-nature-600">₹{booking.totalAmount.toLocaleString()}</span>
                    </div>
                    {booking.selectedPackage && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Package:</span>
                        <span className="font-medium">{booking.selectedPackage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-forest-800 mb-3">Payment Status</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-600 mb-1">Booking Status</p>
                      {getStatusBadge(booking.bookingStatus)}
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Payment Status</p>
                      {getPaymentStatusBadge(booking.paymentStatus, booking.paymentVerificationStatus)}
                    </div>
                    <div>
                      <p className="text-gray-600">Payment Method</p>
                      <p className="font-medium capitalize">{booking.paymentMethod.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Screenshot */}
              {booking.paymentScreenshot && (
                <div>
                  <h4 className="font-medium text-forest-800 mb-3">Payment Screenshot</h4>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-forest-800">Uploaded Screenshot</p>
                        <p className="text-sm text-gray-600">
                          Uploaded on {new Date(booking.paymentScreenshot.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <a
                        href={booking.paymentScreenshot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-3 py-1 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors text-sm"
                      >
                        <ImageIcon className="w-4 h-4 mr-1" />
                        View
                      </a>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={booking.paymentScreenshot.url}
                        alt="Payment Screenshot"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Verification Notes */}
              {booking.paymentVerificationNotes && (
                <div>
                  <h4 className="font-medium text-forest-800 mb-3">Verification Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{booking.paymentVerificationNotes}</p>
                  </div>
                </div>
              )}

              {/* Special Requests */}
              {booking.specialRequests && (
                <div>
                  <h4 className="font-medium text-forest-800 mb-3">Special Requests</h4>
                  <div className="bg-forest-50 rounded-lg p-4">
                    <p className="text-gray-700">{booking.specialRequests}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
