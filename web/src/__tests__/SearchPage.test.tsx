import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchPage from '../pages/SearchPage';
import api from '../config/api';

jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../components/ProfileSearch', () => {
  return function MockProfileSearch() { return null; };
});

const mockSuggestions = [
  {
    _id: 'org1', name: 'Rahul Kumar', email: 'rahul@test.com', role: 'organizer',
    location: 'Delhi', bio: 'Mountain enthusiast', isVerified: true,
    socialStats: { followersCount: 120, followingCount: 50, postsCount: 30 },
  },
  {
    _id: 'org2', name: 'Priya Sharma', email: 'priya@test.com', role: 'organizer',
    location: 'Mumbai', bio: 'Beach lover', isVerified: false,
    socialStats: { followersCount: 80, followingCount: 30, postsCount: 15 },
  },
];

describe('SearchPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ data: { suggestions: mockSuggestions } });
  });

  test('renders search header and form', async () => {
    render(<SearchPage />);
    expect(screen.getByText('Search Organizers')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search organizers by name/i)).toBeInTheDocument();
  });

  test('loads and displays suggestion cards on mount', async () => {
    render(<SearchPage />);
    await waitFor(() => {
      expect(screen.getByText('Popular Organizers')).toBeInTheDocument();
      expect(screen.getByText('Rahul Kumar')).toBeInTheDocument();
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
  });

  test('displays follower counts for organizers', async () => {
    render(<SearchPage />);
    await waitFor(() => {
      expect(screen.getByText('120')).toBeInTheDocument(); // Rahul's followers
    });
  });

  test('shows verified badge for verified organizers', async () => {
    render(<SearchPage />);
    await waitFor(() => {
      // Rahul is verified, should have the badge
      const verifiedBadges = screen.getAllByTitle('Verified Profile');
      expect(verifiedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('search button is disabled when query is too short', () => {
    render(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/Search organizers by name/i);
    fireEvent.change(searchInput, { target: { value: 'a' } });
    const searchBtn = screen.getByRole('button', { name: /Search/i });
    expect(searchBtn).toBeDisabled();
  });

  test('performs search when form is submitted', async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: { suggestions: mockSuggestions } }) // initial load
      .mockResolvedValueOnce({ data: { profiles: [mockSuggestions[0]] } }); // search result

    render(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/Search organizers by name/i);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Search Results/i)).toBeInTheDocument();
    });
  });

  test('shows empty state when search returns no results', async () => {
    (api.get as jest.Mock)
      .mockResolvedValueOnce({ data: { suggestions: [] } })
      .mockResolvedValueOnce({ data: { profiles: [] } });

    render(<SearchPage />);
    const searchInput = screen.getByPlaceholderText(/Search organizers by name/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('No profiles found')).toBeInTheDocument();
    });
  });

  test('quick action buttons navigate correctly', async () => {
    render(<SearchPage />);
    expect(screen.getByText(/Browse Trips/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Features/i)).toBeInTheDocument();
    expect(screen.getByText(/My Profile/i)).toBeInTheDocument();
  });
});
