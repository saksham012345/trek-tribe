import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';

function tokenFor(id: string, role = 'traveler') {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string);
}

describe('Reviews on Postgres', () => {
  const reviewerId = new mongoose.Types.ObjectId().toString();
  const otherId = new mongoose.Types.ObjectId().toString();
  const organizerId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const endedTripId = new mongoose.Types.ObjectId().toString();

  const token = tokenFor(reviewerId);
  const otherToken = tokenFor(otherId);
  const adminToken = tokenFor(adminId, 'admin');

  beforeAll(async () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);

    await User.create({ _id: reviewerId, name: 'Reviewer', email: reviewerId + '@t.com', passwordHash: 'x', role: 'traveler' });
    await User.create({ _id: otherId, name: 'Other', email: otherId + '@t.com', passwordHash: 'x', role: 'traveler' });
    await User.create({ _id: organizerId, name: 'Org', email: organizerId + '@t.com', passwordHash: 'x', role: 'organizer' });
    await User.create({ _id: adminId, name: 'Admin', email: adminId + '@t.com', passwordHash: 'x', role: 'admin' });

    await prisma.trip.create({ data: {
      id: endedTripId, title: 'Ended Trip', description: 'd', organizerId,
      destination: 'Manali', startDate: past, endDate: past, price: 1000, capacity: 10,
      categories: ['adventure'], images: [], status: 'completed',
      // livePhotos and participants are tables now, so they are written through
      // the relation rather than assigned as arrays.
      //
      // The Mongoose schema had a validator requiring at least one live photo
      // once startDate had passed, which is why this fixture supplies one. That
      // validator is NOT carried over: it is a condition on a child table
      // evaluated against a parent column, which a CHECK cannot express - it
      // would need a trigger. Nothing enforces it today. See the note in
      // prisma/schema.prisma on TripLivePhoto.
      livePhotos: {
        create: [{ url: 'https://example.com/p.jpg', filename: 'p.jpg' }]
      },
      participants: {
        create: [{ userId: reviewerId }, { userId: otherId }]
      }
    } });
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { reviewerId: { in: [reviewerId, otherId] } } });
    await User.deleteMany({ _id: { $in: [reviewerId, otherId, organizerId, adminId] } });
    await prisma.trip.deleteMany({ where: { id: endedTripId } });
  });

  beforeEach(async () => {
    await prisma.review.deleteMany({ where: { reviewerId: { in: [reviewerId, otherId] } } });
  });

  const post = (body: any = {}, t = token) =>
    request(app).post('/reviews').set('Authorization', 'Bearer ' + t).send({
      targetId: endedTripId,
      reviewType: 'trip',
      rating: 5,
      title: 'Great trip overall',
      comment: 'Genuinely a wonderful experience from start to end.',
      ...body
    });

  it('creates a review and stores it in Postgres', async () => {
    const res = await post({ tags: ['safety', 'value-for-money'] });
    expect(res.status).toBe(201);

    const row = await prisma.review.findUnique({ where: { id: res.body.review.id } });
    expect(row).not.toBeNull();
    // the API speaks hyphens, the enum stores underscores
    expect(row!.tags).toEqual(['safety', 'value_for_money']);
    expect(res.body.review.tags).toEqual(['safety', 'value-for-money']);
  });

  it('refuses a second review of the same target and type', async () => {
    await post();
    const res = await post({ rating: 3 });
    expect(res.status).toBe(409);
    expect(await prisma.review.count({ where: { reviewerId, targetId: endedTripId } })).toBe(1);
  });

  it('refuses a rating outside 1 to 5 before it reaches the database', async () => {
    expect((await post({ rating: 0 })).status).toBe(400);
    expect((await post({ rating: 6 })).status).toBe(400);
  });

  it('refuses an unknown tag rather than dropping it', async () => {
    const res = await post({ tags: ['safety', 'not-a-real-tag'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown review tag');
  });

  it('reports rating stats over verified reviews only', async () => {
    await post({ rating: 4 });
    await post({ rating: 2 }, otherToken);

    const res = await request(app).get('/reviews/stats/' + endedTripId + '/trip');

    expect(res.status).toBe(200);
    expect(res.body.totalReviews).toBe(2);
    expect(res.body.averageRating).toBe(3);
    expect(res.body.ratingDistribution[4]).toBe(1);
    expect(res.body.ratingDistribution[2]).toBe(1);
  });

  it('counts a helpful vote once and toggles it off', async () => {
    const id = (await post()).body.review.id;

    const on = await request(app)
      .post('/reviews/' + id + '/helpful').set('Authorization', 'Bearer ' + otherToken);
    expect(on.body.helpfulVotes).toBe(1);

    const off = await request(app)
      .post('/reviews/' + id + '/helpful').set('Authorization', 'Bearer ' + otherToken);
    expect(off.body.helpfulVotes).toBe(0);

    expect(await prisma.reviewHelpfulVote.count({ where: { reviewId: id } })).toBe(0);
  });

  it('refuses a helpful vote on your own review', async () => {
    const id = (await post()).body.review.id;
    const res = await request(app)
      .post('/reviews/' + id + '/helpful').set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(400);
  });

  it('refuses to update a review you do not own', async () => {
    const id = (await post()).body.review.id;
    const res = await request(app)
      .put('/reviews/' + id).set('Authorization', 'Bearer ' + otherToken)
      .send({ rating: 1 });
    expect(res.status).toBe(403);
  });

  it('deletes a review and its votes together', async () => {
    const id = (await post()).body.review.id;
    await request(app).post('/reviews/' + id + '/helpful').set('Authorization', 'Bearer ' + otherToken);
    expect(await prisma.reviewHelpfulVote.count({ where: { reviewId: id } })).toBe(1);

    const res = await request(app)
      .delete('/reviews/' + id).set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(await prisma.reviewHelpfulVote.count({ where: { reviewId: id } })).toBe(0);
  });

  it('records a flag once per user and auto-flags at three', async () => {
    const id = (await post()).body.review.id;

    const flaggers = [otherId, organizerId, adminId];
    let last: any;
    for (const uid of flaggers) {
      last = await request(app)
        .post('/api/review-verification/' + id + '/flag')
        .set('Authorization', 'Bearer ' + tokenFor(uid))
        .send({ reason: 'spam' });
    }

    expect(last.body.data.review.totalFlags).toBe(3);
    expect(last.body.data.review.flagged).toBe(true);
    expect((await prisma.review.findUnique({ where: { id } }))!.isFlagged).toBe(true);

    // the same user again is refused by the constraint, not by a pre-check
    const again = await request(app)
      .post('/api/review-verification/' + id + '/flag')
      .set('Authorization', 'Bearer ' + tokenFor(otherId))
      .send({ reason: 'spam' });
    expect(again.status).toBe(400);
    expect(await prisma.reviewFlag.count({ where: { reviewId: id } })).toBe(3);
  });

  it('unflagging clears the flag rows', async () => {
    const id = (await post()).body.review.id;
    for (const uid of [otherId, organizerId, adminId]) {
      await request(app).post('/api/review-verification/' + id + '/flag')
        .set('Authorization', 'Bearer ' + tokenFor(uid)).send({ reason: 'spam' });
    }

    const res = await request(app)
      .put('/api/review-verification/' + id + '/unflag')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ moderationNotes: 'looked fine' });

    expect(res.status).toBe(200);
    expect(await prisma.reviewFlag.count({ where: { reviewId: id } })).toBe(0);
    expect((await prisma.review.findUnique({ where: { id } }))!.isFlagged).toBe(false);
  });

  it('admin stats count the right buckets', async () => {
    await post();
    const res = await request(app)
      .get('/api/review-verification/stats').set('Authorization', 'Bearer ' + adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.totalReviews).toBeGreaterThanOrEqual(1);
    expect(res.body.data.stats.verifiedReviews).toBeGreaterThanOrEqual(1);
  });
});
