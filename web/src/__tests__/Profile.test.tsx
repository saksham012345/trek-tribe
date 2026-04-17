import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from '../pages/Profile';
import api from '../config/api';

jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockUser = {
  id: 'u1',
  name: 'Saksham',
  email: 'saksham@trektribe.com',
  phone: '9876543210',
  role: 'organizer' as const,
  location: 'Delhi',
  bio: 'Love the mountains',
  profilePhoto: null,
  emailVerified: true,
};

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    updateUser: jest.fn(),
  }),
}));

jest.mock('../components/AIAnalyticsDashboard', () => {
  return function MockAIDashboard() {
    return <div data-testid="ai-analytics">AI Analytics</div>;
  };
});

jest.mock('../utils/url', () => ({
  getSafeUrl: (url: string) => url,
}));

const mockTrips = [
  {
    _id: 'trip1', title: 'Manali Expedition', description: 'Snow capped peaks',
    destination: 'Manali', price: 15000, capacity: 10, participants: ['u2'],
    categories: ['Mountain'], organizerId: 'u1', status: 'active',
  },
];

describe('Profile Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: mockTrips });
  });

  const renderProfile = () => render(<Profile user={mockUser as any} />);

  test('renders profile header and account info', async () => {
    renderProfile();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Manage your account and view your trips')).toBeInTheDocument();
  });

  test('displays user name and email', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('Saksham')).toBeInTheDocument();
      expect(screen.getByText('saksham@trektribe.com')).toBeInTheDocument();
    });
  });

  test('displays user role with icon', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText(/organizer/i)).toBeInTheDocument();
    });
  });

  test('shows organizer-specific trip heading', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('My Created Trips')).toBeInTheDocument();
    });
  });

  test('displays organized trips', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('Manali Expedition')).toBeInTheDocument();
      expect(screen.getByText('Snow capped peaks')).toBeInTheDocument();
    });
  });

  test('shows edit button and enters edit mode', async () => {
    renderProfile();
    const editBtn = screen.getByText(/Edit Profile/i);
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/Save Changes/i)).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  test('cancel edit resets form', async () => {
    renderProfile();
    fireEvent.click(screen.getByText(/Edit Profile/i));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.getByText(/Edit Profile/i)).toBeInTheDocument();
    });
  });

  test('renders AI Analytics section', async () => {
    renderProfile();
    expect(screen.getByText('🧠 AI Travel Insights')).toBeInTheDocument();
    expect(screen.getByTestId('ai-analytics')).toBeInTheDocument();
  });

  test('shows empty state when no trips exist', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ data: [] });
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('No trips created yet')).toBeInTheDocument();
    });
  });

  test('displays user initials when no photo is set', async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText('S')).toBeInTheDocument(); // First letter of "Saksham"
    });
  });
});
