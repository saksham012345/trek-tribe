import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OrganizerDashboardNew from '../pages/OrganizerDashboardNew';
import api from '../config/api';

jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockUser = {
  id: 'org1',
  name: 'Org Manager',
  role: 'organizer',
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

// Mock the DashboardLayout
jest.mock('../layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

describe('OrganizerDashboardNew: Create & Duplicate Trip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  test('renders dashboard layout and header', async () => {
    (api.get as jest.Mock).mockResolvedValue({ 
      data: {
        stats: { trips: { total: 0, active: 0, upcoming: 0, completed: 0 }, bookings: { total: 0, pending: 0, confirmed: 0, cancelled: 0 }, revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 }, participants: { total: 0, thisMonth: 0 } },
        autoPay: { isSetup: false, subscriptionActive: false, listingsRemaining: 0 },
        subscription: { isActive: false, tripsPublished: 0, tripsLimit: 5 },
        alerts: [],
        quickActions: [],
        recentTrips: [],
        recentBookings: []
      }
    });

    render(<OrganizerDashboardNew />);

    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText(/Organizer Dashboard/)).toBeInTheDocument();
    });
  });

  test('clicking Create Trip opens the modal', async () => {
    (api.get as jest.Mock).mockResolvedValue({ 
      data: {
        stats: { trips: { total: 0, active: 0, upcoming: 0, completed: 0 }, bookings: { total: 0, pending: 0, confirmed: 0, cancelled: 0 }, revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 }, participants: { total: 0, thisMonth: 0 } },
        autoPay: { isSetup: false, subscriptionActive: false, listingsRemaining: 0 },
        subscription: { isActive: false, tripsPublished: 0, tripsLimit: 5 },
        alerts: [],
        quickActions: [],
        recentTrips: [],
        recentBookings: []
      }
    });

    render(<OrganizerDashboardNew />);

    await waitFor(() => {
      expect(screen.getByText(/Organizer Dashboard/)).toBeInTheDocument();
    });

    const createBtn = screen.getByText('Create New Trip');
    fireEvent.click(createBtn);

    // The component redirects to /create-trip, it doesn't open a modal anymore
    expect((global as any).__mockNavigate).toHaveBeenCalledWith('/create-trip');
  });

  test('renders empty state when no trips are present', async () => {
    (api.get as jest.Mock).mockResolvedValue({ 
      data: {
        stats: { trips: { total: 0, active: 0, upcoming: 0, completed: 0 }, bookings: { total: 0, pending: 0, confirmed: 0, cancelled: 0 }, revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 }, participants: { total: 0, thisMonth: 0 } },
        autoPay: { isSetup: false, subscriptionActive: false, listingsRemaining: 0 },
        subscription: { isActive: false, tripsPublished: 0, tripsLimit: 5 },
        alerts: [],
        quickActions: [],
        recentTrips: [],
        recentBookings: []
      }
    });

    render(<OrganizerDashboardNew />);

    await waitFor(() => {
      expect(screen.getByText('No trips yet')).toBeInTheDocument();
    });
  });

  test('displays trips when fetched successfully', async () => {
    const mockTrips = [{
      _id: 'trip1',
      title: 'Himalayan Trek',
      destination: 'Himalayas',
      startDate: '2027-01-01',
      endDate: '2027-01-10',
      price: 50000,
      status: 'active',
      participants: 5,
      capacity: 20
    }];

    const mockDashboardData = {
      stats: {
        trips: { total: 1, active: 1, upcoming: 1, completed: 0 },
        bookings: { total: 0, pending: 0, confirmed: 0, cancelled: 0 },
        revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
        participants: { total: 0, thisMonth: 0 }
      },
      autoPay: { isSetup: true, subscriptionActive: true, listingsRemaining: 10 },
      subscription: { isActive: true, tripsPublished: 1, tripsLimit: 10 },
      alerts: [],
      quickActions: [],
      recentTrips: mockTrips,
      recentBookings: []
    };

    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockDashboardData });

    render(<OrganizerDashboardNew />);

    await waitFor(() => {
      expect(screen.getByText('Himalayan Trek')).toBeInTheDocument();
      // Use getAllByText for Himalayas since it might appear in multiple places or as partial match
      expect(screen.getByText(/Himalayas/)).toBeInTheDocument();
      // Test the newly added "Duplicate" button is present
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
    });
  });
});
