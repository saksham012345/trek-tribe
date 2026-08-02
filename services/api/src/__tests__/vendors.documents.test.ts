import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';

function organizerToken(id: string) {
  return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET as string);
}

describe('Vendor documents', () => {
  const organizerId = '507f1f77bcf86cd799439022';
  const token = organizerToken(organizerId);
  let vendorId: string;

  beforeAll(async () => {
    const created = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Doc Test Vendor', category: 'hotel' });
    vendorId = created.body.id;
  });

  afterAll(async () => {
    await prisma.vendorDocument.deleteMany({ where: { vendorId } });
    await prisma.vendor.deleteMany({ where: { organizerId } });
  });

  it('records a document reference against a vendor', async () => {
    const res = await request(app)
      .post(`/api/vendors/${vendorId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'rate-card.pdf', fileUrl: 'https://cloudinary.example/rate-card.pdf' });

    expect(res.status).toBe(201);
    expect(res.body.fileName).toBe('rate-card.pdf');
  });

  it('lists documents for a vendor', async () => {
    const res = await request(app).get(`/api/vendors/${vendorId}/documents`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for documents on a vendor belonging to a different organizer', async () => {
    const otherToken = organizerToken('507f1f77bcf86cd799439099');
    const res = await request(app).get(`/api/vendors/${vendorId}/documents`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('deletes a document', async () => {
    const created = await request(app)
      .post(`/api/vendors/${vendorId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'temp.pdf', fileUrl: 'https://cloudinary.example/temp.pdf' });

    const del = await request(app)
      .delete(`/api/vendors/${vendorId}/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });
});
