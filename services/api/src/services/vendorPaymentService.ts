import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

async function assertOwnedAssignment(organizerId: string, assignmentId: string) {
  const assignment = await prisma.tripVendorAssignment.findUnique({
    where: { id: assignmentId },
    include: { vendor: true }
  });
  if (!assignment || assignment.vendor.organizerId !== organizerId) {
    const err: any = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  return assignment;
}

class VendorPaymentService {
  async recordPayment(
    organizerId: string,
    assignmentId: string,
    amount: number,
    note?: string,
    totalAmount?: number,
    dueDate?: Date
  ) {
    await assertOwnedAssignment(organizerId, assignmentId);

    return prisma.$transaction(async (tx) => {
      let payment = await tx.vendorPayment.findUnique({ where: { assignmentId } });

      if (!payment) {
        if (totalAmount === undefined) {
          const err: any = new Error('totalAmount is required for the first payment on this assignment');
          err.status = 400;
          throw err;
        }
        payment = await tx.vendorPayment.create({
          data: { assignmentId, totalAmount, paidAmount: 0, dueDate, status: 'pending' }
        });
      }

      const newPaidAmount = new Prisma.Decimal(payment.paidAmount).plus(amount);
      const status = newPaidAmount.gte(payment.totalAmount) ? 'paid' : 'partial';

      await tx.vendorPayment.update({
        where: { assignmentId },
        data: { paidAmount: newPaidAmount, status }
      });

      return tx.vendorPaymentHistory.create({
        data: { vendorPaymentId: payment.id, amount, note }
      });
    });
  }

  async getPaymentSummary(organizerId: string, assignmentId: string) {
    await assertOwnedAssignment(organizerId, assignmentId);
    return prisma.vendorPayment.findUnique({
      where: { assignmentId },
      include: { history: { orderBy: { paidAt: 'desc' } } }
    });
  }
}

export const vendorPaymentService = new VendorPaymentService();
