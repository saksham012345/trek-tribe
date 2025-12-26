# 🔐 PRODUCTION SECURITY & PERFORMANCE FIX GUIDE

**Status:** BLOCKING ISSUES - MUST FIX BEFORE PRODUCTION  
**Updated:** December 24, 2025  
**Severity:** CRITICAL (Security), HIGH (Performance)  

---

## 📋 Executive Summary

The application has **7 blocking issues** preventing production deployment:

| Priority | Issue | Severity | Est. Time |
|----------|-------|----------|-----------|
| 1 | JWT in localStorage (XSS/hijacking) | 🔴 CRITICAL | 2 hours |
| 2 | Weak password validation | 🔴 CRITICAL | 1 hour |
| 3 | Missing CSP headers | 🔴 CRITICAL | 30 min |
| 4 | Frontend RBAC leakage | 🔴 CRITICAL | 1.5 hours |
| 5 | AI conversation context loss | 🟠 HIGH | 1 hour |
| 6 | Missing AI error handling | 🟠 HIGH | 1 hour |
| 7 | Performance: No caching/lazy loading | 🟠 HIGH | 2 hours |

**Total Estimated Fix Time:** ~8.5 hours  

---

# PRIORITY 1: JWT AUTHENTICATION (CRITICAL)

## Issue: Vulnerable JWT Storage

### Current Problem
```typescript
// ❌ VULNERABLE: web/src/config/api.ts
const token = localStorage.getItem('token'); // XSS Attack Surface!
```

**Risks:**
- ✗ XSS attacks steal JWT from localStorage
- ✗ No HttpOnly flag → JavaScript accessible
- ✗ No Secure flag → Can be transmitted over HTTP
- ✗ Session hijacking possible
- ✗ Malicious JS can impersonate user

### Solution: HttpOnly Secure Cookies

---

## FIX 1A: Backend - Set JWT via HttpOnly Cookie

**File:** `services/api/src/routes/auth.ts`

```typescript
// ✅ SECURE: Generate token and set via HttpOnly cookie
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.flatten(),
        message: 'Invalid email/username or password format.'
      });
    }

    const { email, password } = parsed.data;
    
    // ... validate credentials ...
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const token = jwt.sign(
      { userId: String(user._id), role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // ✅ SET HTTPONLY + SECURE COOKIE
    res.cookie('authToken', token, {
      httpOnly: true,        // ← JavaScript cannot access
      secure: process.env.NODE_ENV === 'production', // ← HTTPS only in prod
      sameSite: 'lax',       // ← CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // ← 7 days
      path: '/',
      domain: process.env.NODE_ENV === 'production' 
        ? '.trektribe.in' 
        : undefined // ← Allow localhost in dev
    });

    // Optional: Also return token in response body for development
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        // Do NOT return token in response when using cookies
      },
      // Indicate to frontend that token is in HttpOnly cookie
      tokenLocation: 'cookie'
    });
  } catch (error) {
    logger.error('Login error', { error });
    return res.status(500).json({ error: 'Login failed' });
  }
});
```

---

## FIX 1B: Backend - Register & OAuth Must Also Set Cookie

**File:** `services/api/src/routes/auth.ts` (Register endpoint)

```typescript
router.post('/register', async (req, res) => {
  // ... validation & user creation ...
  
  const token = jwt.sign(
    { userId: String(user._id), role: user.role },
    jwtSecret,
    { expiresIn: '7d' }
  );

  // ✅ Same secure cookie pattern
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    requiresVerification: true,
    userId: user._id,
    tokenLocation: 'cookie'
  });
});

// Google OAuth callback
router.post('/google-login', async (req, res) => {
  // ... Google token validation ...
  
  const token = jwt.sign(
    { userId: String(user._id), role: user.role },
    jwtSecret,
    { expiresIn: '7d' }
  );

  // ✅ Cookie for OAuth too
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Google login successful',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    tokenLocation: 'cookie'
  });
});
```

---

## FIX 1C: Backend - CORS Configuration for Cookies

**File:** `services/api/src/index.ts`

```typescript
// ✅ Enable credentials in CORS for cookie transmission
import cors from 'cors';

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://trektribe.in', 'https://www.trektribe.in']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true, // ← Allow cookies to be sent/received
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
};

app.use(cors(corsOptions));

// Optional: Preflight for all routes
app.options('*', cors(corsOptions));
```

---

## FIX 1D: Middleware - Extract JWT from Cookie

