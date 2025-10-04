export interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin' | 'agent';
}

export interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  participants: string[];
  categories: string[];
  images: string[];
  organizerId: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface Booking {
  _id: string;
  userId: string;
  tripId: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  participants: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'agent';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  userId?: string;
  messages: Message[];
  isEscalated: boolean;
  agentId?: string;
  status: 'active' | 'resolved' | 'pending';
}