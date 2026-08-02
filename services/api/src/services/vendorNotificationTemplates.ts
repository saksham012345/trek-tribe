type VendorEventType = 'vendor_payment_completed' | 'pre_departure_reminder';

export function renderVendorEmail(eventType: VendorEventType, payload: any): { subject: string; html: string } {
  switch (eventType) {
    case 'vendor_payment_completed':
      return {
        subject: `Payment Confirmation — ${payload.vendorBusinessName || 'Vendor'}`,
        html: `<p>Hi ${payload.vendorBusinessName || 'there'},</p>
<p>We've recorded a payment of ₹${payload.amount} against your assignment.</p>
<p>Thank you for your continued partnership.</p>`
      };
    case 'pre_departure_reminder':
      return {
        subject: `Reminder: Upcoming Trip — ${payload.tripTitle}`,
        html: `<p>Hi ${payload.vendorBusinessName || 'there'},</p>
<p>This is a reminder that "${payload.tripTitle}" departs on ${payload.startDate}. Please confirm your readiness.</p>`
      };
    default:
      throw new Error(`No template for event type: ${eventType}`);
  }
}