**File:** `services/api/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // ✅ Try multiple sources for backward compatibility:
  // 1. HttpOnly cookie (primary - secure)
  // 2. Authorization header (fallback - for legacy clients)
  
  let token = req.cookies?.authToken; // ← HttpOnly cookie
  
  // Fallback to Authorization header
  if (!token) {
    const rawAuth = (req.headers.authorization as string) || '';
    if (rawAuth.startsWith('Bearer ')) {
      token = rawAuth.slice(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - Missing or invalid token' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be set and at least 32 characters');
    }

    const payload = jwt.verify(token, secret) as any;
    
    const resolvedId = payload?.id || payload?.userId || payload?.sub || payload?._id;
    const resolvedRole = payload?.role || payload?.roles || undefined;

    if (!resolvedId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    (req as any).auth = {
      userId: resolvedId,
      role: resolvedRole
    };
    (req as any).user = {
      id: resolvedId,
      userId: resolvedId,
      role: resolvedRole
    };

    next();
  } catch (error: any) {
    logger.warn('JWT verification failed', { error: error.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

---

## FIX 1E: Backend - Cookie Parser Middleware

**File:** `services/api/src/index.ts`

```typescript
import cookieParser from 'cookie-parser'; // ← npm install cookie-parser

// Add early in middleware stack (before auth routes)
app.use(cookieParser());

// Should be placed after CORS but before routes
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
```

**Install package:**
```bash
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

---

## FIX 1F: Frontend - Remove localStorage, Use Cookies

**File:** `web/src/contexts/AuthContext.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin' | 'agent';
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setSession: (userData: User) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ On mount, verify session from backend (no localStorage)
  useEffect(() => {
    const verifySession = async () => {
      try {
        // Cookies are automatically sent by browser
        const response = await api.get('/auth/me');
        const userData = response.data?.user || response.data;
        
        if (userData && userData._id) {
          setUser({
            ...userData,
            id: userData._id
          } as User);
        }
      } catch (error) {
        console.log('No active session');
        // Session expired or invalid - user will need to login
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const userData = response.data?.user || response.data;

      if (userData && userData._id) {
        setUser({
          ...userData,
          id: userData._id
        } as User);
        return { success: true };
      }

      return { success: false, error: 'Invalid credentials' };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear cookie on backend
      await api.post('/auth/logout');
    } catch (e) {
      console.warn('Logout endpoint failed, but clearing frontend session');
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data?.user || response.data;

      if (userData && userData._id) {
        setUser({
          ...userData,
          id: userData._id
        } as User);
      }
    } catch (e) {
      console.warn('Failed to refresh user');
      setUser(null);
    }
  };

  const setSession = async (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## FIX 1G: Frontend - API Client Configuration

**File:** `web/src/config/api.ts`

```typescript
import axios from 'axios';
import { apiCache } from '../utils/apiCache';

let API_BASE_URL = process.env.REACT_APP_API_URL || '';

if (!API_BASE_URL) {
  API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.trektribe.in'
    : 'http://localhost:8000';
}

