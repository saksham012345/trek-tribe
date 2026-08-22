import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { Trip } from '../models/Trip';

function tokenFor(id: string) {
  return jwt.sign({ id, role: 'traveler' }, process.env.JWT_SECRET as string);
}

describe('Wishlist on Postgres', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();
  const organizerId = new mongoose.Types.ObjectId().toString();
  const activeTripId = new mongoose.Types.ObjectId().toString();
  const secondTripId = new mongoose.Types.ObjectId().toString();
  const inactiveTripId = new mongoose.Types.ObjectId().toString();
  const missingTripId = new mongoose.Types.ObjectId().toString();

  const token = tokenFor(userId);
  const otherToken = tokenFor(otherUserId);

  beforeAll(async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    for (const [id, name] of [[userId, 'Owner'], [otherUserId, 'Other'], [organizerId, 'Org']]) {
      await User.create({ _id: id, name, email: id + '@test.com', passwordHash: 'x', role: 'traveler' });
    }

    for (const [id, status, title] of [
      [activeTripId, 'active', 'Active Trip'],
      [secondTripId, 'active', 'Second Trip'],
      [inactiveTripId, 'cancelled', 'Cancelled Trip']
    ]) {
      await Trip.create({
        _id: id, title, description: 'd', organizerId, destination: 'Manali',
        startDate: soon, endDate: soon, price: 1000, capacity: 10,
        categories: ['adventure'], images: [], status
      });
    }
  });

  afterAll(async () => {
    await prisma.wishlist.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await User.deleteMany({ _id: { $in: [userId, otherUserId, organizerId] } });
    await Trip.deleteMany({ _id: { $in: [activeTripId, secondTripId, inactiveTripId] } });
  });

  beforeEach(async () => {
    await prisma.wishlist.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
  });

  const add = (tripId: string, body: any = {}, t = token) =>
    request(app).post('/wishlist').set('Authorization', 'Bearer ' + t).send({ tripId, ...body });

  it('adds a trip and stores the row in Postgres', async () => {
    const res = await add(activeTripId, { notes: 'looks great', tags: ['Himalaya', 'Summer'] });
    expect(res.status).toBe(201);

    const row = await prisma.wishlist.findUnique({
      where: { userId_tripId: { userId, tripId: activeTripId } }
    });
    expect(row).not.toBeNull();
    expect(row!.notes).toBe('looks great');
    expect(row!.tags).toEqual(['himalaya', 'summer']);
    expect(row!.priority).toBe('medium');
  });

  it('refuses the same trip twice with 409', async () => {
    await add(activeTripId);
    const res = await add(activeTripId);
    expect(res.status).toBe(409);
    expect(await prisma.wishlist.count({ where: { userId, tripId: activeTripId } })).toBe(1);
  });

  it('refuses a trip that is not active', async () => {
    const res = await add(inactiveTripId);
    expect(res.status).toBe(400);
    expect(await prisma.wishlist.count({ where: { userId, tripId: inactiveTripId } })).toBe(0);
  });

  it('refuses a trip that does not exist', async () => {
    const res = await add(missingTripId);
    expect(res.status).toBe(404);
  });

  it('lets a different user wishlist the same trip', async () => {
    await add(activeTripId);
    const res = await add(activeTripId, {}, otherToken);
    expect(res.status).toBe(201);
  });

  it('lists items with trip data joined from Mongo', async () => {
    await add(activeTripId, { notes: 'n' });
    const res = await request(app).get('/wishlist').set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].trip.title).toBe('Active Trip');
    expect(res.body.pagination.totalItems).toBe(1);
  });

  it('leaves inactive trips out of the list and out of the count', async () => {
    await add(activeTripId);
    await prisma.wishlist.create({ data: { userId, tripId: inactiveTripId } });

    const res = await request(app).get('/wishlist').set('Authorization', 'Bearer ' + token);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].trip.title).toBe('Active Trip');
    expect(res.body.pagination.totalItems).toBe(1);
  });

  it('reports stats over priorities and tags', async () => {
    await add(activeTripId, { priority: 'high', tags: ['a', 'b'] });
    await add(secondTripId, { priority: 'high', tags: ['a'] });

    const res = await request(app).get('/wishlist/stats').set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.priorityBreakdown).toEqual({ low: 0, medium: 0, high: 2 });
    expect(res.body.popularTags[0]).toEqual({ tag: 'a', count: 2 });
  });

  it('accepts a UUID as the item id, not an ObjectId', async () => {
    const created = await add(activeTripId);
    const id = created.body.wishlistItem.id;

    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const res = await request(app)
      .put('/wishlist/' + id)
      .set('Authorization', 'Bearer ' + token)
      .send({ notes: 'edited' });

    expect(res.status).toBe(200);
  });

  it('refuses to update an item belonging to someone else', async () => {
    const created = await add(activeTripId);
    const id = created.body.wishlistItem.id;

    const res = await request(app)
      .put('/wishlist/' + id)
      .set('Authorization', 'Bearer ' + otherToken)
      .send({ notes: 'not mine' });

    expect(res.status).toBe(403);
  });

  it('deletes by item id, and refuses one owned by another user', async () => {
    const created = await add(activeTripId);
    const id = created.body.wishlistItem.id;

    const forbidden = await request(app)
      .delete('/wishlist/' + id).set('Authorization', 'Bearer ' + otherToken);
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .delete('/wishlist/' + id).set('Authorization', 'Bearer ' + token);
    expect(ok.status).toBe(200);
    expect(await prisma.wishlist.count({ where: { userId } })).toBe(0);
  });

  it('deletes by trip id', async () => {
    await add(activeTripId);
    const res = await request(app)
      .delete('/wishlist/trip/' + activeTripId).set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);

    const again = await request(app)
      .delete('/wishlist/trip/' + activeTripId).set('Authorization', 'Bearer ' + token);
    expect(again.status).toBe(404);
  });

  it('updates priority', async () => {
    const created = await add(activeTripId);
    const id = created.body.wishlistItem.id;

    const res = await request(app)
      .post('/wishlist/' + id + '/priority')
      .set('Authorization', 'Bearer ' + token).send({ priority: 'high' });

    expect(res.status).toBe(200);
    expect((await prisma.wishlist.findUnique({ where: { id } }))!.priority).toBe('high');
  });

  it('adds and removes tags without duplicating them', async () => {
    const created = await add(activeTripId, { tags: ['one'] });
    const id = created.body.wishlistItem.id;

    await request(app).post('/wishlist/' + id + '/tags')
      .set('Authorization', 'Bearer ' + token).send({ tags: ['two', 'one'] });

    let row = await prisma.wishlist.findUnique({ where: { id } });
    expect(row!.tags.slice().sort()).toEqual(['one', 'two']);

    await request(app).delete('/wishlist/' + id + '/tags')
      .set('Authorization', 'Bearer ' + token).send({ tags: ['one'] });

    row = await prisma.wishlist.findUnique({ where: { id } });
    expect(row!.tags).toEqual(['two']);
  });

  it('checks whether a trip is in the wishlist', async () => {
    const before = await request(app)
      .get('/wishlist/check/' + activeTripId).set('Authorization', 'Bearer ' + token);
    expect(before.body.isInWishlist).toBe(false);

    await add(activeTripId);

    const after = await request(app)
      .get('/wishlist/check/' + activeTripId).set('Authorization', 'Bearer ' + token);
    expect(after.body.isInWishlist).toBe(true);
    expect(after.body.wishlistItemId).not.toBeNull();
  });
});
