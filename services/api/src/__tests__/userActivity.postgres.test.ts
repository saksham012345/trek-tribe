import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import analyticsService from '../services/analyticsService';

describe('UserActivity on Postgres', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const tripId = new mongoose.Types.ObjectId().toString();

  afterAll(async () => {
    await prisma.userActivity.deleteMany({ where: { userId } });
  });

  beforeEach(async () => {
    await prisma.userActivity.deleteMany({ where: { userId } });
  });

  it('stores an activity with its metadata as JSON', async () => {
    await prisma.userActivity.create({
      data: {
        userId,
        userType: 'user',
        activityType: 'trip_view',
        description: 'Viewed trip (3 times)',
        metadata: { tripId, viewCount: 3 }
      }
    });

    const row = await prisma.userActivity.findFirst({ where: { userId } });
    expect(row).not.toBeNull();
    expect(row!.activityType).toBe('trip_view');
    expect(row!.metadata).toEqual({ tripId, viewCount: 3 });
  });

  it('defaults metadata to an empty object rather than null', async () => {
    const row = await prisma.userActivity.create({
      data: { userId, userType: 'user', activityType: 'login', description: 'Logged in' }
    });
    expect(row.metadata).toEqual({});
  });

  it('refuses an activity type outside the enum', async () => {
    await expect(
      prisma.userActivity.create({
        data: {
          userId,
          userType: 'user',
          activityType: 'not_a_real_activity' as any,
          description: 'nope'
        }
      })
    ).rejects.toBeDefined();
  });

  it('refuses an actor type outside the enum', async () => {
    await expect(
      prisma.userActivity.create({
        data: {
          userId,
          userType: 'wizard' as any,
          activityType: 'login',
          description: 'nope'
        }
      })
    ).rejects.toBeDefined();
  });

  it('has no updatedAt - an activity is an append-only fact', async () => {
    const row = await prisma.userActivity.create({
      data: { userId, userType: 'user', activityType: 'logout', description: 'Logged out' }
    });
    expect((row as any).updatedAt).toBeUndefined();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('returns the ten most recent activities, newest first', async () => {
    const base = Date.now();
    for (let i = 0; i < 12; i++) {
      await prisma.userActivity.create({
        data: {
          userId,
          userType: 'user',
          activityType: 'trip_view',
          description: 'view ' + i,
          createdAt: new Date(base + i * 1000)
        }
      });
    }

    const result: any = await analyticsService.getUserAnalytics(userId);

    expect(result.recentActivity).toHaveLength(10);
    expect(result.recentActivity[0].description).toBe('view 11');
    expect(result.recentActivity[9].description).toBe('view 2');
  });

  it('honours a date range when one is given', async () => {
    const jan = new Date('2026-01-15T00:00:00Z');
    const jun = new Date('2026-06-15T00:00:00Z');

    for (const [when, what] of [[jan, 'in january'], [jun, 'in june']] as [Date, string][]) {
      await prisma.userActivity.create({
        data: {
          userId,
          userType: 'organizer',
          activityType: 'trip_created',
          description: what,
          createdAt: when
        }
      });
    }

    const result: any = await analyticsService.getOrganizerAnalytics(userId, {
      start: new Date('2026-01-01T00:00:00Z'),
      end: new Date('2026-03-01T00:00:00Z')
    });

    const descriptions = result.recentActivity.map((a: any) => a.description);
    expect(descriptions).toContain('in january');
    expect(descriptions).not.toContain('in june');
  });
});