// ✅ Enable credentials (cookies) by default
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // ← Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config: any) => {
    // ✅ No need to add token to headers - it's in the cookie!
    // Only use Authorization header if token is in body (for backward compat)
    
    // Cache logic still applies
    if (config.method === 'get' && 
        !config.url?.includes('/auth') && 
        !config.url?.includes('/payment')) {
      const cachedData = apiCache.get(config.url || '', config.params);
      if (cachedData) {
        return Promise.reject({
          __cached: true,
          data: cachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config
        });
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method === 'get' &&
        !response.config.url?.includes('/auth') &&
        !response.config.url?.includes('/payment') &&
        response.status === 200) {
      
      let ttl = 5 * 60 * 1000; // 5 minutes default
      if (response.config.url?.includes('/trips')) {
        ttl = 10 * 60 * 1000; // 10 minutes
      } else if (response.config.url?.includes('/ai')) {
        ttl = 30 * 60 * 1000; // 30 minutes
      }
      
      apiCache.set(response.config.url || '', response.data, response.config.params, ttl);
    }

    return response;
  },
  (error) => {
    // Handle cached responses
    if (error.__cached) {
      return Promise.resolve(error);
    }

    // ✅ Handle 401 (token expired - browser will auto-clear cookie)
    if (error.response?.status === 401) {
      // Redirect to login if needed
      window.location.href = '/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## FIX 1H: Backend - Logout Endpoint

**File:** `services/api/src/routes/auth.ts`

```typescript
router.post('/logout', (req, res) => {
  // ✅ Clear the HttpOnly cookie
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});
```

---

## FIX 1I: Migration Strategy for Existing Users

**Deployment Steps:**

1. **Week 1:** Deploy with dual support (both localStorage & cookies)
   - Backend accepts both sources
   - Frontend still reads localStorage if needed
   - New logins use cookies

2. **Week 2:** Monitor logs for adoption
   - Most users should be on cookies
   - Force re-login for old token users if > 1 week old

3. **Week 3:** Remove localStorage entirely
   - Stop accepting Auth header (except API integrations)
   - Focus on cookie-based auth only

**Code for dual support:**
```typescript
// Temporary: Accept both methods during migration
const token = req.cookies?.authToken || 
              req.headers.authorization?.split(' ')[1];

// After migration period: Remove second condition
const token = req.cookies?.authToken;
```

---

# PRIORITY 2: PASSWORD VALIDATION (CRITICAL)

## Issue: Weak Password Requirements

### Current Problem
```typescript
// ❌ WEAK: Current validation is minimal
const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1) // ← Too weak!
});
```

### Solution: Enforce Strong Passwords

---

## FIX 2A: Backend - Strong Password Validation

**File:** `services/api/src/routes/auth.ts`

```typescript
import { z } from 'zod';

// ✅ Strong password schema with specific requirements
const strongPasswordSchema = z.string()
  .min(10, { message: 'Password must be at least 10 characters long.' })
  .max(128, { message: 'Password must be less than 128 characters.' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.' })
  .refine((password) => {
    // Block common weak passwords
    const commonPasswords = new Set([
      'password', 'password1', 'password123', '123456', '123456789',
      'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'abc123',
      'monkey', 'dragon', 'football', 'baseball', 'trustno1'
    ]);
    return !commonPasswords.has(password.toLowerCase());
  }, { message: 'This password is too common. Please choose a stronger one.' });

const registerSchema = z.object({
  email: z.string().email({ message: 'Invalid email format.' }),
  password: strongPasswordSchema,
  name: z.string().min(1),
  // ... other fields
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1) // Login doesn't need validation, just presence
});

// Apply during registration
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
      message: parsed.error.issues
        .map(issue => issue.message)
        .join(' ')
    });
  }
  
  // ... create user
});
```

---

## FIX 2B: Frontend - Password Strength Meter

**File:** `web/src/pages/Register.tsx`

```typescript
import React, { useState } from 'react';

const Register: React.FC = () => {
  const [password, setPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    feedback: string[];
    passed: boolean[];
  }>({ score: 0, feedback: [], passed: [] });

  // ✅ Real-time password validation
  const validatePassword = (pwd: string) => {
    const checks = [
      { test: pwd.length >= 10, message: 'At least 10 characters' },
      { test: /[A-Z]/.test(pwd), message: 'One uppercase letter' },
      { test: /[a-z]/.test(pwd), message: 'One lowercase letter' },
      { test: /[0-9]/.test(pwd), message: 'One number' },
      { test: /[^A-Za-z0-9]/.test(pwd), message: 'One special character (!@#$%^&*)' }
    ];

    const passed = checks.map(c => c.test);
    const score = passed.filter(Boolean).length;
    const feedback = checks.map(c => c.message);

    setPasswordStrength({
      score,
      feedback,
      passed
    });

    return score === checks.length;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    validatePassword(value);
  };

  // ✅ Render strength meter
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Create a strong password"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Password Strength Meter */}
      {password && (
        <div className="space-y-2">
          {/* Strength bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                strengthColors[Math.min(passwordStrength.score, 4)]
              }`}
              style={{
                width: `${(passwordStrength.score / 5) * 100}%`
              }}
            />
          </div>

          {/* Strength label */}
          <p className="text-sm font-medium">
            Strength:{' '}
            <span className={passwordStrength.score < 3 ? 'text-red-600' : 'text-green-600'}>
              {strengthLabels[Math.min(passwordStrength.score, 4)]}
            </span>
          </p>

          {/* Requirements checklist */}
          <div className="space-y-1">
            {passwordStrength.feedback.map((msg, idx) => (
              <div
                key={idx}
                className={`text-sm flex items-center gap-2 ${
                  passwordStrength.passed[idx] ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <span>{passwordStrength.passed[idx] ? '✓' : '○'}</span>
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!passwordStrength.passed.every(Boolean)}
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          passwordStrength.passed.every(Boolean)
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        Register
      </button>
    </div>
  );
};
```

---

## FIX 2C: Frontend - Password Reset Validation

**File:** `web/src/components/auth/ResetPassword.tsx`

```typescript
const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  
  if (password.length < 10) {
    errors.push('Password must be at least 10 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
};

// In form submission:
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const errors = validatePassword(formData.newPassword);
  if (errors.length > 0) {
    setError('Password does not meet requirements:\n' + errors.join('\n'));
    return;
  }

  // Proceed with reset
};
```

---

# PRIORITY 3: CONTENT SECURITY POLICY (CRITICAL)

## Issue: Missing CSP Headers

### Solution: Add CSP Middleware

---

## FIX 3: Backend - CSP Middleware

**File:** `services/api/src/index.ts`

```typescript
// Update helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // ← TODO: Remove unsafe-inline after build optimization
      styleSrc: ["'self'", "'unsafe-inline'"], // ← TODO: Remove unsafe-inline after build optimization
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      connectSrc: [
        "'self'",
        'https://api.trektribe.in',
        'https://trektribe-38in.onrender.com',
        'https://maps.googleapis.com',
        'wss://trek-tribe-38in.onrender.com' // WebSocket
      ],
      frameSrc: ["'self'", 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      childSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: true },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Additional custom headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy (Permissions Policy)
  res.setHeader('Permissions-Policy', [
    'geolocation=(self)',
    'microphone=()',
    'camera=()',
    'payment=(self)',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()'
  ].join(', '));

  next();
});
```

---

# PRIORITY 4: FRONTEND RBAC (CRITICAL)

## Issue: Unauthorized UI Visible

### Current Problem
```tsx
// ❌ WRONG: Admin button visible even for non-admins (just disabled)
{user && (
  <Link to="/admin">Admin Dashboard</Link> // Everyone can see this
)}
```

### Solution: Complete RBAC at Frontend

---

## FIX 4A: Create Protected Route Component

**File:** `web/src/components/ProtectedRoute.tsx` (NEW)

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('traveler' | 'organizer' | 'admin' | 'agent')[];
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  fallback
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role as any)) {
    return fallback ? <>{fallback}</> : <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
```

---

## FIX 4B: Update App Routes

**File:** `web/src/App.tsx`

```typescript
import { ProtectedRoute } from './components/ProtectedRoute';

function AppContent() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

      {/* Protected: Authenticated users only */}
      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <Trips />
          </ProtectedRoute>
        }
      />

      {/* Protected: Organizers only */}
      <Route
        path="/create-trip"
        element={
          <ProtectedRoute requiredRoles={['organizer', 'admin']}>
            <CreateTrip />
          </ProtectedRoute>
        }
      />

      {/* Protected: Admins only */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Protected: Agents or Admins */}
      <Route
        path="/agent/crm"
        element={
          <ProtectedRoute requiredRoles={['agent', 'admin']}>
            <EnhancedCRMDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

---

## FIX 4C: Conditional Navbar Rendering

**File:** `web/src/components/Header.tsx`

```typescript
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow">
      <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-xl">Trek Tribe</Link>
          
          {/* Public navigation */}
          <Link to="/trips">Explore</Link>

          {/* Authenticated users */}
          {user && (
            <Link to="/profile">Profile</Link>
          )}

          {/* Organizers only - HIDDEN for non-organizers */}
          {user?.role === 'organizer' && (
            <>
              <Link to="/create-trip" className="text-blue-600 font-medium">
                ➕ Create Adventure
              </Link>
              <Link to="/organizer/crm">My Dashboard</Link>
            </>
          )}

          {/* Admins only - COMPLETELY HIDDEN for non-admins */}
          {user?.role === 'admin' && (
            <Link to="/admin" className="text-red-600 font-bold">
              🔧 Admin Panel
            </Link>
          )}

          {/* Agents and Admins */}
          {(user?.role === 'agent' || user?.role === 'admin') && (
            <Link to="/agent/crm">CRM</Link>
          )}
        </div>

        <div>
          {user ? (
            <button onClick={handleLogout}>Logout</button>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </nav>
    </header>
  );
};
```

---

## FIX 4D: Sync Role from Server on Load

**File:** `web/src/contexts/AuthContext.tsx`

```typescript
useEffect(() => {
  const verifySession = async () => {
    try {
      // Always validate role from backend
      const response = await api.get('/auth/me');
      const userData = response.data?.user || response.data;
      
      if (userData && userData._id) {
        // ✅ Trust server's role, never client-side role
        setUser({
          ...userData,
          id: userData._id,
          role: userData.role // ← From backend, not localStorage
        } as User);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  verifySession();
}, []);
```

---

# PRIORITY 5: AI CONVERSATION PERSISTENCE (HIGH)

## Issue: Follow-up Questions Lose Context

### Current State
AI conversation context is persisted, but needs better handling for:
- Session recovery
- Timeout handling
- Context expiry

---

## FIX 5A: Enhance Conversation Context Service

**File:** `services/api/src/services/aiConversationService.ts`

```typescript
class AIConversationService {
  // ... existing code ...

  /**
   * Get or recover conversation context with timeout handling
   */
  async getConversationContext(sessionId: string): Promise<any> {
    const conversation = await AIConversation.findOne({ sessionId });
    
    if (!conversation) {
      return null;
    }

    // ✅ Check if conversation has timed out (15 min inactivity)
    const lastActivity = new Date(conversation.lastInteractionAt);
    const timeSinceLastActivity = Date.now() - lastActivity.getTime();
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

    if (timeSinceLastActivity > TIMEOUT_MS) {
      // Context expired - reset but keep summary
      return {
        lastIntent: conversation.summary?.topics?.[0] || undefined,
        lastEntities: conversation.summary?.keyEntities || [],
        summary: conversation.summary,
        expired: true, // ← Indicate to frontend that context expired
        message: 'Your conversation context has expired. Please provide context again.'
      };
    }

    // ✅ Return full context
    return conversation.getContext();
  }

  /**
   * Create system prompt with conversation context
   */
  buildContextPrompt(context: any, currentMessage: string): string {
    if (!context) {
      return currentMessage;
    }

    const contextLines: string[] = [];

    if (context.lastIntent) {
      contextLines.push(`Previous discussion topic: ${context.lastIntent}`);
    }

    if (context.lastEntities && context.lastEntities.length > 0) {
      contextLines.push(`Previously mentioned: ${context.lastEntities.join(', ')}`);
    }

    if (context.currentTrip) {
      contextLines.push(`Current trip in discussion: ${context.currentTrip}`);
    }

    if (context.summary?.topics) {
      contextLines.push(`Conversation summary: ${context.summary.topics.join(', ')}`);
    }

    if (contextLines.length === 0) {
      return currentMessage;
    }

    return `[Context]\n${contextLines.join('\n')}\n\n[User Question]\n${currentMessage}`;
  }

  /**
   * Clean up old conversations (run as cron job)
   */
  async cleanupExpiredConversations(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await AIConversation.deleteMany({
      lastInteractionAt: { $lt: cutoffDate },
      'escalation.escalated': { $ne: true } // Keep escalated conversations
    });

    logger.info(`Cleaned up ${result.deletedCount} expired conversations`);
    return result.deletedCount || 0;
  }
}
```

---

## FIX 5B: Frontend - Session Recovery

**File:** `web/src/components/AIChatWidgetClean.tsx` (or similar)

```typescript
interface ChatState {
  sessionId: string | null;
  messages: any[];
  contextExpired: boolean;
  loading: boolean;
}

const AIChatWidget: React.FC = () => {
  const [chatState, setChatState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    contextExpired: false,
    loading: false
  });

  // ✅ Recover session on mount
  useEffect(() => {
    const savedSessionId = sessionStorage.getItem('aiSessionId');
    if (savedSessionId) {
      setChatState(prev => ({ ...prev, sessionId: savedSessionId }));
    }
  }, []);

  const sendMessage = async (message: string) => {
    setChatState(prev => ({ ...prev, loading: true }));

    try {
      const sessionId = chatState.sessionId || generateSessionId();
      
      // ✅ Store session ID for recovery
      sessionStorage.setItem('aiSessionId', sessionId);

      const response = await api.post('/api/ai/chat', {
        message,
        sessionId,
        context: {} // Context loaded from backend
      });

      // Check if context expired
      if (response.data?.contextExpired) {
        setChatState(prev => ({ ...prev, contextExpired: true }));
      }

      setChatState(prev => ({
        ...prev,
        sessionId,
        messages: [...prev.messages, {
          type: 'ai',
          content: response.data?.response || response.data?.message,
          timestamp: new Date()
        }],
        contextExpired: false
      }));
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setChatState(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="chat-widget">
      {/* Show context recovery message if expired */}
      {chatState.contextExpired && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <p className="text-sm text-yellow-800">
            💡 Your conversation context has expired. Please provide context again if needed.
          </p>
        </div>
      )}

      {/* Messages */}
      {chatState.messages.map((msg, idx) => (
        <div key={idx} className={`mb-4 ${msg.type === 'ai' ? 'bg-gray-100' : 'bg-blue-50'} p-3 rounded`}>
          {msg.content}
        </div>
      ))}

      {/* Input */}
      <input
        type="text"
        placeholder="Type your message..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        className="w-full px-3 py-2 border rounded"
        disabled={chatState.loading}
      />
    </div>
  );
};

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

---

# PRIORITY 6: AI ERROR HANDLING & FALLBACK (HIGH)

## FIX 6A: Add Fallback Responses

**File:** `services/api/src/services/aiService.ts` (Create if doesn't exist)

```typescript
class AIService {
  /**
   * Generate response with fallback logic
   */
  async generateChatResponse(
    message: string,
    context: any,
    maxRetries: number = 2
  ): Promise<{
    response: string;
    confidence: number;
    fallback: boolean;
    requiresHumanAgent: boolean;
  }> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Try primary AI service
        const response = await this.callAIService(message, context);
        
        if (response && response.length > 0) {
          return {
            response,
            confidence: 0.9,
            fallback: false,
            requiresHumanAgent: false
          };
        }
      } catch (error: any) {
        retries++;
        logger.warn(`AI service error (attempt ${retries}/${maxRetries}):`, error.message);

        if (retries < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, retries) * 1000)
          );
          continue;
        }
      }
    }

    // ✅ All retries failed - use fallback
    return this.getFallbackResponse(message, context);
  }

  /**
   * Intelligent fallback responses based on message content
   */
  private getFallbackResponse(message: string, context: any) {
    const lowerMessage = message.toLowerCase();

    // Trip-related questions
    if (lowerMessage.includes('trip') || lowerMessage.includes('trek')) {
      return {
        response: `I'm having trouble connecting right now, but I can help! 🏔️\n\nFor trip information, you can:\n- Browse our trip catalog\n- Contact the organizer directly\n- Chat with a human agent\n\nWould you like me to connect you with an agent?`,
        confidence: 0.4,
        fallback: true,
        requiresHumanAgent: true
      };
    }

    // Booking/Payment questions
    if (lowerMessage.includes('book') || lowerMessage.includes('payment') || lowerMessage.includes('price')) {
      return {
        response: `I can't process that request right now, but our support team can help! 💳\n\nFor booking and payment questions:\n- Call our support team\n- Email support@trektribe.in\n- Chat with a live agent\n\nLet me connect you with someone who can assist.`,
        confidence: 0.4,
        fallback: true,
        requiresHumanAgent: true
      };
    }

    // General fallback
    return {
      response: `I'm temporarily unable to process your request. 😔\n\nOur support team is ready to help:\n- 📞 Call us\n- 📧 Email: support@trektribe.in\n- 💬 Chat with an agent\n\nWould you like to be connected with a human?`,
      confidence: 0.3,
      fallback: true,
      requiresHumanAgent: true
    };
  }

  private async callAIService(message: string, context: any): Promise<string> {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI service timeout')), 10000) // 10s timeout
    );

    try {
      const response = await Promise.race([
        this.pythonAIService.generate(message, context),
        timeout
      ]);

      return response;
    } catch (error) {
      throw error;
    }
  }
}

