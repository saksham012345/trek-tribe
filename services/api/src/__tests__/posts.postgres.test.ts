import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';

function tokenFor(id: string) {
  return jwt.sign({ id, role: 'traveler' }, process.env.JWT_SECRET as string);
}

describe('Posts and Comments on Postgres', () => {
  const authorId = new mongoose.Types.ObjectId().toString();
  const readerId = new mongoose.Types.ObjectId().toString();

  const authorToken = tokenFor(authorId);
  const readerToken = tokenFor(readerId);

  beforeAll(async () => {
    await User.create({ _id: authorId, name: 'Author', email: authorId + '@t.com', passwordHash: 'x', role: 'traveler' });
    await User.create({ _id: readerId, name: 'Reader', email: readerId + '@t.com', passwordHash: 'x', role: 'traveler' });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId: { in: [authorId, readerId] } } });
    await prisma.follow.deleteMany({ where: { followerId: readerId } });
    await User.deleteMany({ _id: { $in: [authorId, readerId] } });
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId: { in: [authorId, readerId] } } });
    await prisma.follow.deleteMany({ where: { followerId: readerId } });
  });

  const makePost = (body: any = {}, t = authorToken) =>
    request(app).post('/api/posts').set('Authorization', 'Bearer ' + t).send({
      type: 'general_post',
      title: 'A title',
      content: 'Some content',
      ...body
    });

  it('creates a post and stores it in Postgres', async () => {
    const res = await makePost({ tags: ['Himalaya', 'Trek'] });
    expect(res.status).toBe(201);

    const row = await prisma.post.findUnique({ where: { id: res.body.post.id } });
    expect(row).not.toBeNull();
    expect(row!.tags).toEqual(['himalaya', 'trek']);
    expect(row!.isPublic).toBe(true);
  });

  it('rejects a title longer than the column allows', async () => {
    const res = await makePost({ title: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('stores tripData as JSON with dates as strings', async () => {
    const res = await makePost({
      type: 'trip_memory',
      tripData: {
        destination: 'Manali',
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-10T00:00:00.000Z',
        participants: 4
      }
    });
    expect(res.status).toBe(201);

    const row = await prisma.post.findUnique({ where: { id: res.body.post.id } });
    expect((row!.tripData as any).destination).toBe('Manali');
    expect((row!.tripData as any).startDate).toBe('2026-05-01T00:00:00.000Z');
  });

  it('counts a like once however many times it is sent', async () => {
    const created = await makePost();
    const postId = created.body.post.id;

    const first = await request(app)
      .post('/api/posts/' + postId + '/like').set('Authorization', 'Bearer ' + readerToken);
    expect(first.body.isLiked).toBe(true);
    expect(first.body.likesCount).toBe(1);

    // Same user again is a toggle off, not a second like.
    const second = await request(app)
      .post('/api/posts/' + postId + '/like').set('Authorization', 'Bearer ' + readerToken);
    expect(second.body.isLiked).toBe(false);
    expect(second.body.likesCount).toBe(0);

    expect(await prisma.postLike.count({ where: { postId } })).toBe(0);
  });

  it('lets two different users like the same post', async () => {
    const created = await makePost();
    const postId = created.body.post.id;

    await request(app).post('/api/posts/' + postId + '/like').set('Authorization', 'Bearer ' + readerToken);
    await request(app).post('/api/posts/' + postId + '/like').set('Authorization', 'Bearer ' + authorToken);

    expect(await prisma.postLike.count({ where: { postId } })).toBe(2);
  });

  it('adds a comment and derives the count without a comments array', async () => {
    const created = await makePost();
    const postId = created.body.post.id;

    const res = await request(app)
      .post('/api/posts/' + postId + '/comments')
      .set('Authorization', 'Bearer ' + readerToken)
      .send({ content: 'nice one' });

    expect(res.status).toBe(201);
    expect(res.body.comment.author.name).toBe('Reader');

    const single = await request(app).get('/api/posts/' + postId);
    expect(single.body.post.commentsCount).toBe(1);
    expect(single.body.post.comments[0].content).toBe('nice one');
  });

  it('refuses a comment on a post that does not exist', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post('/api/posts/' + ghost + '/comments')
      .set('Authorization', 'Bearer ' + readerToken)
      .send({ content: 'hello' });

    expect(res.status).toBe(404);
  });

  it('refuses a reply whose parent belongs to another post', async () => {
    const a = (await makePost()).body.post.id;
    const b = (await makePost({ title: 'Second' })).body.post.id;

    const onA = await request(app)
      .post('/api/posts/' + a + '/comments')
      .set('Authorization', 'Bearer ' + readerToken).send({ content: 'on a' });

    const res = await request(app)
      .post('/api/posts/' + b + '/comments')
      .set('Authorization', 'Bearer ' + readerToken)
      .send({ content: 'reply', parentCommentId: onA.body.comment.id });

    expect(res.status).toBe(400);
  });

  it('toggles a comment like', async () => {
    const postId = (await makePost()).body.post.id;
    const comment = await request(app)
      .post('/api/posts/' + postId + '/comments')
      .set('Authorization', 'Bearer ' + readerToken).send({ content: 'c' });
    const commentId = comment.body.comment.id;

    const on = await request(app)
      .post('/api/posts/comments/' + commentId + '/like').set('Authorization', 'Bearer ' + authorToken);
    expect(on.body.likesCount).toBe(1);

    const off = await request(app)
      .post('/api/posts/comments/' + commentId + '/like').set('Authorization', 'Bearer ' + authorToken);
    expect(off.body.likesCount).toBe(0);
  });

  it('deleting a post takes its comments and likes with it', async () => {
    const postId = (await makePost()).body.post.id;
    await request(app).post('/api/posts/' + postId + '/comments')
      .set('Authorization', 'Bearer ' + readerToken).send({ content: 'c' });
    await request(app).post('/api/posts/' + postId + '/like')
      .set('Authorization', 'Bearer ' + readerToken);

    expect(await prisma.comment.count({ where: { postId } })).toBe(1);
    expect(await prisma.postLike.count({ where: { postId } })).toBe(1);

    const res = await request(app)
      .delete('/api/posts/' + postId).set('Authorization', 'Bearer ' + authorToken);
    expect(res.status).toBe(200);

    expect(await prisma.comment.count({ where: { postId } })).toBe(0);
    expect(await prisma.postLike.count({ where: { postId } })).toBe(0);
  });

  it('refuses to delete someone elses post', async () => {
    const postId = (await makePost()).body.post.id;
    const res = await request(app)
      .delete('/api/posts/' + postId).set('Authorization', 'Bearer ' + readerToken);
    expect(res.status).toBe(404);
    expect(await prisma.post.count({ where: { id: postId } })).toBe(1);
  });

  it('reports engagement metrics from the join tables', async () => {
    const postId = (await makePost()).body.post.id;
    await request(app).post('/api/posts/' + postId + '/like')
      .set('Authorization', 'Bearer ' + readerToken);
    await request(app).post('/api/posts/' + postId + '/comments')
      .set('Authorization', 'Bearer ' + readerToken).send({ content: 'c' });

    const res = await request(app)
      .get('/api/posts/metrics/engagement').set('Authorization', 'Bearer ' + authorToken);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalPosts).toBe(1);
    expect(res.body.summary.totalLikes).toBe(1);
    expect(res.body.summary.totalComments).toBe(1);
    expect(res.body.topPosts[0].engagement).toBe(2);
  });

  it('the follow feed is empty when you follow nobody', async () => {
    await makePost();
    const res = await request(app)
      .get('/api/posts/feed/following').set('Authorization', 'Bearer ' + readerToken);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(0);
  });

  it('the follow feed returns posts once you follow the author', async () => {
    await makePost();
    // This is the fix: the feed reads the follows table, which /api/follow writes.
    // It used to read user.following, which nothing ever wrote, so it was always empty.
    await prisma.follow.create({ data: { followerId: readerId, followingId: authorId } });

    const res = await request(app)
      .get('/api/posts/feed/following').set('Authorization', 'Bearer ' + readerToken);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].author.name).toBe('Author');
  });
});
