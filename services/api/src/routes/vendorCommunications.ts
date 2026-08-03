import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { vendorNotificationQueue } from '../lib/queue';

const router = express.Router();

const requireOrganizer = (req: any, res: any, next: any) => {
  if (!req.auth || !['organizer', 'admin'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Access denied. Organizers or admins only.' });
  }
  next();
};

router.use(authenticateJwt);
router.use(requireOrganizer);

router.get('/', async (req, res) => {
  const organizerId = (req as any).auth.userId;
  const logs = await prisma.vendorCommunicationLog.findMany({
    where: { vendor: { organizerId } },
    include: { vendor: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(logs);
});

router.post('/:logId/resend', async (req, res) => {
  const organizerId = (req as any).auth.userId;
  const log = await prisma.vendorCommunicationLog.findUnique({
    where: { id: req.params.logId },
    include: { vendor: true }
  });
  if (!log || log.vendor.organizerId !== organizerId) {
    return res.status(404).json({ error: 'Communication log entry not found' });
  }

  await vendorNotificationQueue.add(
    'resend-vendor-notification',
    {
      eventId: `resend:${log.id}:${Date.now()}`,
      vendorId: log.vendorId,
      eventType: log.eventType,
      payload: { assignmentId: log.assignmentId, prerenderedHtml: log.emailSnapshot }
    }
  );

  res.status(202).json({ status: 'queued' });
});

export default router;