export const aiService = new AIService();
```

---

## FIX 6B: Handle AI Errors in Routes

**File:** `services/api/src/routes/ai.ts`

```typescript
router.post('/chat', authenticateJwt, async (req, res) => {
  const { message, sessionId, context } = req.body;

  try {
    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Message must be a non-empty string'
      });
    }

    // Generate response with retry and fallback
    const aiResponse = await aiService.generateChatResponse(
      message,
      context,
      3 // ← Retry up to 3 times
    );

    // ✅ Always return a valid response
    return res.json({
      success: true,
      response: aiResponse.response,
      sessionId,
      confidence: aiResponse.confidence,
      fallback: aiResponse.fallback,
      isFallback: aiResponse.fallback,
      message: aiResponse.fallback 
        ? 'Using fallback response due to service issue'
        : undefined,
      requiresHumanAgent: aiResponse.requiresHumanAgent
    });
  } catch (error: any) {
    logger.error('AI chat error:', error);

    // ✅ Even on complete failure, return fallback
    return res.json({
      success: true,
      response: 'I'm unable to help right now. Please chat with our support team.',
      sessionId,
      confidence: 0.1,
      fallback: true,
      isFallback: true,
      requiresHumanAgent: true,
      error: process.env.NODE_ENV === 'development' 
        ? error.message 
        : undefined
    });
  }
});
```

---

# PRIORITY 7: PERFORMANCE & CACHING (HIGH)

## FIX 7A: Server-Side Cache for Recommendations

**File:** `services/api/src/services/recommendationService.ts`

```typescript
import Redis from 'ioredis'; // npm install ioredis

