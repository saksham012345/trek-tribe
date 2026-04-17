import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIChatWidgetClean from '../components/AIChatWidgetClean';
import api from '../config/api';

jest.mock('../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', name: 'Test User', role: 'traveler' },
    loading: false,
  }),
}));

// Mock the CSS import
jest.mock('../components/AIChatWidget.css', () => ({}));

describe('AIChatWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders the toggle button when closed', () => {
    render(<AIChatWidgetClean />);
    const toggle = screen.getByTitle('Open Trek Tribe Assistant');
    expect(toggle).toBeInTheDocument();
  });

  test('opens the chat panel when toggle is clicked', () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));
    expect(screen.getByText('TrekTribe AI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask me anything...')).toBeInTheDocument();
  });

  test('renders action buttons when opened', () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));
    expect(screen.getByText('🚀 Recommendations')).toBeInTheDocument();
    expect(screen.getByText('📅 Availability')).toBeInTheDocument();
    expect(screen.getByText('📊 My Stats')).toBeInTheDocument();
    expect(screen.getByText(/Human Agent/i)).toBeInTheDocument();
  });

  test('shows beta warning when chat is opened', () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));
    expect(screen.getByText(/Feature in Beta/i)).toBeInTheDocument();
  });

  test('closes chat when close button is clicked', () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));
    expect(screen.getByText('TrekTribe AI')).toBeInTheDocument();

    // Find the close button (the X svg button)
    const closeBtn = screen.getByText('TrekTribe AI').closest('.glass-header')?.querySelector('.chat-close-btn');
    if (closeBtn) fireEvent.click(closeBtn);

    // Should show toggle again
    expect(screen.getByTitle('Open Trek Tribe Assistant')).toBeInTheDocument();
  });

  test('sends a user message and displays it', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({
      data: { message: 'Here are some great trips!' },
    });

    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));

    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, { target: { value: 'Find me a trek' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Find me a trek')).toBeInTheDocument();
    });
  });

  test('handles local greetings without API call', async () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));

    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // User message should appear
    await waitFor(() => {
      expect(screen.getByText('hello')).toBeInTheDocument();
    });

    // AI should respond with greeting (no API call)
    await waitFor(() => {
      const aiMessages = screen.getAllByText(/How can I help|I'm here to help|Looking for a getaway/i);
      expect(aiMessages.length).toBeGreaterThanOrEqual(1);
    }, { timeout: 2000 });

    expect(api.post).not.toHaveBeenCalled();
  });

  test('shows preference modal when Availability is clicked', () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));
    fireEvent.click(screen.getByText('📅 Availability'));

    expect(screen.getByText('Refine Trip Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Himachal, Goa/i)).toBeInTheDocument();
  });

  test('persists messages to localStorage', async () => {
    render(<AIChatWidgetClean />);
    fireEvent.click(screen.getByTitle('Open Trek Tribe Assistant'));

    const input = screen.getByPlaceholderText('Ask me anything...');
    fireEvent.change(input, { target: { value: 'test persistence' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      const stored = localStorage.getItem('chatMessages_test-user');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
    });
  });
});
