/**
 * Booking Payment Component
 * Handles trip booking and payment processing
 */

import React, { useState } from 'react';
import { paymentService, razorpayHelper, handlePaymentError } from '../services/paymentIntegration';

interface BookingProps {
  tripId: string;
  tripName: string;
  basePrice: number;
}

export const BookingPayment: React.FC<BookingProps> = ({
  tripId,
  tripName,
  basePrice,
}) => {
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [travelerDetails, setTravelerDetails] = useState([
    {
      name: '',
      age: '',
      phone: '',
      emergencyContact: '',
      medicalConditions: '',
      dietary: '',
    },
  ]);
  const [processing, setProcessing] = useState(false);
  const [totalAmount, setTotalAmount] = useState(basePrice);

  // Update total amount when travelers change
  const handleTravelerCountChange = (count: number) => {
    setNumberOfTravelers(count);
    setTotalAmount(basePrice * count);

    // Adjust traveler details array
    const newDetails = [...travelerDetails];
    while (newDetails.length < count) {
      newDetails.push({
        name: '',
        age: '',
        phone: '',
        emergencyContact: '',
        medicalConditions: '',
        dietary: '',
      });
    }
    setTravelerDetails(newDetails.slice(0, count));
  };

  const handleTravelerChange = (index: number, field: string, value: string) => {
    const updated = [...travelerDetails];
    updated[index] = { ...updated[index], [field]: value };
    setTravelerDetails(updated);
  };

  const handleBookingAndPayment = async () => {
    try {
      setProcessing(true);

      // Validate traveler details
      const allFilled = travelerDetails.every(
        (t) => t.name.trim() && t.age && t.phone
      );
      if (!allFilled) {
        alert('Please fill in all required traveler details');
        return;
      }

      // Step 1: Create booking
      const bookingResponse = await paymentService.createBooking(
        tripId,
        numberOfTravelers,
        travelerDetails
      );

      if (!bookingResponse.success || !bookingResponse.bookingId) {
        throw new Error('Failed to create booking');
      }

      const bookingId = bookingResponse.bookingId;

      // Step 2: Create payment order
      const orderResponse = await paymentService.createBookingPaymentOrder(bookingId);

      // Step 3: Open Razorpay checkout
      await razorpayHelper.openCheckout({
        amount: orderResponse.amount,
        orderId: orderResponse.orderId,
        description: `Booking for ${tripName} - ${numberOfTravelers} travelers`,
        prefill: {
          name: travelerDetails[0]?.name || '',
          email: '',
          contact: travelerDetails[0]?.phone || '',
        },
        onSuccess: async (response) => {
          // Step 4: Verify payment
          try {
            const verifyResponse = await paymentService.verifyBookingPayment(
              bookingId,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verifyResponse.success) {
              alert('✅ Booking confirmed! Check your email for confirmation.');
              // Redirect to bookings page
              window.location.href = '/dashboard/bookings';
            }
          } catch (error) {
            alert(`❌ Verification failed: ${handlePaymentError(error)}`);
          }
        },
        onError: (error) => {
          alert(`❌ Payment failed: ${handlePaymentError(error)}`);
        },
      });
    } catch (error) {
      alert(`❌ ${handlePaymentError(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="booking-payment">
      <h2>Complete Your Booking: {tripName}</h2>

      {/* Traveler Count */}
      <section className="traveler-count">
        <label>Number of Travelers:</label>
        <input
          type="number"
          min="1"
          max="10"
          value={numberOfTravelers}
          onChange={(e) => handleTravelerCountChange(parseInt(e.target.value))}
          disabled={processing}
        />
      </section>

      {/* Traveler Details */}
      <section className="traveler-details">
        <h3>Traveler Information</h3>
        {travelerDetails.map((traveler, index) => (
          <div key={index} className="traveler-form">
            <h4>Traveler {index + 1}</h4>

            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={traveler.name}
                onChange={(e) => handleTravelerChange(index, 'name', e.target.value)}
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label>Age *</label>
              <input
                type="number"
                min="1"
                max="100"
                value={traveler.age}
                onChange={(e) => handleTravelerChange(index, 'age', e.target.value)}
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                value={traveler.phone}
                onChange={(e) => handleTravelerChange(index, 'phone', e.target.value)}
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label>Emergency Contact</label>
              <input
                type="tel"
                value={traveler.emergencyContact}
                onChange={(e) =>
                  handleTravelerChange(index, 'emergencyContact', e.target.value)
                }
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label>Medical Conditions</label>
              <input
                type="text"
                placeholder="e.g., Asthma, Heart condition"
                value={traveler.medicalConditions}
                onChange={(e) =>
                  handleTravelerChange(index, 'medicalConditions', e.target.value)
                }
                disabled={processing}
              />
            </div>

            <div className="form-group">
              <label>Dietary Requirements</label>
              <input
                type="text"
                placeholder="e.g., Vegetarian, Gluten-free"
                value={traveler.dietary}
                onChange={(e) => handleTravelerChange(index, 'dietary', e.target.value)}
                disabled={processing}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Price Summary */}
      <section className="price-summary">
        <h3>Price Summary</h3>
        <div className="summary-row">
          <span>Base Price per Traveler:</span>
          <span>₹{basePrice}</span>
        </div>
        <div className="summary-row">
          <span>Number of Travelers:</span>
          <span>{numberOfTravelers}</span>
        </div>
        <div className="summary-row total">
          <span>Total Amount:</span>
          <span className="amount">₹{totalAmount}</span>
        </div>
      </section>

      {/* Payment Button */}
      <button
        onClick={handleBookingAndPayment}
        disabled={processing || numberOfTravelers === 0}
        className="btn btn-primary btn-large"
      >
        {processing ? 'Processing...' : `Pay ₹${totalAmount} & Confirm Booking`}
      </button>
    </div>
  );
};

export default BookingPayment;