class RecommendationService {
  private redis: Redis.Redis | null = null;

  constructor() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  /**
   * Get cached recommendations or generate new ones
   */
  async getRecommendations(
    userId: string,
    type: 'trips' | 'users',
    limit: number = 10
  ) {
    // ✅ Try cache first
    const cacheKey = `recommendations:${userId}:${type}:${limit}`;
    
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Cache read failed:', error);
      }
    }

    // Generate fresh recommendations
    const recommendations = await this.generateRecommendations(userId, type, limit);

    // ✅ Cache for 30 minutes
    if (this.redis) {
      try {
        await this.redis.setex(
          cacheKey,
          30 * 60, // 30 minutes TTL
          JSON.stringify(recommendations)
        );
      } catch (error) {
        logger.warn('Cache write failed:', error);
        // Fail gracefully - still return recommendations
      }
    }

    return recommendations;
  }

  /**
   * Invalidate cache when user activity changes
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.redis) return;

    const pattern = `recommendations:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      logger.info(`Invalidated ${keys.length} recommendation caches for user ${userId}`);
    }
  }

  private async generateRecommendations(
    userId: string,
    type: 'trips' | 'users',
    limit: number
  ) {
    if (type === 'trips') {
      return await this.getRecommendedTrips(userId, limit);
    } else {
      return await this.getRecommendedUsers(userId, limit);
    }
  }
}
```

---

## FIX 7B: Cache Invalidation on Activity

**File:** `services/api/src/routes/recommendations.ts`

```typescript
// When user activity changes, invalidate cache
router.post('/track', authenticateJwt, async (req, res) => {
  const userId = (req as any).auth.userId;
  const { action, targetType, targetId } = req.body;

  try {
    // Track activity
    await recommendationService.trackActivity(userId, action, targetType, targetId);

    // ✅ Invalidate recommendations cache
    await recommendationService.invalidateUserCache(userId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Activity tracking error:', error);
    res.status(500).json({ error: 'Failed to track activity' });
  }
});
```

---

## FIX 7C: Frontend Route-Level Code Splitting

**File:** `web/src/App.tsx`

```typescript
import React, { Suspense } from 'react';

// ✅ Lazy load heavy pages
const Home = React.lazy(() => import('./pages/Home'));
const Trips = React.lazy(() => import('./pages/Trips'));
const TripDetails = React.lazy(() => import('./pages/TripDetails'));
const CreateTrip = React.lazy(() => import('./pages/CreateTrip'));
const Profile = React.lazy(() => import('./pages/Profile'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const OrganizerVerificationDashboard = React.lazy(() => 
  import('./pages/OrganizerVerificationDashboard')
);
const GroupsPage = React.lazy(() => import('./pages/GroupsPage'));
const EventsPage = React.lazy(() => import('./pages/EventsPage'));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
  </div>
);

function App() {
  return (
    <Routes>
      {/* Wrap routes in Suspense for lazy loading */}
      <Route
        path="/"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Home />
          </Suspense>
        }
      />
      <Route
        path="/trips"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Trips />
          </Suspense>
        }
      />
      {/* ... more routes ... */}
    </Routes>
  );
}
```

---

## FIX 7D: Frontend Bundle Optimization

**File:** `web/src/index.tsx` or `vite.config.ts`

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // ✅ Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['tailwindcss'],
          'api-vendor': ['axios'],
          
          // Feature chunks
          'organizer-features': [
            './src/pages/CreateTrip',
            './src/pages/OrganizerVerificationDashboard',
            './src/pages/ProfessionalCRMDashboard'
          ],
          'user-features': [
            './src/pages/GroupsPage',
            './src/pages/EventsPage',
            './src/pages/Wishlist'
          ]
        }
      }
    },
    // ✅ Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
      }
    },
    // Optimize chunks
    chunkSizeWarningLimit: 1000,
  },
  // ✅ Lazy load heavy libraries
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios'],
    exclude: ['@sentry/react'] // Load Sentry async
  }
});
```

