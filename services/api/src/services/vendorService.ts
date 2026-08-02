import { prisma } from '../lib/prisma';
import { Prisma, VendorCategory, VendorAvailability } from '@prisma/client';

export interface VendorInput {
  businessName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  whatsappNumber?: string;
  category: VendorCategory;
  customCategoryLabel?: string;
  address?: string;
  gstNumber?: string;
  pricingNotes?: string;
  rating?: number;
  availabilityStatus?: VendorAvailability;
  notes?: string;
}

class VendorService {
  async createVendor(organizerId: string, data: VendorInput) {
    return prisma.vendor.create({
      data: { organizerId, ...data }
    });
  }

  async listVendors(organizerId: string) {
    return prisma.vendor.findMany({ where: { organizerId }, orderBy: { createdAt: 'desc' } });
  }

  async getVendor(organizerId: string, vendorId: string) {
    return prisma.vendor.findFirst({ where: { id: vendorId, organizerId } });
  }

  async updateVendor(organizerId: string, vendorId: string, data: Partial<VendorInput>) {
    const existing = await this.getVendor(organizerId, vendorId);
    if (!existing) throw new Error('Vendor not found');
    return prisma.vendor.update({ where: { id: vendorId }, data });
  }

  async deleteVendor(organizerId: string, vendorId: string) {
    const existing = await this.getVendor(organizerId, vendorId);
    if (!existing) throw new Error('Vendor not found');
    await prisma.vendor.delete({ where: { id: vendorId } });
  }
}

export const vendorService = new VendorService();
