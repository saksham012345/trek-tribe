/**
 * Authentication Tests
 * Covers: register, login, /me, password validation, duplicate detection
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import { User } from '../models/User';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

const VALID_USER = {
  name: 'Test User',
  email: 'testuser@example.com',
  password: 'SecurePass123!',
  role: 'traveler' as const,
  phone: '+911234567890',
};

const VALID_ORGANIZER = {
  name: 'Test Organizer',
  email: 'organizer@example.com',
  password: 'SecurePass123!',
  role: 'organizer' as const,
  phone: '+919876543210',
};

beforeEach(async () => {
  await User.deleteMany({});
});

describe('POST /auth/register', () => {
  it('registers a traveler and returns token + user', async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER).expect(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.body.user.role).toBe('traveler');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('registers an organizer successfully', async () => {
    const res = await request(app).post('/auth/register').send(VALID_ORGANIZER).expect(201);
    expect(res.body.user.role).toBe('organizer');
    expect(res.body).toHaveProperty('token');
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: 'not-an-email' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects weak password (too short)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: 'new@example.com', password: 'abc' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects password without uppercase', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, email: 'new2@example.com', password: 'alllowercase123!' })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/auth/register').send(VALID_USER).expect(201);
    const res = await request(app).post('/auth/register').send(VALID_USER).expect(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects missing phone', async () => {
    const { phone, ...noPhone } = VALID_USER;
    const res = await request(app).post('/auth/register').send(noPhone).expect(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(VALID_USER);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password })
      .expect(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(VALID_USER.email);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email, password: 'WrongPass999!' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'SecurePass123!' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: VALID_USER.email })
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /auth/me', () => {
  let token: string;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(VALID_USER);
    token = res.body.token;
  });

  it('returns user data with valid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe(VALID_USER.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without token', async () => {
    await request(app).get('/auth/me').expect(401);
  });

  it('returns 401 with invalid token', async () => {
    await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(401);
  });
});
