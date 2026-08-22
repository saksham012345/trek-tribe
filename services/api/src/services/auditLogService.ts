import { AuditAction, AuditResource } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Request } from 'express';

interface LogAuditParams {
  userId: string;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: any;
  req?: Request;
  status?: 'SUCCESS' | 'FAILURE' | 'PENDING';
  errorMessage?: string;
}

class AuditLogService {
  /**
   * Log an audit entry
   */
  async log(params: LogAuditParams): Promise<void> {
    try {
      const {
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        changes,
        metadata = {},
        req,
        status = 'SUCCESS',
        errorMessage
      } = params;

      // Extract request metadata
      const requestMetadata = req ? {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        method: req.method,
        path: req.path,
      } : {};

      await prisma.auditLog.create({
        data: {
          userId: String(userId),
          userEmail,
          action,
          resource,
          resourceId: resourceId ? String(resourceId) : null,
          // changes was a nested { before, after }; two columns, so either half
          // can be read without pulling the other.
          changesBefore: changes?.before ?? undefined,
          changesAfter: changes?.after ?? undefined,
          metadata: {
            ...requestMetadata,
            ...metadata
          },
          status,
          errorMessage,
          timestamp: new Date()
        }
      });

      console.log(`📝 Audit log: ${action} ${resource} by user ${userId}`);
    } catch (error: any) {
      // Don't fail the main operation if audit logging fails
      console.error('❌ Failed to create audit log:', error.message);
    }
  }

  /**
   * Log user authentication events
   */
  async logAuth(userId: string, userEmail: string, action: 'LOGIN' | 'LOGOUT', req: Request, success: boolean = true): Promise<void> {
    await this.log({
      userId,
      userEmail,
      action,
      resource: 'Auth',
      req,
      status: success ? 'SUCCESS' : 'FAILURE'
    });
  }

  /**
   * Log payment operations
   */
  async logPayment(userId: string, paymentId: string, action: 'CREATE' | 'VERIFY', amount: number, req?: Request): Promise<void> {
    await this.log({
      userId,
      action: 'PAYMENT',
      resource: 'Payment',
      resourceId: paymentId,
      metadata: { amount },
      req
    });
  }

  /**
   * Log admin actions (trip verification, user suspension, etc.)
   */
  async logAdminAction(
    adminId: string, 
    action: AuditAction, 
    resource: AuditResource,
    resourceId: string,
    reason?: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action,
      resource,
      resourceId,
      metadata: { reason, isAdminAction: true },
      req
    });
  }

  /**
   * Log data changes with before/after snapshots
   */
  async logChange(
    userId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resource: AuditResource,
    resourceId: string,
    before: any,
    after: any,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      changes: {
        before,
        after
      },
      req
    });
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(userId: string, limit: number = 50) {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceLogs(resource: string, resourceId: string, limit: number = 50) {
    // populate('userId') is gone - User is still a Mongo document. Callers
    // that need the name can look it up; none do today.
    return await prisma.auditLog.findMany({
      where: { resource: resource as any, resourceId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * Get recent audit logs (for admin dashboard)
   */
  async getRecentLogs(limit: number = 100, filters?: any) {
    return await prisma.auditLog.findMany({
      where: (filters || {}) as any,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * Get audit log statistics
   */
  async getStats(startDate?: Date, endDate?: Date) {
    const where = startDate && endDate
      ? { timestamp: { gte: startDate, lte: endDate } }
      : {};

    const [actionGroups, resourceGroups, totalCount] = await Promise.all([
      prisma.auditLog.groupBy({ by: ['action'], where, _count: { action: true } }),
      prisma.auditLog.groupBy({ by: ['resource'], where, _count: { resource: true } }),
      prisma.auditLog.count({ where })
    ]);

    // groupBy has no ordering by the count, so the sort stays here. The shape
    // is kept as { _id, count } so callers do not have to change.
    const actionStats = actionGroups
      .map(g => ({ _id: g.action, count: g._count.action }))
      .sort((a, b) => b.count - a.count);
    const resourceStats = resourceGroups
      .map(g => ({ _id: g.resource, count: g._count.resource }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCount,
      byAction: actionStats,
      byResource: resourceStats
    };
  }
}

export const auditLogService = new AuditLogService();
