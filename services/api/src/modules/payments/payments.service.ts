export async function createSubscriptionCheckout(userId: string, planId: string): Promise<any> {
  throw new Error("Payment service not implemented.");
}

export async function createBookingCheckout(userId: string, tripId: string, numberOfTravelers: number, bookingId?: string): Promise<any> {
  throw new Error("Payment service not implemented.");
}

export async function verifyAndFulfillPayment(userId: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): Promise<any> {
  throw new Error("Payment service not implemented.");
}
