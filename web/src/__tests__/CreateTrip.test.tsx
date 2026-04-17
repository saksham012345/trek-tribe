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
    render(<OrganizerDashboardNew user={mockUser as any} />);

    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Trip Dashboard')).toBeInTheDocument();
    });
  });

  test('clicking Create Trip opens the modal', async () => {
    render(<OrganizerDashboardNew user={mockUser as any} />);

    await waitFor(() => {
      expect(screen.getByText('Trip Dashboard')).toBeInTheDocument();
    });

    const createBtn = screen.getByText('Create Trip');
    fireEvent.click(createBtn);

    expect(screen.getByText('Create New Trip / Post')).toBeInTheDocument();
    expect(screen.getByText('Save Draft')).toBeInTheDocument();
    expect(screen.getByText('Publish Trip')).toBeInTheDocument();
  });

  test('renders empty state when no trips are present', async () => {
    render(<OrganizerDashboardNew user={mockUser as any} />);

    await waitFor(() => {
      expect(screen.getByText('No trips created yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first adventure to get started.')).toBeInTheDocument();
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
      participants: []
    }];
    (api.get as jest.Mock).mockResolvedValueOnce({ data: mockTrips });

    render(<OrganizerDashboardNew user={mockUser as any} />);

    await waitFor(() => {
      expect(screen.getByText('Himalayan Trek')).toBeInTheDocument();
      expect(screen.getByText(/Himalayas/)).toBeInTheDocument();
      // Test the newly added "Duplicate" button is present
      const optionsBtn = screen.getByTitle('Options');
      expect(optionsBtn).toBeInTheDocument();
    });
  });
});
