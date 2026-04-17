import React from 'react';
import '@testing-library/jest-dom';

// Global mock for react-router-dom (v7 ESM compat issues with CRA Jest)
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/', search: '', hash: '', state: null };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  BrowserRouter: ({ children }: { children: any }) => children,
  Link: ({ children, to, ...props }: any) => require('react').createElement('a', { href: to, ...props }, children),
}));

// Global mock for socket.io-client (prevents real connections in tests)
jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    connected: false,
    id: 'mock-socket-id',
  })),
}));

// Expose mock navigate for test assertions
(global as any).__mockNavigate = mockNavigate;
(global as any).__mockLocation = mockLocation;