---

# IMPLEMENTATION CHECKLIST

## Phase 1: CRITICAL (Complete FIRST)

- [ ] **JWT & Cookies**
  - [ ] 1A: Update auth routes to set HttpOnly cookies
  - [ ] 1B: Register & OAuth set cookies
  - [ ] 1C: CORS configuration
  - [ ] 1D: Auth middleware reads from cookies
  - [ ] 1E: Cookie parser installed
  - [ ] 1F: Frontend auth context updated
  - [ ] 1G: API client configured
  - [ ] 1H: Logout endpoint added
  - [ ] 1I: Migration plan tested

- [ ] **Password Validation**
  - [ ] 2A: Backend strong password schema
  - [ ] 2B: Frontend password strength meter
  - [ ] 2C: Password reset validation

- [ ] **CSP Headers**
  - [ ] 3: Helmet CSP configured

- [ ] **Frontend RBAC**
  - [ ] 4A: Protected route component
  - [ ] 4B: App routes updated
  - [ ] 4C: Navbar conditional rendering
  - [ ] 4D: Role synced from server

## Phase 2: HIGH (Complete AFTER Critical)

- [ ] **AI Conversation**
  - [ ] 5A: Context service enhanced
  - [ ] 5B: Frontend session recovery

- [ ] **AI Error Handling**
  - [ ] 6A: Fallback responses
  - [ ] 6B: Route error handling

