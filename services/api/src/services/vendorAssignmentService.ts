import { prisma } from '../lib/prisma';
import { VendorCategory } from '@prisma/client';
import { Trip } from '../models/Trip';
import { vendorService } from './vendorService';

class VendorAssignmentService {
  async assignVendor(organizerId: string, tripId: string, vendorId: string, category: VendorCategory) {
    const trip = await Trip.findById(tripId).select('organizerId');
    if (!trip) {
      const err: any = new Error('Trip not found');
      err.status = 404;
      throw err;
    }
    if (trip.organizerId.toString() !== organizerId) {
      const err: any = new Error('Access denied. You can only assign vendors to your own trips.');
      err.status = 403;
      throw err;
    }

    const vendor = await vendorService.getVendor(organizerId, vendorId);
    if (!vendor) {
      const err: any = new Error('Vendor not found');
      err.status = 404;
      throw err;
    }

    return prisma.tripVendorAssignment.create({
      data: { tripId, vendorId, category }
    });
  }

  async unassignVendor(organizerId: string, assignmentId: string) {
    const assignment = await prisma.tripVendorAssignment.findUnique({
      where: { id: assignmentId },
      include: { vendor: true }
    });
    if (!assignment || assignment.vendor.organizerId !== organizerId) {
      const err: any = new Error('Assignment not found');
      err.status = 404;
      throw err;
    }
    await prisma.tripVendorAssignment.delete({ where: { id: assignmentId } });
  }

  async listAssignments(organizerId: string, tripId: string) {
    return prisma.tripVendorAssignment.findMany({
      where: { tripId, vendor: { organizerId } },
      include: { vendor: true }
    });
  }
}

export const vendorAssignmentService = new VendorAssignmentService();
