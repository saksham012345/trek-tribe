import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TripDetails from '../pages/TripDetails';
import api from '../config/api';

jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: () => ({ id: 'trip123' }),
    useNavigate: () => jest.fn(),
}));

const mockUser = {
  id: 'u1',
  name: 'Saksham',
  role: 'traveler',
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

const mockTrip = {
  _id: 'trip123',
  title: 'Everest Base Camp',
  description: 'A 14-day majestic trek to Everest Base Camp.',
  destination: 'Nepal',
  price: 60000,
  capacity: 15,
  participants: ['u2', 'u3'],
  categories: ['Trekking', 'Mountain'],
  images: [],
  organizerId: 'org1',
  status: 'active',
  startDate: '2027-04-01',
  endDate: '2027-04-14',
  meetingPoint: 'Kathmandu Airport',
  includedItems: ['Accommodation', 'Meals', 'Guide'],
  packingList: ['Warm clothes', 'Trekking poles'],
  organizer: {
    name: 'Mountaineer Org',
    bio: 'Expert mountain guides',
  }
};

describe('TripDetails Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTripDetails = () => {
    return render(<TripDetails />);
  };

  test('shows loading state initially', () => {
    (api.get as jest.Mock).mockReturnValue(new Promise(() => {})); // pending promise
    renderTripDetails();
    expect(screen.getByText(/Wait, setting up your itinerary/i)).toBeInTheDocument();
  });

  test('renders trip details after successful fetch', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockTrip });
    renderTripDetails();

    await waitFor(() => {
      expect(screen.getByText('Everest Base Camp')).toBeInTheDocument();
      expect(screen.getByText('A 14-day majestic trek to Everest Base Camp.')).toBeInTheDocument();
      expect(screen.getByText('Mountaineer Org')).toBeInTheDocument();
    });
  });

  test('displays trip price and capacity', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockTrip });
    renderTripDetails();

    await waitFor(() => {
      // 60,000 formatted
      expect(screen.getByText(/60,000/)).toBeInTheDocument();
      expect(screen.getByText(/2 \/ 15 joined/)).toBeInTheDocument();
    });
  });

  test('displays included items', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockTrip });
    renderTripDetails();

    await waitFor(() => {
      expect(screen.getByText('Accommodation')).toBeInTheDocument();
      expect(screen.getByText('Meals')).toBeInTheDocument();
    });
  });

  test('renders error state on API failure', async () => {
    (api.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    renderTripDetails();

    await waitFor(() => {
      expect(screen.getByText(/Trip not found/i)).toBeInTheDocument();
    });
  });
});