- [ ] **Performance**
  - [ ] 7A: Redis caching
  - [ ] 7B: Cache invalidation
  - [ ] 7C: Code splitting
  - [ ] 7D: Bundle optimization

---

# TESTING & VERIFICATION

## Security Testing

```bash
# Test XSS (should fail silently)
curl -X POST http://localhost:8000/api/test \
  -d '{"input":"<script>alert(\"xss\")</script>"}' \
  -H "Content-Type: application/json"

# Test CSRF
# Generate token from secure endpoint
# Send in X-CSRF-Token header

# Test password validation
curl -X POST http://localhost:8000/auth/register \
  -d '{"password":"weak"}' \
  -H "Content-Type: application/json"
# Should return 400 with validation errors

# Test cookie security
# Check Set-Cookie headers
curl -v http://localhost:8000/auth/login \
  | grep -i "set-cookie"
# Should include: HttpOnly, Secure, SameSite=Lax
```

## Performance Testing

```bash
# Measure initial load time
time curl http://localhost:3000

# Check bundle size
npm run build
du -sh dist/

# Lighthouse audit
npx lighthouse http://localhost:3000

# Check caching headers
curl -i http://localhost:8000/api/trips | grep -i "cache"
```

---

# DEPLOYMENT ORDER

1. **Week 1:**
   - Deploy fixes 1A-1E (JWT & cookies)
   - Deploy fixes 2A-2C (password validation)
   - Deploy fix 3 (CSP)
   - Monitor error logs

