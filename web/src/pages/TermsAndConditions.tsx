import React from 'react';
import { Link } from 'react-router-dom';

const TermsAndConditions: React.FC = () => {
  const lastUpdated = "October 4, 2024";

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-4">
              Terms & Conditions
            </h1>
            <p className="text-forest-600">
              <strong>Last Updated:</strong> {lastUpdated}
            </p>
            <div className="mt-4 p-4 bg-nature-50 border border-nature-200 rounded-lg">
              <p className="text-sm text-nature-700">
                <strong>Welcome to Trek Tribe!</strong> By using our platform, you agree to these terms. 
                Please read them carefully as they contain important information about your rights and responsibilities.
              </p>
            </div>
          </div>

          <div className="prose max-w-none">
            
            {/* Table of Contents */}
            <div className="mb-8 p-6 bg-forest-50 rounded-lg border border-forest-200">
              <h2 className="text-xl font-semibold text-forest-800 mb-4">Table of Contents</h2>
              <ul className="space-y-2 text-sm">
                <li><a href="#acceptance" className="text-nature-600 hover:underline">1. Acceptance of Terms</a></li>
                <li><a href="#description" className="text-nature-600 hover:underline">2. Service Description</a></li>
                <li><a href="#eligibility" className="text-nature-600 hover:underline">3. Eligibility</a></li>
                <li><a href="#user-accounts" className="text-nature-600 hover:underline">4. User Accounts</a></li>
                <li><a href="#user-conduct" className="text-nature-600 hover:underline">5. User Conduct</a></li>
                <li><a href="#trip-bookings" className="text-nature-600 hover:underline">6. Trip Bookings & Payments</a></li>
                <li><a href="#organizer-responsibilities" className="text-nature-600 hover:underline">7. Trip Organizer Responsibilities</a></li>
                <li><a href="#safety-risks" className="text-nature-600 hover:underline">8. Safety & Risk Acknowledgment</a></li>
                <li><a href="#liability" className="text-nature-600 hover:underline">9. Limitation of Liability</a></li>
                <li><a href="#intellectual-property" className="text-nature-600 hover:underline">10. Intellectual Property</a></li>
                <li><a href="#privacy" className="text-nature-600 hover:underline">11. Privacy Policy</a></li>
                <li><a href="#termination" className="text-nature-600 hover:underline">12. Account Termination</a></li>
                <li><a href="#disputes" className="text-nature-600 hover:underline">13. Dispute Resolution</a></li>
                <li><a href="#changes" className="text-nature-600 hover:underline">14. Changes to Terms</a></li>
                <li><a href="#contact" className="text-nature-600 hover:underline">15. Contact Information</a></li>
              </ul>
            </div>

            {/* Section 1 */}
            <section id="acceptance" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                1. Acceptance of Terms
              </h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-blue-800 font-medium mb-2">
                  📋 By accessing or using Trek Tribe, you agree to be bound by these Terms and Conditions.
                </p>
                <p className="text-blue-700 text-sm">
                  If you do not agree to these terms, please do not use our services.
                </p>
              </div>
              
              <ul className="list-disc pl-6 text-forest-600 space-y-2">
                <li>These terms constitute a legally binding agreement between you and Trek Tribe</li>
                <li>Your continued use of our platform indicates acceptance of any updated terms</li>
                <li>Additional terms may apply to specific services or features</li>
                <li>You must be legally capable of entering into binding contracts</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section id="description" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                2. Service Description
              </h2>
              
              <p className="text-forest-600 mb-4">
                Trek Tribe is an online platform that connects adventure seekers with trip organizers. 
                Our services include:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">🏔️ For Travelers</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Browse and search adventure trips</li>
                    <li>• Book trips and make payments</li>
                    <li>• Connect with other adventurers</li>
                    <li>• Access trip information and updates</li>
                    <li>• Use safety and tracking features</li>
                    <li>• Real-time chat support</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">🗺️ For Organizers</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Create and manage trip listings</li>
                    <li>• Manage bookings and participants</li>
                    <li>• Communicate with travelers</li>
                    <li>• Access safety and emergency tools</li>
                    <li>• Receive payments securely</li>
                    <li>• Analytics and reporting tools</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium text-sm">
                  ⚠️ <strong>Important:</strong> Trek Tribe acts as an intermediary platform. We facilitate connections 
                  between travelers and organizers but are not the provider of the actual travel services.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section id="eligibility" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                3. Eligibility
              </h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h3 className="text-red-800 font-semibold mb-2">Age Requirements</h3>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• You must be at least 18 years old to use Trek Tribe independently</li>
                  <li>• Minors (under 18) may participate with parent/guardian consent and supervision</li>
                  <li>• All users must provide accurate age information</li>
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-forest-700 mb-3">Additional Requirements</h3>
              <ul className="list-disc pl-6 text-forest-600 space-y-2">
                <li><strong>Legal Capacity:</strong> Ability to enter into legally binding contracts</li>
                <li><strong>Geographic:</strong> Must be in a jurisdiction where our services are available</li>
                <li><strong>Account Limits:</strong> One person, one account (no duplicate accounts)</li>
                <li><strong>Prohibited Users:</strong> Individuals banned from travel or with criminal restrictions related to our services</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="user-accounts" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                4. User Accounts
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-forest-700 mb-3">Account Registration</h3>
                  <ul className="list-disc pl-6 text-forest-600 space-y-1 text-sm">
                    <li>Provide accurate and complete information</li>
                    <li>Maintain current contact details</li>
                    <li>Choose a secure password</li>
                    <li>Verify your email address</li>
                    <li>Complete any required identity verification</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-forest-700 mb-3">Account Security</h3>
                  <ul className="list-disc pl-6 text-forest-600 space-y-1 text-sm">
                    <li>Keep login credentials confidential</li>
                    <li>Do not share accounts with others</li>
                    <li>Report suspicious activity immediately</li>
                    <li>Update security settings regularly</li>
                    <li>Log out from shared devices</li>
                  </ul>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
                <p className="text-orange-800 font-medium text-sm">
                  🔒 <strong>Account Responsibility:</strong> You are responsible for all activities that occur under your account. 
                  Notify us immediately if you suspect unauthorized access.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="user-conduct" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                5. User Conduct
              </h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-green-700 mb-3">✅ Acceptable Use</h3>
                <ul className="list-disc pl-6 text-forest-600 space-y-1">
                  <li>Use the platform for legitimate travel and adventure purposes</li>
                  <li>Provide honest and accurate trip listings and profiles</li>
                  <li>Treat all users with respect and courtesy</li>
                  <li>Follow all applicable laws and regulations</li>
                  <li>Respect intellectual property rights</li>
                  <li>Maintain appropriate communication standards</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-3">❌ Prohibited Activities</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="text-red-700 text-sm space-y-1">
                    <li>• Fraudulent or misleading activities</li>
                    <li>• Harassment, abuse, or discrimination</li>
                    <li>• Spam or unsolicited communications</li>
                    <li>• Sharing inappropriate content</li>
                    <li>• Attempting to hack or disrupt services</li>
                  </ul>
                  <ul className="text-red-700 text-sm space-y-1">
                    <li>• Violating others' privacy or rights</li>
                    <li>• Commercial activities outside platform rules</li>
                    <li>• Creating fake accounts or reviews</li>
                    <li>• Sharing illegal or dangerous content</li>
                    <li>• Circumventing security measures</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section id="trip-bookings" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                6. Trip Bookings & Payments
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">💳 Payment Terms</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Payments due at time of booking</li>
                    <li>• Secure processing through approved providers</li>
                    <li>• All prices include applicable platform fees</li>
                    <li>• Currency conversion may apply additional charges</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">📅 Booking Process</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Review trip details carefully before booking</li>
                    <li>• Bookings are subject to organizer approval</li>
                    <li>• Confirmation email sent upon acceptance</li>
                    <li>• Trip details may be updated by organizers</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 mb-2">🔄 Cancellation Policy</h3>
                  <div className="text-yellow-700 text-sm space-y-2">
                    <p><strong>By Traveler:</strong> Subject to the specific cancellation policy set by the trip organizer</p>
                    <p><strong>By Organizer:</strong> Must provide reasonable notice; full refunds typically required</p>
                    <p><strong>Force Majeure:</strong> Cancellations due to weather, natural disasters, or government restrictions</p>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">💰 Refund Policy</h3>
                  <ul className="text-purple-700 text-sm space-y-1">
                    <li>• Refunds processed according to the specific trip's cancellation policy</li>
                    <li>• Platform fees may be non-refundable in certain circumstances</li>
                    <li>• Processing time: 5-10 business days after approval</li>
                    <li>• Refunds issued to original payment method when possible</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section id="organizer-responsibilities" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                7. Trip Organizer Responsibilities
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">📋 Pre-Trip Requirements</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Provide accurate trip descriptions</li>
                    <li>• Maintain proper licenses and permits</li>
                    <li>• Conduct participant screening when necessary</li>
                    <li>• Communicate requirements clearly</li>
                    <li>• Maintain adequate insurance coverage</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">🏔️ During Trip Obligations</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Ensure participant safety and well-being</li>
                    <li>• Follow established safety protocols</li>
                    <li>• Maintain emergency communication capabilities</li>
                    <li>• Provide services as described in listing</li>
                    <li>• Handle emergencies appropriately</li>
                  </ul>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">⚠️ Legal Compliance</h3>
                <p className="text-red-700 text-sm mb-2">
                  Trip organizers are responsible for:
                </p>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• Compliance with all applicable laws and regulations</li>
                  <li>• Obtaining necessary permits and licenses</li>
                  <li>• Meeting safety and environmental standards</li>
                  <li>• Proper tax reporting and remittance</li>
                  <li>• Maintaining appropriate insurance coverage</li>
                </ul>
              </div>
            </section>

            {/* Section 8 */}
            <section id="safety-risks" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                8. Safety & Risk Acknowledgment
              </h2>
              
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
                <h3 className="text-red-800 font-bold mb-3 text-center">
                  ⚠️ ASSUMPTION OF RISK NOTICE ⚠️
                </h3>
                <div className="text-red-700 space-y-3">
                  <p className="font-medium">
                    Adventure travel and outdoor activities involve inherent risks that may result in 
                    serious injury, illness, or death.
                  </p>
                  <p>
                    By participating in trips organized through Trek Tribe, you acknowledge and assume these risks, including but not limited to:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>Weather-related hazards and natural disasters</li>
                    <li>Terrain difficulties and navigation challenges</li>
                    <li>Equipment failure or inadequate equipment</li>
                    <li>Medical emergencies in remote locations</li>
                    <li>Wildlife encounters and environmental dangers</li>
                    <li>Transportation risks and accidents</li>
                    <li>Food and water-borne illnesses</li>
                    <li>Cultural misunderstandings or political instability</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">🛡️ Safety Measures</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Emergency contact systems</li>
                    <li>• Location tracking capabilities</li>
                    <li>• Safety protocol guidelines</li>
                    <li>• Communication with authorities when needed</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">📋 Your Responsibilities</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Disclose relevant medical conditions</li>
                    <li>• Follow organizer safety instructions</li>
                    <li>• Maintain appropriate travel insurance</li>
                    <li>• Use provided safety equipment properly</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section id="liability" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                9. Limitation of Liability
              </h2>
              
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                <h3 className="text-gray-800 font-bold mb-3">LIMITATION OF LIABILITY CLAUSE</h3>
                <div className="text-gray-700 space-y-3 text-sm">
                  <p>
                    <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW, TREK TRIBE SHALL NOT BE LIABLE FOR:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                    <li>Loss of profits, revenue, data, or business opportunities</li>
                    <li>Personal injury, illness, or death occurring during trips</li>
                    <li>Damages resulting from third-party actions (including trip organizers)</li>
                    <li>Service interruptions or technical failures</li>
                  </ul>
                  <p className="font-medium mt-4">
                    OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SPECIFIC SERVICE IN QUESTION.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Platform Role:</strong> Trek Tribe acts as an intermediary platform connecting travelers with organizers. 
                  We do not operate, control, or supervise the actual trips or activities.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section id="intellectual-property" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                10. Intellectual Property
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">🏢 Trek Tribe Property</h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Website design and functionality</li>
                    <li>• Trek Tribe logos and branding</li>
                    <li>• Software and algorithms</li>
                    <li>• Content and documentation</li>
                    <li>• Trademarks and service marks</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">👤 User Content Rights</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• You retain ownership of your content</li>
                    <li>• Grant us license to use for platform operations</li>
                    <li>• Must not infringe others' rights</li>
                    <li>• Responsible for content accuracy</li>
                    <li>• May be removed if violating policies</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">⚖️ Copyright Policy</h3>
                <p className="text-yellow-700 text-sm">
                  We respect intellectual property rights and respond to valid copyright claims. 
                  Report infringement to <a href="mailto:legal@trekktribe.com" className="underline">legal@trekktribe.com</a>.
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section id="privacy" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                11. Privacy Policy
              </h2>
              
              <div className="bg-nature-50 border border-nature-200 rounded-lg p-4">
                <p className="text-nature-700 mb-3">
                  Your privacy is important to us. Our <Link to="/privacy-policy" className="text-nature-600 underline font-medium">Privacy Policy</Link> explains:
                </p>
                <ul className="text-nature-700 text-sm space-y-1">
                  <li>• What information we collect and why</li>
                  <li>• How we use and protect your data</li>
                  <li>• Your rights and choices regarding your information</li>
                  <li>• Cookie usage and management options</li>
                  <li>• How to contact us with privacy questions</li>
                </ul>
                <p className="text-nature-700 text-sm mt-3">
                  By using Trek Tribe, you also agree to our Privacy Policy.
                </p>
              </div>
            </section>

            {/* Section 12 */}
            <section id="termination" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                12. Account Termination
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">By You</h3>
                  <p className="text-blue-700 text-sm">
                    You may terminate your account at any time through account settings or by contacting support. 
                    Active bookings and obligations survive account closure.
                  </p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <h3 className="font-semibold text-red-800 mb-2">By Trek Tribe</h3>
                  <p className="text-red-700 text-sm mb-2">We may suspend or terminate accounts for:</p>
                  <ul className="text-red-700 text-sm space-y-1">
                    <li>• Violation of these terms or policies</li>
                    <li>• Fraudulent or harmful activities</li>
                    <li>• Extended periods of inactivity</li>
                    <li>• Legal or regulatory requirements</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 13 */}
            <section id="disputes" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                13. Dispute Resolution
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">🤝 Informal Resolution</h3>
                  <p className="text-green-700 text-sm">
                    Please contact us first at <a href="mailto:support@trekktribe.com" className="underline">support@trekktribe.com</a> to resolve disputes amicably. 
                    We're committed to finding fair solutions.
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">⚖️ Formal Dispute Resolution</h3>
                  <p className="text-blue-700 text-sm">
                    If informal resolution fails, disputes may be resolved through binding arbitration 
                    or in courts of competent jurisdiction, subject to applicable laws.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">🌍 Governing Law</h3>
                  <p className="text-purple-700 text-sm">
                    These terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 14 */}
            <section id="changes" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                14. Changes to Terms
              </h2>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-800 mb-2">📝 Updates and Modifications</h3>
                <div className="text-orange-700 text-sm space-y-2">
                  <p>We may update these terms periodically. We will notify you of material changes through:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Email notification to registered users</li>
                    <li>Prominent notice on our platform</li>
                    <li>In-app notifications</li>
                    <li>Updated "Last Updated" date</li>
                  </ul>
                  <p className="font-medium mt-2">
                    Continued use after changes constitutes acceptance of updated terms.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 15 */}
            <section id="contact" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                15. Contact Information
              </h2>
              
              <div className="bg-nature-50 border border-nature-200 rounded-lg p-6">
                <h3 className="font-semibold text-nature-800 mb-4">📞 Get in Touch</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-nature-700 mb-2">
                      <strong>General Support:</strong> <a href="mailto:support@trekktribe.com" className="text-nature-600 underline">support@trekktribe.com</a>
                    </p>
                    <p className="text-nature-700 mb-2">
                      <strong>Legal Inquiries:</strong> <a href="mailto:legal@trekktribe.com" className="text-nature-600 underline">legal@trekktribe.com</a>
                    </p>
                    <p className="text-nature-700">
                      <strong>Phone:</strong> +1 (555) 123-TREK
                    </p>
                  </div>
                  <div>
                    <p className="text-nature-700 mb-2">
                      <strong>Mailing Address:</strong>
                    </p>
                    <p className="text-nature-700">
                      Trek Tribe Legal Department<br/>
                      123 Adventure Way<br/>
                      Mountain View, CA 94041<br/>
                      United States
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className="text-center pt-8 border-t border-forest-200">
              <p className="text-forest-600 mb-4">
                These Terms & Conditions are effective as of {lastUpdated} and govern your use of Trek Tribe.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                <Link to="/privacy-policy" className="text-nature-600 hover:underline">Privacy Policy</Link>
                <Link to="/cookie-policy" className="text-nature-600 hover:underline">Cookie Policy</Link>
                <Link to="/contact" className="text-nature-600 hover:underline">Contact Us</Link>
                <Link to="/" className="text-nature-600 hover:underline">Back to Trek Tribe</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;