import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import { auditLogService } from '../services/auditLogService';
import notificationService from '../services/notificationService';
import { retryQueueService } from '../services/retryQueueService';
import * as notificationsModule from '../modules/notifications/notifications.service';
import { getSiteSettings, updateSiteSettings, resetSiteSettings } from '../services/siteSettingsService';

describe('Wave 3 operational leaves on Postgres', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.retryJob.deleteMany({ where: { referenceId: { startsWith: 'test-' } } });
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: 'test_evt_' } } });
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.retryJob.deleteMany({ where: { referenceId: { startsWith: 'test-' } } });
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: 'test_evt_' } } });
  });

  // ─── AuditLog ───────────────────────────────────────────────────────────────

  it('writes an audit log with before and after in separate columns', async () => {
    await auditLogService.log({
      userId,
      action: 'UPDATE',
      resource: 'Trip',
      resourceId: 'trip-1',
      changes: { before: { price: 100 }, after: { price: 200 } },
      metadata: { reason: 'price correction' }
    } as any);

    const row = await prisma.auditLog.findFirst({ where: { userId } });
    expect(row).not.toBeNull();
    expect(row!.changesBefore).toEqual({ price: 100 });
    expect(row!.changesAfter).toEqual({ price: 200 });
    expect((row!.metadata as any).reason).toBe('price correction');
    expect(row!.status).toBe('SUCCESS');
  });

  it('audit logging never throws into the caller', async () => {
    // An action outside the enum would be rejected by Postgres. The service
    // swallows its own failures on purpose - an audit write must not break the
    // operation being audited.
    await expect(
      auditLogService.log({ userId, action: 'NOT_A_REAL_ACTION', resource: 'Trip' } as any)
    ).resolves.toBeUndefined();

    expect(await prisma.auditLog.count({ where: { userId } })).toBe(0);
  });

  it('groups audit stats by action and resource, most frequent first', async () => {
    for (const action of ['LOGIN', 'LOGIN', 'DELETE'] as const) {
      await auditLogService.log({ userId, action, resource: 'Auth' } as any);
    }

    const stats: any = await auditLogService.getStats();
    const login = stats.byAction.find((a: any) => a._id === 'LOGIN');
    expect(login.count).toBe(2);
    // sorted descending, so the pair comes before the single
    expect(stats.byAction[0].count).toBeGreaterThanOrEqual(stats.byAction[1]?.count ?? 0);
  });

  // ─── Notification ───────────────────────────────────────────────────────────

  it('creates a notification with relatedTo split into two columns', async () => {
    const created: any = await notificationService.createNotification({
      userId,
      type: 'booking',
      title: 'Booking confirmed',
      message: 'Your seat is held.',
      relatedTo: { type: 'booking', id: 'booking-42' }
    });

    const row = await prisma.notification.findUnique({ where: { id: created.id } });
    expect(row!.relatedToType).toBe('booking');
    expect(row!.relatedToId).toBe('booking-42');
  });

  it('marking as read records when it was read', async () => {
    const created: any = await notificationService.createNotification({
      userId, type: 'system', title: 'T', message: 'M'
    });
    expect(created.readAt).toBeNull();

    await notificationsModule.markAsRead(userId, created.id);

    const row = await prisma.notification.findUnique({ where: { id: created.id } });
    expect(row!.isRead).toBe(true);
    expect(row!.readAt).toBeInstanceOf(Date);
  });

  it('one user cannot mark another users notification as read', async () => {
    const created: any = await notificationService.createNotification({
      userId, type: 'system', title: 'T', message: 'M'
    });

    const stranger = new mongoose.Types.ObjectId().toString();
    await expect(notificationsModule.markAsRead(stranger, created.id)).rejects.toThrow();

    const row = await prisma.notification.findUnique({ where: { id: created.id } });
    expect(row!.isRead).toBe(false);
  });

  // ─── RetryJob ───────────────────────────────────────────────────────────────

  it('enqueues a job and finds it once it is due', async () => {
    await retryQueueService.enqueue('charge', 'test-ref-1', { amount: 500 }, 0, 3);

    const due = await retryQueueService.getDueJobs(10);
    const mine = due.filter(j => j.referenceId === 'test-ref-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('pending');
  });

  it('a job scheduled into the future is not due yet', async () => {
    await retryQueueService.enqueue('charge', 'test-ref-2', {}, 60_000, 3);

    const due = await retryQueueService.getDueJobs(50);
    expect(due.filter(j => j.referenceId === 'test-ref-2')).toHaveLength(0);
  });

  it('failing a job past its max retries marks it failed, not pending', async () => {
    const job: any = await retryQueueService.enqueue('charge', 'test-ref-3', {}, 0, 1);

    await retryQueueService.fail(job.id, 'card declined', 60_000);

    const row = await prisma.retryJob.findUnique({ where: { id: job.id } });
    expect(row!.retryCount).toBe(1);
    expect(row!.lastError).toBe('card declined');
    // retryCount 1 is not < maxRetries 1, so there is no retry left
    expect(row!.status).toBe('failed');
  });

  // ─── WebhookEvent ───────────────────────────────────────────────────────────

  it('records a webhook event once even if the provider replays it', async () => {
    await prisma.webhookEvent.create({
      data: { eventId: 'test_evt_1', source: 'razorpay', processedAt: new Date() }
    });

    await expect(
      prisma.webhookEvent.create({ data: { eventId: 'test_evt_1', source: 'razorpay' } })
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(await prisma.webhookEvent.count({ where: { eventId: 'test_evt_1' } })).toBe(1);
  });

  // ─── SiteSettings ───────────────────────────────────────────────────────────

  it('returns settings in the nested shape callers expect', async () => {
    const settings: any = await getSiteSettings(true);

    expect(settings.home).toBeDefined();
    expect(Array.isArray(settings.home.heroImages)).toBe(true);
    expect(typeof settings.notifications.tripReminderHours).toBe('number');
    expect(settings.integrations.paymentProvider).toBeDefined();
  });

  it('updates one nested key without flattening the rest', async () => {
    await resetSiteSettings();

    const updated: any = await updateSiteSettings({ notifications: { smsEnabled: true } });

    expect(updated.notifications.smsEnabled).toBe(true);
    // everything beside it survived
    expect(updated.notifications.tripReminderHours).toBe(24);
    expect(updated.home.discoverColumnsDesktop).toBe(3);

    await resetSiteSettings();
  });

  it('refuses a column count outside the allowed range', async () => {
    await resetSiteSettings();

    await expect(
      updateSiteSettings({ home: { discoverColumnsDesktop: 9 } })
    ).rejects.toBeDefined();

    const settings: any = await getSiteSettings(true);
    expect(settings.home.discoverColumnsDesktop).toBe(3);
  });

  it('there is only ever one settings row', async () => {
    await getSiteSettings(true);
    expect(await prisma.siteSettings.count()).toBe(1);
  });
});
