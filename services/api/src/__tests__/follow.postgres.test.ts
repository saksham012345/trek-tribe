import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';

function tokenFor(id: string) {
  return jwt.sign({ id, role: 'traveler' }, process.env.JWT_SECRET as string);
}

describe('Follow on Postgres', () => {
  const followerId = new mongoose.Types.ObjectId().toString();
  const organizerId = new mongoose.Types.ObjectId().toString();
  const otherId = new mongoose.Types.ObjectId().toString();
  const token = tokenFor(followerId);

  beforeAll(async () => {
    await User.create({
      _id: followerId, name: 'Follower', email: `f-${followerId}@test.com`,
      passwordHash: 'x', role: 'traveler'
    });
    await User.create({
      _id: organizerId, name: 'Organizer', email: `o-${organizerId}@test.com`,
      passwordHash: 'x', role: 'organizer'
    });
    await User.create({
      _id: otherId, name: 'Traveler', email: `t-${otherId}@test.com`,
      passwordHash: 'x', role: 'traveler'
    });
  });

  afterAll(async () => {
    await prisma.follow.deleteMany({ where: { followerId } });
    await prisma.follow.deleteMany({ where: { followingId: organizerId } });
    await User.deleteMany({ _id: { $in: [followerId, organizerId, otherId] } });
  });

  beforeEach(async () => {
    // Reset both stores. Deleting rows without resetting the counters is exactly
    // the drift this migration introduces, and it would otherwise accumulate
    // across tests and mask the assertion below.
    await prisma.follow.deleteMany({ where: { followerId } });
    await User.updateMany(
      { _id: { $in: [followerId, organizerId, otherId] } },
      { $set: { 'socialStats.followersCount': 0, 'socialStats.followingCount': 0 } }
    );
  });

  it('follows an organizer and stores the row in Postgres', async () => {
    const res = await request(app)
      .post(`/api/follow/${organizerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const row = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: organizerId } }
    });
    expect(row).not.toBeNull();
  });

  it('refuses a second follow of the same organizer', async () => {
    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(await prisma.follow.count({ where: { followerId, followingId: organizerId } })).toBe(1);
  });

  it('refuses following yourself', async () => {
    const selfToken = tokenFor(organizerId);
    const res = await request(app)
      .post(`/api/follow/${organizerId}`)
      .set('Authorization', `Bearer ${selfToken}`);

    expect(res.status).toBe(400);
    expect(await prisma.follow.count({ where: { followerId: organizerId, followingId: organizerId } })).toBe(0);
  });

  it('refuses following a non-organizer', async () => {
    const res = await request(app)
      .post(`/api/follow/${otherId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('unfollows and removes the row', async () => {
    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).delete(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await prisma.follow.count({ where: { followerId, followingId: organizerId } })).toBe(0);
  });

  it('unfollowing someone you do not follow is a 404', async () => {
    const res = await request(app).delete(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('reports follow status both ways', async () => {
    const before = await request(app)
      .get(`/api/follow/${organizerId}/status`).set('Authorization', `Bearer ${token}`);
    expect(before.body.isFollowing).toBe(false);

    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    const after = await request(app)
      .get(`/api/follow/${organizerId}/status`).set('Authorization', `Bearer ${token}`);
    expect(after.body.isFollowing).toBe(true);
  });

  it('lists followers with the user details joined from Mongo', async () => {
    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/follow/${organizerId}/followers`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalFollowers).toBe(1);
    expect(res.body.followers).toHaveLength(1);
    // the join across databases actually resolved
    expect(res.body.followers[0].name).toBe('Follower');
  });

  it('lists following with the user details joined from Mongo', async () => {
    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get(`/api/follow/${followerId}/following`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalFollowing).toBe(1);
    expect(res.body.following[0].name).toBe('Organizer');
  });

  it('keeps the Mongo follower counters in step with the Postgres rows', async () => {
    await request(app).post(`/api/follow/${organizerId}`).set('Authorization', `Bearer ${token}`);

    const organizer: any = await User.findById(organizerId);
    const follower: any = await User.findById(followerId);
    const rows = await prisma.follow.count({ where: { followingId: organizerId } });

    expect(organizer.socialStats.followersCount).toBe(rows);
    expect(follower.socialStats.followingCount).toBe(1);
  });
});
