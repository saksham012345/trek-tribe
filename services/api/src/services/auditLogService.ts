import { AuditLog, AuditLogDocument } from '../models/AuditLog';
import { Request } from 'express';

interface LogAuditParams {
  userId: string;
  userEmail?: string;
  action: AuditLogDocument['action'];
  resource: AuditLogDocument['resource'];
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

      await AuditLog.create({
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        changes,
        metadata: {
          ...requestMetadata,
          ...metadata
        },
        status,
        errorMessage,
        timestamp: new Date()
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
    action: AuditLogDocument['action'], 
    resource: AuditLogDocument['resource'],
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
    resource: AuditLogDocument['resource'],
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
    return await AuditLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceLogs(resource: string, resourceId: string, limit: number = 50) {
    return await AuditLog.find({ resource, resourceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();
  }

  /**
   * Get recent audit logs (for admin dashboard)
   */
  async getRecentLogs(limit: number = 100, filters?: any) {
    const query = filters || {};
    return await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'name email role')
      .lean();
  }

  /**
   * Get audit log statistics
   */
  async getStats(startDate?: Date, endDate?: Date) {
    const dateFilter = startDate && endDate ? {
      timestamp: { $gte: startDate, $lte: endDate }
    } : {};

    const [actionStats, resourceStats, totalCount] = await Promise.all([
      // Group by action
      AuditLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      // Group by resource
      AuditLog.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      // Total count
      AuditLog.countDocuments(dateFilter)
    ]);

    return {
      totalCount,
      byAction: actionStats,
      byResource: resourceStats
    };
  }
}

export const auditLogService = new AuditLogService();
