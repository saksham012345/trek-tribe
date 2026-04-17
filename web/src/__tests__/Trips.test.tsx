import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import Trips from '../pages/Trips';
import api from '../config/api';

// Mock API
jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock layout & components to isolate Trips logic
jest.mock('../layout/ConsumerLayout', () => ({
  ConsumerLayout: ({ children }: any) => <div data-testid="consumer-layout">{children}</div>,
}));

jest.mock('../components/features/TripCard', () => ({
  TripCard: ({ trip }: any) => <div data-testid={`trip-card-${trip._id}`}>{trip.title}</div>,
}));

jest.mock('../components/JoinTripModal', () => {
  return function MockJoinModal() { return null; };
});

jest.mock('../components/AISmartSearch', () => {
  return function MockAISearch() { return null; };
});

jest.mock('../components/AIRecommendations', () => {
  return function MockAIRecs() { return null; };
});

const mockTrips = [
  {
    _id: 't1', title: 'Himalayan Trek', description: 'Epic expedition', destination: 'Himalayas',
    price: 45000, capacity: 15, participants: ['u1', 'u2'], categories: ['Mountain', 'Adventure'],
    images: [], organizerId: 'org1', status: 'active', startDate: '2027-02-01', endDate: '2027-02-10',
  },
  {
    _id: 't2', title: 'Goa Beach Week', description: 'Relax by the sea', destination: 'Goa',
    price: 20000, capacity: 20, participants: [], categories: ['Beach'],
    images: [], organizerId: 'org2', status: 'active', startDate: '2027-03-15', endDate: '2027-03-20',
  },
];

describe('Trips Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTrips = (user: any = null) => {
    return render(
      <HelmetProvider>
        <Trips user={user} />
      </HelmetProvider>
    );
  };

  test('renders the discovery header', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });
    renderTrips();
    expect(screen.getByText(/Discover Your Next/i)).toBeInTheDocument();
  });

  test('renders within ConsumerLayout', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });
    renderTrips();
    expect(screen.getByTestId('consumer-layout')).toBeInTheDocument();
  });

  test('renders category filter chips', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });
    renderTrips();
    expect(screen.getByText('🧭 All')).toBeInTheDocument();
    expect(screen.getByText(/Adventure/i)).toBeInTheDocument();
    expect(screen.getByText(/Beach/i)).toBeInTheDocument();
    expect(screen.getByText(/Mountain/i)).toBeInTheDocument();
  });

  test('fetches and displays trip cards', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: mockTrips } });
    renderTrips();

    await waitFor(() => {
      expect(screen.getByTestId('trip-card-t1')).toBeInTheDocument();
      expect(screen.getByTestId('trip-card-t2')).toBeInTheDocument();
      expect(screen.getByText('Himalayan Trek')).toBeInTheDocument();
      expect(screen.getByText('Goa Beach Week')).toBeInTheDocument();
    });
  });

  test('displays empty state when no trips found', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });
    renderTrips();

    await waitFor(() => {
      expect(screen.getByText('No adventures found')).toBeInTheDocument();
    });
  });

  test('handles API returning trips as a flat array', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockTrips });
    renderTrips();

    await waitFor(() => {
      expect(screen.getByTestId('trip-card-t1')).toBeInTheDocument();
    });
  });

  test('search input filters trips', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: mockTrips } });
    renderTrips();

    const searchInput = screen.getByPlaceholderText('Where to?');
    fireEvent.change(searchInput, { target: { value: 'Himalaya' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
  });

  test('advanced filters toggle works', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });
    renderTrips();

    const filterButton = screen.getByText(/Advanced Filters/i);
    fireEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText(/Max Price/i)).toBeInTheDocument();
    });
  });
});
