import express from 'express';
import { z } from 'zod';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { BlogPost } from '../models/BlogPost';
import { slugify } from '../utils/slugify';
import { logger } from '../utils/logger';

const router = express.Router();

const blogSchema = z.object({
  title: z.string().min(5).max(180),
  excerpt: z.string().min(20).max(320),
  content: z.string().min(50),
  coverImage: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string().min(1).max(40)).max(10).optional(),
  status: z.enum(['draft', 'published']).default('draft')
});

async function generateUniqueSlug(title: string, skipId?: string) {
  const base = slugify(title) || `blog-${Date.now()}`;
  let candidate = base;
  let attempt = 1;
  while (true) {
    const existing = await BlogPost.findOne({ slug: candidate, ...(skipId ? { _id: { $ne: skipId } } : {}) }).lean();
    if (!existing) return candidate;
    candidate = `${base}-${attempt++}`;
  }
}

const defaultBlogs = [
  {
    title: 'First Himalayan Trek: Complete Beginner Preparation Guide',
    excerpt: 'A practical checklist for planning your first Himalayan adventure, from fitness and packing to safety and altitude basics.',
    coverImage: 'https://images.unsplash.com/photo-1464822759844-d150ad6d1f6d?q=80&w=1400&auto=format&fit=crop',
    tags: ['himalayas', 'beginner', 'packing'],
    content: `Planning your first Himalayan trek can feel overwhelming, but it becomes easy with the right preparation.

Start with basic endurance training: brisk walking, light stair climbs, and mobility work for 4-6 weeks.
Pack light and smart: layered clothing, good shoes, rain protection, reusable water bottle, and emergency medicines.
Do not ignore acclimatization and hydration. High altitude is manageable when you go slow, eat clean, and sleep well.

Before departure, verify weather, permits, and local contact numbers. During the trek, follow your guide's instructions and avoid risky shortcuts.
Your first trek should be about consistency and safety, not speed.

A well-planned first trip builds confidence for every adventure that follows.`
  },
  {
    title: 'How To Choose The Right Trek Difficulty For Your Group',
    excerpt: 'Use this simple framework to match trek difficulty with group fitness, time, budget, and safety expectations.',
    coverImage: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?q=80&w=1400&auto=format&fit=crop',
    tags: ['planning', 'difficulty', 'group-travel'],
    content: `Selecting trek difficulty should be a structured decision.

Begin with three filters:
1. Fitness baseline of the least fit participant.
2. Number of available days including buffer.
3. Comfort with weather uncertainty and terrain.

Beginner routes are ideal for mixed groups and first-time travelers.
Intermediate routes suit groups with cardio readiness and prior hiking experience.
Advanced routes need stronger conditioning, pacing discipline, and technical awareness.

Also evaluate logistics: road quality, emergency access, and network connectivity.
Choosing a realistic route keeps morale high and improves safety outcomes for everyone.`
  },
  {
    title: 'Leave No Trace: Eco-Friendly Trekking That Actually Works',
    excerpt: 'Small habits create massive impact in mountain ecosystems. Here is a practical eco code for every trekker.',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1400&auto=format&fit=crop',
    tags: ['eco', 'sustainability', 'responsible-travel'],
    content: `Eco-friendly trekking is not about trends, it is about responsibility.

Carry back every non-biodegradable item, including wrappers and batteries.
Avoid single-use plastics and use refillable bottles.
Stay on marked trails to prevent vegetation damage.
Do not disturb wildlife for photos or videos.
Prefer local homestays and local guides so tourism value remains in mountain communities.

Respect silence, respect water sources, and avoid soap contamination near natural streams.
When trekkers adopt these practices together, destinations stay healthy for years to come.
Responsible travel protects both the experience and the ecosystem.`
  },
  {
    title: 'Weekend Treks Near Major Indian Cities: Fast Escapes, Big Views',
    excerpt: 'Short on leave? Explore smart weekend trekking options near Delhi, Mumbai, Bengaluru, and Pune.',
    coverImage: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1400&auto=format&fit=crop',
    tags: ['weekend', 'india', 'travel-planning'],
    content: `Weekend treks are perfect for busy professionals who still want outdoor reset.

Plan around overnight travel to maximize daylight on trail.
Choose routes with verified local support and predictable weather windows.
Pack light with quick-dry layers, snack energy, and one emergency backup light.

City-to-trail planning should include:
- Departure and return buffers
- Local transport backup
- Offline maps and emergency contacts

A well-executed weekend trek can deliver great recovery and confidence without long leave calendars.`
  },
  {
    title: 'Budget Trekking Without Compromising Safety',
    excerpt: 'Cut costs the right way: optimize transport, shared stays, and gear choices while keeping safety as non-negotiable.',
    coverImage: 'https://images.unsplash.com/photo-1465101162946-4377e57745c3?q=80&w=1400&auto=format&fit=crop',
    tags: ['budget', 'safety', 'trekking'],
    content: `Budget trekking should reduce waste, not safety.

Save money through off-peak dates, shared transport, and community stays.
Rent occasional-use gear from trusted providers instead of buying everything.
Prioritize spending on essentials: footwear, rain protection, and emergency medicine.

Never compromise on:
- Certified organizer or guide
- Weather checks and route updates
- Emergency response readiness

The cheapest itinerary is not the best itinerary.
The smartest itinerary is safe, realistic, and financially sustainable.`
  },
  {
    title: 'How Organizers Build Better Trip Experiences For Repeat Travelers',
    excerpt: 'Great organizers move beyond logistics. They design trust, communication, and consistency across the full journey.',
    coverImage: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1400&auto=format&fit=crop',
    tags: ['organizer', 'community', 'experience'],
    content: `Great trip experiences are engineered before day one.

Strong organizers provide clear pre-trip communication, realistic itineraries, and transparent pricing.
They collect participant context early: fitness level, dietary needs, emergency contact, and expectations.
On trip, they balance pace, safety, and group energy.

After trip, they continue engagement through recap content, photos, and future-route recommendations.
This post-trip continuity is what drives repeat participation and community trust.

In travel platforms, experience quality compounds over time.
Organizers who systematize quality become category leaders.`
  }
];

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 9, 1), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      BlogPost.find({ status: 'published' })
        .select('title slug excerpt coverImage tags publishedAt readTimeMinutes createdAt')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments({ status: 'published' })
    ]);

    res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch blog posts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

