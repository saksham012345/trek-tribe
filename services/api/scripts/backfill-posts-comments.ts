/**
 * Backfill Mongo posts and comments into Postgres. D10/D11 wave 2.
 *
 *   npx ts-node scripts/backfill-posts-comments.ts            # dry run
 *   npx ts-node scripts/backfill-posts-comments.ts --commit   # actually writes
 *
 * Order matters. Comments carry a real foreign key to posts now, so every post
 * must land before any comment that points at it, and a comment whose post did
 * not make it is skipped rather than allowed to fail the batch.
 *
 * Mongo _id values are carried across as the Postgres primary key. They are not
 * UUIDs, and the columns are plain text, so that is allowed - and it is the only
 * way comment.postId and parentCommentId still resolve after the move. Rows
 * created from now on get UUIDs. The table therefore holds both shapes, which is
 * ugly but honest; rewriting every id would break any link anyone has saved.
 *
 * Likes were arrays on the document and become rows in post_likes /
 * comment_likes. A user who somehow appears twice in one array yields one row,
 * because the unique constraint is the point of the change.
 */
import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import { Post } from '../src/models/Post';
import { Comment } from '../src/models/Comment';

const COMMIT = process.argv.includes('--commit');
const BATCH = 500;
const POST_TYPES = new Set(['trip_memory', 'general_post', 'link_share', 'experience']);

function jsonSafe(value: any): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const converted = jsonSafe(v);
      if (converted !== null) out[k] = converted;
    }
    return out;
  }
  return value;
}

const clip = (s: any, n: number) => (typeof s === 'string' ? s.slice(0, n) : s);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(mongoUri);

  const totalPosts = await Post.countDocuments({});
  const totalComments = await Comment.countDocuments({});
  console.log('mongo posts:      ' + totalPosts);
  console.log('mongo comments:   ' + totalComments);
  console.log('postgres before:  ' + (await prisma.post.count()) + ' posts, ' + (await prisma.comment.count()) + ' comments');
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to write)');

  const skipped = { badType: 0, noAuthor: 0, longTitle: 0, longContent: 0, orphanComment: 0, longComment: 0 };
  let postsWritten = 0, commentsWritten = 0, postLikes = 0, commentLikes = 0;

  // ---- posts first, because comments reference them ----
  for (let skip = 0; skip < totalPosts; skip += BATCH) {
    const docs = await Post.find({}).sort({ _id: 1 }).skip(skip).limit(BATCH).lean();

    const rows: any[] = [];
    const likeRows: any[] = [];

    for (const d of docs as any[]) {
      const id = d._id?.toString();
      const authorId = d.authorId?.toString();
      if (!authorId) { skipped.noAuthor++; continue; }
      if (!POST_TYPES.has(d.type)) { skipped.badType++; continue; }
      if (typeof d.title === 'string' && d.title.length > 200) { skipped.longTitle++; continue; }
      if (typeof d.content === 'string' && d.content.length > 2000) { skipped.longContent++; continue; }

      rows.push({
        id,
        authorId,
        type: d.type,
        title: d.title,
        content: d.content,
        images: Array.isArray(d.images) ? d.images.filter(Boolean).map(String) : [],
        links: jsonSafe(d.links) ?? [],
        tripData: d.tripData ? jsonSafe(d.tripData) : null,
        tags: Array.from(new Set((Array.isArray(d.tags) ? d.tags : [])
          .filter(Boolean).map((t: any) => clip(String(t).toLowerCase().trim(), 30)))),
        isPublic: d.isPublic !== false,
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? d.createdAt ?? new Date()
      });

      for (const raw of new Set((Array.isArray(d.likes) ? d.likes : []).map((u: any) => u?.toString()).filter(Boolean))) {
        likeRows.push({ postId: id, userId: raw });
      }
    }

    if (COMMIT && rows.length) {
      postsWritten += (await prisma.post.createMany({ data: rows, skipDuplicates: true })).count;
      if (likeRows.length) {
        postLikes += (await prisma.postLike.createMany({ data: likeRows, skipDuplicates: true })).count;
      }
    }
  }

  // ---- comments second, skipping any whose post did not land ----
  for (let skip = 0; skip < totalComments; skip += BATCH) {
    const docs = await Comment.find({}).sort({ _id: 1 }).skip(skip).limit(BATCH).lean();

    const rows: any[] = [];
    const likeRows: any[] = [];

    for (const d of docs as any[]) {
      const id = d._id?.toString();
      const postId = d.postId?.toString();
      const authorId = d.authorId?.toString();
      if (!postId || !authorId) { skipped.orphanComment++; continue; }
      if (typeof d.content === 'string' && d.content.length > 500) { skipped.longComment++; continue; }

      const postExists = COMMIT ? await prisma.post.count({ where: { id: postId } }) : 1;
      if (!postExists) { skipped.orphanComment++; continue; }

      rows.push({
        id,
        postId,
        authorId,
        content: d.content,
        // A parent whose row is missing would violate the self-reference, so it
        // is dropped to null: better a top-level comment than a lost one.
        parentCommentId: d.parentCommentId ? d.parentCommentId.toString() : null,
        isEdited: !!d.isEdited,
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? d.createdAt ?? new Date()
      });

      for (const raw of new Set((Array.isArray(d.likes) ? d.likes : []).map((u: any) => u?.toString()).filter(Boolean))) {
        likeRows.push({ commentId: id, userId: raw });
      }
    }

    if (COMMIT && rows.length) {
      // Two passes: parents may sit later in the batch than their replies.
      const withoutParents = rows.map(r => ({ ...r, parentCommentId: null }));
      commentsWritten += (await prisma.comment.createMany({ data: withoutParents, skipDuplicates: true })).count;

      for (const r of rows) {
        if (!r.parentCommentId) continue;
        const parent = await prisma.comment.count({ where: { id: r.parentCommentId } });
        if (parent) {
          await prisma.comment.update({ where: { id: r.id }, data: { parentCommentId: r.parentCommentId } });
        }
      }

      if (likeRows.length) {
        commentLikes += (await prisma.commentLike.createMany({ data: likeRows, skipDuplicates: true })).count;
      }
    }
  }

  console.log('');
  console.log('posts written:    ' + postsWritten);
  console.log('post likes:       ' + postLikes);
  console.log('comments written: ' + commentsWritten);
  console.log('comment likes:    ' + commentLikes);
  console.log('skipped:');
  console.log('  bad type:       ' + skipped.badType);
  console.log('  no author:      ' + skipped.noAuthor);
  console.log('  title > 200:    ' + skipped.longTitle);
  console.log('  content > 2000: ' + skipped.longContent);
  console.log('  comment > 500:  ' + skipped.longComment);
  console.log('  orphan comment: ' + skipped.orphanComment);
  console.log('postgres after:   ' + (await prisma.post.count()) + ' posts, ' + (await prisma.comment.count()) + ' comments');

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