2. **Week 2:**
   - Deploy fixes 4A-4D (RBAC)
   - Deploy fixes 5A-5B (AI context)
   - Test with beta users

3. **Week 3:**
   - Deploy fixes 6A-6B (AI errors)
   - Deploy fixes 7A-7D (performance)
   - Full production deployment

---

# MONITORING POST-DEPLOYMENT

```typescript
// Add to logging
logger.info('JWT Authentication', {
  source: 'cookie' | 'header',
  tokenAge: Date.now() - issuedAt,
  success: boolean
});

logger.info('Password Validation', {
  strength: 1-5,
  validationPassed: boolean,
  attemptCount: number
});

logger.info('RBAC Check', {
  userId: string,
  requiredRole: string,
  userRole: string,
  allowed: boolean
});

logger.info('Cache Hit Rate', {
  endpoint: string,
  cached: boolean,
  responseTime: number
});
```

---

# SUCCESS CRITERIA

✅ **All issues must meet these criteria to pass:**

1. ✓ No JWT in localStorage
2. ✓ All password fields use strong validation
3. ✓ CSP headers present on all responses
4. ✓ Unauthorized routes return 404 or redirect
5. ✓ AI errors gracefully fallback
6. ✓ Initial page load < 2s
7. ✓ Recommendation queries cached
8. ✓ Zero console XSS warnings

---

**Final Status:** 🔴 BLOCKING  
**Next Step:** Implement Priority 1 (JWT) first  

