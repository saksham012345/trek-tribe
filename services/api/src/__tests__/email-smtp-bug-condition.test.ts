/**
 * Bug Condition Exploration Test for SMTP Authentication Fix
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * Property 1: Bug Condition - SMTP Authentication Failure with Insecure Configuration
 * 
 * For any input where valid Gmail credentials are provided (email format valid, app password length >= 16),
 * the fixed email service SHALL successfully authenticate with Gmail SMTP using secure TLS configuration
 * (port 465 with secure: true or port 587 with STARTTLS), implement retry logic with exponential backoff
 * for transient failures, and log detailed error information including SMTP error codes and connection state.
 */

import nodemailer from 'nodemailer';
import { EmailService } from '../services/emailService';
import { emailOtpService } from '../services/emailOtpService';

describe('Bug Condition Exploration: SMTP Authentication with Insecure Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Property 1: Secure SMTP Configuration', () => {
    it('should use secure TLS configuration (port 465 with secure: true)', async () => {
      // Setup valid Gmail credentials
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456'; // 16 characters
      process.env.DISABLE_EMAIL = 'false';

      const emailService = new EmailService();
      await emailService.initialize();

      // Access the transporter to check configuration
      const transporter = (emailService as any).transporter;

      if (transporter) {
        const options = transporter.options as any;
        
        // Expected behavior: Should use secure configuration
        // Port 465 with secure: true OR port 587 with requireTLS: true
        const hasSecurePort = options.port === 465 || options.port === 587;
        const hasSecureFlag = options.secure === true || options.requireTLS === true;
        const hasNoRejectUnauthorized = !options.tls || options.tls.rejectUnauthorized !== false;

        expect(hasSecurePort).toBe(true);
        expect(hasSecureFlag).toBe(true);
        expect(hasNoRejectUnauthorized).toBe(true);
      } else {
        // If transporter is null, the service failed to initialize
        // This is expected on unfixed code with insecure configuration
        throw new Error('Email service failed to initialize - transporter is null');
      }
    });

    it('should NOT use rejectUnauthorized: false in TLS configuration', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      const emailService = new EmailService();
      await emailService.initialize();

      const transporter = (emailService as any).transporter;

      if (transporter) {
        const options = transporter.options as any;
        
        // Expected behavior: Should NOT have rejectUnauthorized: false
        if (options.tls) {
          expect(options.tls.rejectUnauthorized).not.toBe(false);
        }
      } else {
        throw new Error('Email service failed to initialize - transporter is null');
      }
    });
  });

  describe('Property 2: Credential Validation', () => {
    it('should validate email format before SMTP connection attempt', async () => {
      // Invalid email format
      process.env.GMAIL_USER = 'invalid-email-format';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      const emailService = new EmailService();
      
      // Mock console to capture validation errors
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await emailService.initialize();

      // Expected behavior: Should log validation error about invalid email format
      // before attempting SMTP connection
      const validationErrorLogged = consoleWarnSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && (
          arg.includes('email') || 
          arg.includes('format') || 
          arg.includes('invalid')
        ))
      ) || consoleErrorSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && (
          arg.includes('email') || 
          arg.includes('format') || 
          arg.includes('invalid')
        ))
      );

      expect(validationErrorLogged).toBe(true);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should validate app password length (minimum 16 characters)', async () => {
      // Short password (not a valid Gmail app password)
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = 'short123'; // Less than 16 characters
      process.env.DISABLE_EMAIL = 'false';

      const emailService = new EmailService();
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await emailService.initialize();

      // Expected behavior: Should log validation error about password length
      const validationErrorLogged = consoleWarnSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && (
          arg.includes('password') || 
          arg.includes('length') || 
          arg.includes('16')
        ))
      ) || consoleErrorSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && (
          arg.includes('password') || 
          arg.includes('length') || 
          arg.includes('16')
        ))
      );

      expect(validationErrorLogged).toBe(true);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Property 3: Retry Logic with Exponential Backoff', () => {
    it('should implement retry logic for transient SMTP failures', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      // Mock nodemailer to simulate transient failure
      const mockVerify = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED')) // First attempt fails
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))    // Second attempt fails
        .mockResolvedValueOnce(true);                      // Third attempt succeeds

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      } as any);

      const emailService = new EmailService();
      await emailService.initialize();

      // Expected behavior: Should retry on transient failures
      // mockVerify should be called multiple times (at least 2-3 times)
      expect(mockVerify.mock.calls.length).toBeGreaterThanOrEqual(2);

      jest.restoreAllMocks();
    });

    it('should use exponential backoff between retry attempts', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      const callTimes: number[] = [];
      const mockVerify = jest.fn().mockImplementation(async () => {
        callTimes.push(Date.now());
        if (callTimes.length < 3) {
          throw new Error('ETIMEDOUT');
        }
        return true;
      });

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      } as any);

      const emailService = new EmailService();
      await emailService.initialize();

      // Expected behavior: Time between retries should increase exponentially
      // First retry: ~1s, Second retry: ~2s, Third retry: ~4s
      if (callTimes.length >= 3) {
        const firstDelay = callTimes[1] - callTimes[0];
        const secondDelay = callTimes[2] - callTimes[1];
        
        // Second delay should be roughly 2x the first delay (exponential backoff)
        expect(secondDelay).toBeGreaterThan(firstDelay);
      }

      jest.restoreAllMocks();
    });

    it('should NOT retry on permanent authentication failures', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      // Mock permanent authentication failure (invalid credentials)
      const mockVerify = jest.fn().mockRejectedValue(
        Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), {
          code: 'EAUTH',
          responseCode: 535
        })
      );

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      } as any);

      const emailService = new EmailService();
      await emailService.initialize();

      // Expected behavior: Should NOT retry on permanent failures (EAUTH)
      // mockVerify should be called only once
      expect(mockVerify.mock.calls.length).toBe(1);

      jest.restoreAllMocks();
    });
  });

  describe('Property 4: Enhanced Error Logging', () => {
    it('should log SMTP error codes in error messages', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      // Mock SMTP error with error code
      const smtpError = Object.assign(new Error('Authentication failed'), {
        code: 'EAUTH',
        responseCode: 535,
        response: '535-5.7.8 Username and Password not accepted'
      });

      const mockVerify = jest.fn().mockRejectedValue(smtpError);

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      } as any);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const emailService = new EmailService();
      await emailService.initialize();

      // Expected behavior: Error log should include SMTP error code (535)
      const errorCodeLogged = consoleWarnSpy.mock.calls.some(call => 
        call.some(arg => 
          (typeof arg === 'string' && (arg.includes('535') || arg.includes('EAUTH'))) ||
          (typeof arg === 'object' && arg !== null && (
            JSON.stringify(arg).includes('535') || 
            JSON.stringify(arg).includes('EAUTH')
          ))
        )
      ) || consoleErrorSpy.mock.calls.some(call => 
        call.some(arg => 
          (typeof arg === 'string' && (arg.includes('535') || arg.includes('EAUTH'))) ||
          (typeof arg === 'object' && arg !== null && (
            JSON.stringify(arg).includes('535') || 
            JSON.stringify(arg).includes('EAUTH')
          ))
        )
      );

      expect(errorCodeLogged).toBe(true);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should log connection details (host, port, secure flag) in error messages', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';
      process.env.DISABLE_EMAIL = 'false';

      const mockVerify = jest.fn().mockRejectedValue(new Error('Connection failed'));

      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
        sendMail: jest.fn(),
      } as any);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const emailService = new EmailService();
      await emailService.initialize();

      // Expected behavior: Error log should include connection details (port, host, secure)
      const connectionDetailsLogged = consoleWarnSpy.mock.calls.some(call => 
        call.some(arg => 
          (typeof arg === 'string' && (arg.includes('port') || arg.includes('host') || arg.includes('secure'))) ||
          (typeof arg === 'object' && arg !== null && (
            JSON.stringify(arg).includes('port') || 
            JSON.stringify(arg).includes('host') || 
            JSON.stringify(arg).includes('secure')
          ))
        )
      ) || consoleErrorSpy.mock.calls.some(call => 
        call.some(arg => 
          (typeof arg === 'string' && (arg.includes('port') || arg.includes('host') || arg.includes('secure'))) ||
          (typeof arg === 'object' && arg !== null && (
            JSON.stringify(arg).includes('port') || 
            JSON.stringify(arg).includes('host') || 
            JSON.stringify(arg).includes('secure')
          ))
        )
      );

      expect(connectionDetailsLogged).toBe(true);

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      jest.restoreAllMocks();
    });
  });

  describe('Property 5: Consistent Implementation in emailOtpService', () => {
    it('should use secure SMTP configuration in emailOtpService', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';

      // Trigger lazy initialization
      await emailOtpService.sendOTP('user@example.com', 'registration');

      // Access the transporter to check configuration
      const transporter = (emailOtpService as any).transporter;

      if (transporter) {
        const options = transporter.options as any;
        
        // Expected behavior: Should use secure configuration
        const hasSecurePort = options?.port === 465 || options?.port === 587;
        const hasSecureFlag = options?.secure === true || options?.requireTLS === true;
        const hasNoRejectUnauthorized = !options?.tls || options.tls.rejectUnauthorized !== false;

        expect(hasSecurePort).toBe(true);
        expect(hasSecureFlag).toBe(true);
        expect(hasNoRejectUnauthorized).toBe(true);
      } else {
        throw new Error('Email OTP service failed to initialize - transporter is null');
      }
    });

    it('should NOT use rejectUnauthorized: false in emailOtpService', async () => {
      process.env.GMAIL_USER = 'test@gmail.com';
      process.env.GMAIL_APP_PASSWORD = '1234567890123456';

      await emailOtpService.sendOTP('user@example.com', 'registration');

      const transporter = (emailOtpService as any).transporter;

      if (transporter) {
        const options = transporter.options as any;
        
        // Expected behavior: Should NOT have rejectUnauthorized: false
        if (options?.tls) {
          expect(options.tls.rejectUnauthorized).not.toBe(false);
        }
      } else {
        throw new Error('Email OTP service failed to initialize - transporter is null');
      }
    });
  });
});
