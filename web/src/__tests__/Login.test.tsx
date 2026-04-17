import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/Login';

// Mock the Auth context
const mockUser = null;
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
  }),
}));

// Mock Toast
jest.mock('../components/Toast', () => ({
  useToast: () => ({
    toasts: [],
    success: jest.fn(),
    error: jest.fn(),
    removeToast: jest.fn(),
  }),
  ToastContainer: () => null,
}));

// Mock Google Login
jest.mock('../components/GoogleLoginButton', () => {
  return function MockGoogleButton(props: any) {
    return <button data-testid="google-login-btn">Google Login</button>;
  };
});

describe('Login Component', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnLogin.mockReset();
  });

  const renderLogin = () => render(<Login onLogin={mockOnLogin} />);

  test('renders login form with all expected elements', () => {
    renderLogin();
    expect(screen.getByText(/Welcome Back,/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/username or you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter the Tribe/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot your password/i)).toBeInTheDocument();
    expect(screen.getByText(/Join our community/i)).toBeInTheDocument();
  });

  test('renders Google login button when user is not logged in', () => {
    renderLogin();
    expect(screen.getByTestId('google-login-btn')).toBeInTheDocument();
  });

  test('shows validation error when email is empty', async () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    fireEvent.change(passwordInput, { target: { value: 'validpass' } });
    fireEvent.click(screen.getByText(/Enter the Tribe/i));
    await waitFor(() => {
      expect(screen.getByText('Email or username is required')).toBeInTheDocument();
    });
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('shows validation error when password is too short', async () => {
    renderLogin();
    const emailInput = screen.getByPlaceholderText(/username or you@example\.com/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText(/Enter the Tribe/i));
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test('calls onLogin with correct credentials on valid submission', async () => {
    mockOnLogin.mockResolvedValueOnce({ success: true });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/username or you@example\.com/i), { target: { value: 'user@trektribe.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Enter the Tribe/i));
    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('user@trektribe.com', 'password123');
    });
  });

  test('displays error message when login fails', async () => {
    mockOnLogin.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/username or you@example\.com/i), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByText(/Enter the Tribe/i));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  test('shows loading state during submission', async () => {
    // Make onLogin hang so we can observe loading state
    mockOnLogin.mockImplementation(() => new Promise(() => {}));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/username or you@example\.com/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Enter the Tribe/i));
    await waitFor(() => {
      expect(screen.getByText(/Entering the wilderness/i)).toBeInTheDocument();
    });
  });

  test('password toggle shows/hides password', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    const toggleBtn = screen.getByLabelText(/Show password/i);
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');
  });
});
