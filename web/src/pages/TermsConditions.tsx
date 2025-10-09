import React from 'react';
import { FileText, Users, CreditCard, AlertTriangle, Scale, Globe } from 'lucide-react';

const TermsConditions: React.FC = () => {
  const lastUpdated = "January 9, 2025";

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-forest-600" />
            <h1 className="text-4xl font-bold text-forest-800">Terms & Conditions</h1>
          </div>
          <p className="text-xl text-gray-600 mb-2">
            Please read these terms carefully before using Trek Tribe
          </p>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">

          {/* Acceptance */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Scale className="w-6 h-6" />
              1. Acceptance of Terms
            </h2>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-6">
              <p className="text-gray-700 leading-relaxed mb-3">
                By accessing and using Trek Tribe ("the Service"), you accept and agree to be bound by the terms 
                and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
              <p className="text-gray-700 leading-relaxed">
                These terms apply to all visitors, users, and others who access or use the service, including 
                trip organizers, participants, and general users.
              </p>
            </div>
          </section>

          {/* Description of Service */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Globe className="w-6 h-6" />
              2. Description of Service
            </h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Trek Tribe is an online platform that connects adventure enthusiasts and facilitates outdoor experiences. 
                Our services include:
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-forest-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-forest-800 mb-2">For Travelers:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Browse and book adventure trips</li>
                    <li>• Connect with fellow adventurers</li>
                    <li>• Access trip information and itineraries</li>
                    <li>• Leave reviews and ratings</li>
                  </ul>
                </div>
                <div className="bg-nature-50 p-4 rounded-xl">
                  <h4 className="font-semibold text-forest-800 mb-2">For Organizers:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Create and manage adventure trips</li>
                    <li>• Communicate with participants</li>
                    <li>• Manage bookings and payments</li>
                    <li>• Build your organizer profile</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              3. User Responsibilities
            </h2>
            
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Account Requirements</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>You must be at least 18 years old to use this service</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Provide accurate, current, and complete information during registration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Maintain and update your account information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    <span>Keep your login credentials secure and confidential</span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-red-800 mb-3">Prohibited Activities</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Fraudulent or illegal activities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Harassment or threatening behavior</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Spam or unauthorized advertising</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Violating intellectual property rights</span>
                    </li>
                  </ul>
                  <ul className="space-y-2 text-gray-700 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Impersonating others</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Spreading malware or viruses</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Circumventing security measures</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-600 mt-1">✗</span>
                      <span>Creating fake accounts or reviews</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Trip Booking & Payments */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              4. Trip Booking & Payments
            </h2>
            
            <div className="space-y-6">
              <div className="bg-green-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Booking Process</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>All bookings are subject to availability and organizer approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Payment confirms your booking and agreement to trip terms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Trip details, including dates and itineraries, may be subject to change</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span>Participants must meet any specified requirements or restrictions</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Cancellation & Refunds</h3>
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm">
                    Cancellation policies vary by trip and are set by individual organizers. 
                    Common policies include:
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="border border-blue-200 p-3 rounded-lg">
                      <h4 className="font-semibold text-blue-800 text-sm mb-1">Flexible</h4>
                      <p className="text-xs text-gray-600">Full refund 24h before trip</p>
                    </div>
                    <div className="border border-blue-200 p-3 rounded-lg">
                      <h4 className="font-semibold text-blue-800 text-sm mb-1">Moderate</h4>
                      <p className="text-xs text-gray-600">50% refund 3+ days before</p>
                    </div>
                    <div className="border border-blue-200 p-3 rounded-lg">
                      <h4 className="font-semibold text-blue-800 text-sm mb-1">Strict</h4>
                      <p className="text-xs text-gray-600">No refund after booking</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Safety & Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              5. Safety & Liability
            </h2>
            
            <div className="space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-400 p-6">
                <h3 className="text-lg font-semibold text-orange-800 mb-3">⚠️ Important Safety Notice</h3>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Adventure activities involve inherent risks. By participating in trips organized through Trek Tribe, 
                  you acknowledge and assume these risks. We strongly recommend:
                </p>
                <ul className="space-y-1 text-gray-700 text-sm">
                  <li>• Obtaining appropriate travel and activity insurance</li>
                  <li>• Ensuring you meet physical fitness requirements</li>
                  <li>• Following all safety instructions provided by organizers</li>
                  <li>• Disclosing any medical conditions or limitations</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Limitation of Liability</h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  Trek Tribe acts as a platform connecting users and is not responsible for the actual provision of 
                  trip services. Trip organizers are independent operators responsible for their own activities. 
                  Trek Tribe's liability is limited to the maximum extent permitted by law.
                </p>
              </div>
            </div>
          </section>

          {/* Organizer Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">6. Organizer Responsibilities</h2>
            
            <div className="bg-purple-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-forest-800 mb-4">If you organize trips, you must:</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-purple-800 mb-2">Legal & Safety:</h4>
                  <ul className="space-y-1 text-gray-700 text-sm">
                    <li>• Hold necessary licenses and permits</li>
                    <li>• Maintain appropriate insurance coverage</li>
                    <li>• Comply with local laws and regulations</li>
                    <li>• Ensure participant safety at all times</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800 mb-2">Service Quality:</h4>
                  <ul className="space-y-1 text-gray-700 text-sm">
                    <li>• Provide accurate trip descriptions</li>
                    <li>• Deliver services as advertised</li>
                    <li>• Communicate clearly with participants</li>
                    <li>• Handle refunds according to your policy</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">7. Intellectual Property</h2>
            <div className="space-y-4">
              <div className="bg-indigo-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Platform Content</h3>
                <p className="text-gray-700 leading-relaxed text-sm mb-3">
                  All content on Trek Tribe, including but not limited to text, graphics, logos, images, and software, 
                  is the property of Trek Tribe or its licensors and is protected by copyright and other intellectual property laws.
                </p>
              </div>

              <div className="bg-indigo-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">User Content</h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  By uploading content (photos, reviews, trip descriptions), you grant Trek Tribe a worldwide, 
                  non-exclusive, royalty-free license to use, display, and distribute your content in connection with the service.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">8. Privacy</h2>
            <div className="bg-gradient-to-r from-forest-100 to-nature-100 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. Please review our{' '}
                <a href="/privacy-policy" className="text-forest-600 hover:underline font-semibold">
                  Privacy Policy
                </a>, which also governs your use of the service, to understand our practices regarding 
                the collection and use of your personal information.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">9. Termination</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to terminate or suspend your account and access to the service immediately, 
                without prior notice, for conduct that we believe violates these terms or is harmful to other users, 
                us, or third parties.
              </p>
              
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                <h4 className="font-semibold text-red-800 mb-2">Reasons for termination may include:</h4>
                <ul className="text-red-700 text-sm space-y-1">
                  <li>• Violation of terms and conditions</li>
                  <li>• Fraudulent or illegal activity</li>
                  <li>• Harassment of other users</li>
                  <li>• Multiple complaints against your account</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">10. Changes to Terms</h2>
            <div className="bg-blue-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed mb-3">
                We reserve the right to modify these terms at any time. We will notify users of significant changes 
                via email or by posting a notice on our website. Your continued use of the service after such 
                modifications constitutes acceptance of the updated terms.
              </p>
              <p className="text-blue-700 text-sm font-semibold">
                We recommend reviewing these terms periodically for any changes.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">11. Governing Law</h2>
            <div className="bg-gray-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed">
                These terms shall be interpreted and governed in accordance with the laws of California, United States, 
                without regard to conflict of law provisions. Any disputes arising from these terms or your use of 
                the service shall be resolved in the courts of California.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">12. Contact Information</h2>
            <div className="bg-gradient-to-r from-forest-600 to-nature-600 text-white p-6 rounded-xl">
              <p className="mb-4">
                If you have any questions about these Terms and Conditions, please contact us:
              </p>
              <div className="space-y-2 text-sm">
                <div>📧 Email: legal@trekktribe.com</div>
                <div>📞 Phone: +1 (555) 123-4567</div>
                <div>📍 Address: 123 Adventure Lane, Mountain View, CA 94041</div>
              </div>
            </div>
          </section>

          {/* Agreement */}
          <section>
            <div className="border-t border-gray-200 pt-6">
              <div className="bg-forest-50 p-6 rounded-xl text-center">
                <p className="text-forest-800 font-semibold mb-2">
                  By using Trek Tribe, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
                </p>
                <p className="text-forest-600 text-sm">
                  These terms constitute the entire agreement between you and Trek Tribe regarding your use of the service.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default TermsConditions;