export interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin' | 'agent';
  uniqueUrl?: string;
  phone?: string;
  phoneVerified?: boolean;
  profilePhoto?: string;
  location?: string;
  bio?: string;
  organizerProfile?: {
    uniqueUrl?: string;
  };
  createdAt: string;
}

export interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  participants: string[];
  startDate: string;
  endDate: string;
  categories: string[];
  coverImage?: string;
  images?: string[];
  itinerary?: string;
  itineraryPdf?: string;
  status: 'active' | 'cancelled' | 'completed';
  organizerId: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  _id: string;
  title: string;
  comment: string;
  rating: number;
  reviewType: 'trip' | 'organizer';
  targetId: string;
  reviewerId: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

export interface BookingData {
  tripId: string;
  numberOfTravelers: number;
  travelerDetails?: {
    name: string;
    age: number;
    phone: string;
    emergencyContact?: string;
    medicalConditions?: string;
    dietary?: string;
  }[];
  specialRequests?: string;
  contactPhone: string;
}