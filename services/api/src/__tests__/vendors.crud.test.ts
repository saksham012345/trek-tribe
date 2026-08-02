import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';

function organizerToken(id: string) {
  return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET as string);
}

describe('Vendor CRUD', () => {
  const organizerId = '507f1f77bcf86cd799439011';
  const token = organizerToken(organizerId);

  afterAll(async () => {
    await prisma.vendor.deleteMany({ where: { organizerId } });
    await prisma.vendor.deleteMany({ where: { organizerId: '507f1f77bcf86cd799439099' } });
  });

  it('creates a vendor scoped to the authenticated organizer', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessName: 'ABC Travels',
        category: 'transport',
        phone: '+919876543210'
      });

    expect(res.status).toBe(201);
    expect(res.body.businessName).toBe('ABC Travels');
    expect(res.body.organizerId).toBe(organizerId);
  });

  it('lists only the authenticated organizer\'s vendors', async () => {
    const otherToken = organizerToken('507f1f77bcf86cd799439099');
    await request(app).post('/api/vendors').set('Authorization', `Bearer ${otherToken}`)
      .send({ businessName: 'Other Org Vendor', category: 'guide' });

    const res = await request(app).get('/api/vendors').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((v: any) => v.organizerId === organizerId)).toBe(true);
    expect(res.body.some((v: any) => v.businessName === 'Other Org Vendor')).toBe(false);
  });

  it('returns 404 for a vendor belonging to a different organizer', async () => {
    const otherToken = organizerToken('507f1f77bcf86cd799439099');
    const created = await request(app).post('/api/vendors').set('Authorization', `Bearer ${otherToken}`)
      .send({ businessName: 'Isolated Vendor', category: 'food' });

    const res = await request(app).get(`/api/vendors/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('updates a vendor', async () => {
    const created = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Mountain Nest', category: 'homestay' });

    const res = await request(app).put(`/api/vendors/${created.body.id}`).set('Authorization', `Bearer ${token}`)
      .send({ availabilityStatus: 'busy' });

    expect(res.status).toBe(200);
    expect(res.body.availabilityStatus).toBe('busy');
  });

  it('deletes a vendor', async () => {
    const created = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Temp Vendor', category: 'photographer' });

    const del = await request(app).delete(`/api/vendors/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/vendors/${created.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });
});
