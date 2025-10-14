import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Users, DollarSign, FileText, Image as ImageIcon, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}/details`);
      setBooking(response.data.booking);
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
    ...booking.tripImages
  ] : [];

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
              <h3 className="text-lg font-semibold text-forest-800">Trip Images</h3>
              
              {allImages.length > 0 ? (
                <div>
                  {/* Main Image Display */}
                  <div className="relative mb-4">
                    <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={allImages[selectedImageIndex]}
                        alt={`${booking.tripTitle} ${selectedImageIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Navigation Arrows */}
                    {allImages.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}
                    
                    {/* Image Counter */}
                    <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                      {selectedImageIndex + 1} / {allImages.length}
                    </div>
                  </div>

                  {/* Thumbnail Grid */}
                  {allImages.length > 1 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {allImages.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImageIndex === index 
                              ? 'border-nature-500 ring-2 ring-nature-200' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${booking.tripTitle} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No images available for this trip</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-forest-800">Trip Itinerary</h3>
              
              {/* PDF Itinerary */}
              {booking.tripItineraryPdf && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-blue-600 mr-3" />
                      <div>
                        <p className="font-medium text-blue-800">Detailed Itinerary PDF</p>
                        <p className="text-sm text-blue-600">Download the complete trip itinerary</p>
                      </div>
                    </div>
                    <a
                      href={booking.tripItineraryPdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {/* Text Itinerary */}
              {booking.tripItinerary && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-forest-800 mb-3">Itinerary Overview</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{booking.tripItinerary}</p>
                </div>
              )}

              {/* Schedule */}
              {booking.tripSchedule && booking.tripSchedule.length > 0 && (
                <div>
                  <h4 className="font-medium text-forest-800 mb-4">Day-wise Schedule</h4>
                  <div className="space-y-4">
                    {booking.tripSchedule.map((day, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-semibold text-forest-800 mb-2">Day {day.day}: {day.title}</h5>
                        <ul className="space-y-1">
                          {day.activities.map((activity, actIndex) => (
                            <li key={actIndex} className="text-gray-700 flex items-start">
                              <span className="w-2 h-2 bg-nature-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              {activity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!booking.tripItinerary && !booking.tripItineraryPdf && (!booking.tripSchedule || booking.tripSchedule.length === 0) && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No itinerary information available</p>
                </div>
              )}
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