router.use('/admin', authenticateJwt, requireRole(['admin']));

router.get('/admin/list', async (_req, res) => {
  try {
    const items = await BlogPost.find({})
      .select('title slug excerpt content coverImage status tags publishedAt updatedAt createdAt readTimeMinutes')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ data: items });
  } catch (error: any) {
    logger.error('Failed to fetch admin blog list', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch admin blog list' });
  }
});

router.post('/admin', async (req, res) => {
  try {
    const parsed = blogSchema.parse(req.body);
    const slug = await generateUniqueSlug(parsed.title);
    const readTimeMinutes = Math.max(1, Math.ceil(parsed.content.split(/\s+/).length / 220));
    const doc = await BlogPost.create({
      ...parsed,
      coverImage: parsed.coverImage || undefined,
      tags: parsed.tags || [],
      slug,
      authorId: (req as any).auth.userId,
      readTimeMinutes,
      publishedAt: parsed.status === 'published' ? new Date() : undefined
    });

    res.status(201).json({ data: doc });
  } catch (error: any) {
    logger.error('Failed to create blog post', { error: error.message });
    res.status(400).json({ error: 'Failed to create blog post', details: error.message });
  }
});

router.put('/admin/:id', async (req, res) => {
  try {
    const parsed = blogSchema.parse(req.body);
    const existing = await BlogPost.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const slug = parsed.title !== existing.title
      ? await generateUniqueSlug(parsed.title, req.params.id)
      : existing.slug;

    existing.title = parsed.title;
    existing.slug = slug;
    existing.excerpt = parsed.excerpt;
    existing.content = parsed.content;
    existing.coverImage = parsed.coverImage || undefined;
    existing.tags = parsed.tags || [];
    existing.status = parsed.status;
    existing.readTimeMinutes = Math.max(1, Math.ceil(parsed.content.split(/\s+/).length / 220));
    if (parsed.status === 'published' && !existing.publishedAt) {
      existing.publishedAt = new Date();
    }
    if (parsed.status === 'draft') {
      existing.publishedAt = undefined;
    }
    await existing.save();

    res.json({ data: existing });
  } catch (error: any) {
    logger.error('Failed to update blog post', { error: error.message });
    res.status(400).json({ error: 'Failed to update blog post', details: error.message });
  }
});

router.delete('/admin/:id', async (req, res) => {
  try {
    const deleted = await BlogPost.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json({ message: 'Blog deleted' });
  } catch (error: any) {
    logger.error('Failed to delete blog post', { error: error.message });
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

router.post('/admin/seed', async (req, res) => {
  try {
    const currentCount = await BlogPost.countDocuments();
    if (currentCount > 0 && !req.query.force) {
      return res.json({ message: 'Blogs already exist. Use ?force=1 to add defaults again.', created: 0 });
    }

    let created = 0;
    for (const entry of defaultBlogs) {
      const slug = await generateUniqueSlug(entry.title);
      await BlogPost.create({
        ...entry,
        slug,
        status: 'published',
        authorId: (req as any).auth.userId,
        publishedAt: new Date(),
        readTimeMinutes: Math.max(1, Math.ceil(entry.content.split(/\s+/).length / 220))
      });
      created += 1;
    }

    res.json({ message: 'Default blogs created', created });
  } catch (error: any) {
    logger.error('Failed to seed blogs', { error: error.message });
    res.status(500).json({ error: 'Failed to seed blogs' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const item = await BlogPost.findOne({ slug: req.params.slug, status: 'published' })
      .populate('authorId', 'name')
      .lean();

    if (!item) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json({ data: item });
  } catch (error: any) {
    logger.error('Failed to fetch blog details', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
});

export default router;
