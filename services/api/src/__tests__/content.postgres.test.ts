import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';

function tokenFor(id: string, role = 'traveler') {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string);
}

describe('Wave 5 content on Postgres', () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const joinerId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();

  const ownerToken = tokenFor(ownerId);
  const joinerToken = tokenFor(joinerId);
  const adminToken = tokenFor(adminId, 'admin');

  beforeAll(async () => {
    await User.create({ _id: ownerId, name: 'Owner', email: ownerId + '@t.com', passwordHash: 'x', role: 'organizer' });
    await User.create({ _id: joinerId, name: 'Joiner', email: joinerId + '@t.com', passwordHash: 'x', role: 'traveler' });
    await User.create({ _id: adminId, name: 'Admin', email: adminId + '@t.com', passwordHash: 'x', role: 'admin' });
  });

  afterAll(async () => {
    await prisma.blogPost.deleteMany({ where: { authorId: { in: [ownerId, adminId] } } });
    await prisma.group.deleteMany({ where: { creatorId: ownerId } });
    await prisma.event.deleteMany({ where: { organizerId: ownerId } });
    await prisma.knowledgeBase.deleteMany({ where: { category: 'test-cat' } });
    await User.deleteMany({ _id: { $in: [ownerId, joinerId, adminId] } });
  });

  beforeEach(async () => {
    await prisma.blogPost.deleteMany({ where: { authorId: { in: [ownerId, adminId] } } });
    await prisma.group.deleteMany({ where: { creatorId: ownerId } });
    await prisma.event.deleteMany({ where: { organizerId: ownerId } });
    await prisma.knowledgeBase.deleteMany({ where: { category: 'test-cat' } });
  });

  // ─── BlogPost ───────────────────────────────────────────────────────────────

  const makeBlog = (body: any = {}) =>
    request(app).post('/api/blogs/admin').set('Authorization', 'Bearer ' + adminToken).send({
      title: 'A Reasonably Long Blog Title',
      excerpt: 'An excerpt that clears the twenty character minimum easily.',
      content: 'Body text that is comfortably longer than the fifty character minimum the schema asks for.',
      ...body
    });

  it('creates a blog post and answers with _id', async () => {
    const res = await makeBlog();
    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeTruthy();
    expect(res.body.data._id).toBe(res.body.data.id);
  });

  it('gives two posts with the same title different slugs', async () => {
    const first = await makeBlog();
    const second = await makeBlog();

    expect(second.status).toBe(201);
    expect(second.body.data.slug).not.toBe(first.body.data.slug);
    expect(await prisma.blogPost.count({ where: { authorId: adminId } })).toBe(2);
  });

  it('publishing stamps a date and going back to draft clears it', async () => {
    const created = await makeBlog({ status: 'published' });
    const id = created.body.data.id;
    expect(created.body.data.publishedAt).not.toBeNull();

    await request(app).put('/api/blogs/admin/' + id)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        title: 'A Reasonably Long Blog Title',
        excerpt: 'An excerpt that clears the twenty character minimum easily.',
        content: 'Body text that is comfortably longer than the fifty character minimum the schema asks for.',
        status: 'draft'
      });

    const row = await prisma.blogPost.findUnique({ where: { id } });
    expect(row!.publishedAt).toBeNull();
  });

  // ─── Group ──────────────────────────────────────────────────────────────────

  const makeGroup = () =>
    request(app).post('/api/groups').set('Authorization', 'Bearer ' + ownerToken).send({
      name: 'Trek Club',
      description: 'A group for people who like walking uphill for fun.',
      category: 'trekking'
    });

  it('creates a group with its creator already an admin member', async () => {
    const res = await makeGroup();
    expect(res.status).toBe(201);

    const members = await prisma.groupMember.findMany({ where: { groupId: res.body.group.id } });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(ownerId);
    expect(members[0].role).toBe('admin');
  });

  it('counts a join once however many times it is sent', async () => {
    const groupId = (await makeGroup()).body.group.id;

    const first = await request(app)
      .post('/api/groups/' + groupId + '/join').set('Authorization', 'Bearer ' + joinerToken);
    expect(first.status).toBe(200);
    expect(first.body.memberCount).toBe(2);

    const second = await request(app)
      .post('/api/groups/' + groupId + '/join').set('Authorization', 'Bearer ' + joinerToken);
    expect(second.status).toBe(400);

    expect(await prisma.groupMember.count({ where: { groupId } })).toBe(2);
  });

  it('leaving drops the membership and the admin role together', async () => {
    const groupId = (await makeGroup()).body.group.id;
    await request(app).post('/api/groups/' + groupId + '/join')
      .set('Authorization', 'Bearer ' + joinerToken);

    // make the joiner an admin, the way a promotion would
    await prisma.groupMember.updateMany({
      where: { groupId, userId: joinerId },
      data: { role: 'admin' }
    });

    const res = await request(app)
      .post('/api/groups/' + groupId + '/leave').set('Authorization', 'Bearer ' + joinerToken);
    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(1);

    // One row covered both lists, so there is no orphaned admin entry left over
    expect(await prisma.groupMember.count({ where: { groupId, userId: joinerId } })).toBe(0);
  });

  it('the creator cannot leave their own group', async () => {
    const groupId = (await makeGroup()).body.group.id;
    const res = await request(app)
      .post('/api/groups/' + groupId + '/leave').set('Authorization', 'Bearer ' + ownerToken);
    expect(res.status).toBe(400);
  });

  it('deleting a group takes its memberships with it', async () => {
    const groupId = (await makeGroup()).body.group.id;
    await request(app).post('/api/groups/' + groupId + '/join')
      .set('Authorization', 'Bearer ' + joinerToken);

    await request(app).delete('/api/groups/' + groupId)
      .set('Authorization', 'Bearer ' + ownerToken).expect(200);

    expect(await prisma.groupMember.count({ where: { groupId } })).toBe(0);
  });

  // ─── Event ──────────────────────────────────────────────────────────────────

  const makeEvent = (body: any = {}) =>
    request(app).post('/api/events').set('Authorization', 'Bearer ' + ownerToken).send({
      title: 'Weekend Meetup',
      description: 'A short walk and a long chat.',
      eventType: 'meetup',
      startDate: '2026-09-01T09:00:00.000Z',
      endDate: '2026-09-01T17:00:00.000Z',
      ...body
    });

  it('creates an event with the organizer already attending', async () => {
    const res = await makeEvent();
    expect(res.status).toBe(201);

    const participants = await prisma.eventParticipant.findMany({
      where: { eventId: res.body.event.id }
    });
    expect(participants).toHaveLength(1);
    expect(participants[0].kind).toBe('attendee');
  });

  it('refuses a join past capacity', async () => {
    const eventId = (await makeEvent({ capacity: 1 })).body.event.id;

    const res = await request(app)
      .post('/api/events/' + eventId + '/rsvp').set('Authorization', 'Bearer ' + joinerToken);
    expect(res.status).toBe(400);
    expect(await prisma.eventParticipant.count({ where: { eventId } })).toBe(1);
  });

  it('an invitee who joins becomes an attendee rather than a second row', async () => {
    const eventId = (await makeEvent()).body.event.id;
    await prisma.eventParticipant.create({
      data: { eventId, userId: joinerId, kind: 'invitee' }
    });

    const res = await request(app)
      .post('/api/events/' + eventId + '/rsvp').set('Authorization', 'Bearer ' + joinerToken);
    expect(res.status).toBe(200);

    const rows = await prisma.eventParticipant.findMany({ where: { eventId, userId: joinerId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('attendee');
  });

  // ─── KnowledgeBase ──────────────────────────────────────────────────────────

  it('stores an embedding as a float array and finds it by text', async () => {
    await prisma.knowledgeBase.create({
      data: {
        title: 'Altitude sickness on high treks',
        content: 'Ascend slowly and drink water. Descend if symptoms worsen.',
        summary: 'What to do about altitude sickness.',
        type: 'guide',
        category: 'test-cat',
        embedding: [0.1, 0.2, 0.3]
      }
    });

    const row = await prisma.knowledgeBase.findFirst({ where: { category: 'test-cat' } });
    expect(row!.embedding).toEqual([0.1, 0.2, 0.3]);

    // the Postgres full-text search that replaced $text + textScore
    const hits = await prisma.$queryRaw<Array<{ title: string }>>`
      SELECT title FROM knowledge_base
      WHERE to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || content)
            @@ plainto_tsquery('english', 'altitude sickness')
    `;
    expect(hits.map(h => h.title)).toContain('Altitude sickness on high treks');
  });

  it('finds documents that have an embedding, and skips those that do not', async () => {
    await prisma.knowledgeBase.create({
      data: { title: 'With', content: 'c', type: 'faq', category: 'test-cat', embedding: [0.5] }
    });
    await prisma.knowledgeBase.create({
      data: { title: 'Without', content: 'c', type: 'faq', category: 'test-cat' }
    });

    const withEmbedding = await prisma.knowledgeBase.findMany({
      where: { category: 'test-cat', embedding: { isEmpty: false } }
    });

    expect(withEmbedding.map(d => d.title)).toEqual(['With']);
  });
});
