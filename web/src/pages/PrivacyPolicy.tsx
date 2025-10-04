import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const lastUpdated = "October 4, 2024";

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent mb-4">
              Privacy Policy
            </h1>
            <p className="text-forest-600">
              <strong>Last Updated:</strong> {lastUpdated}
            </p>
            <div className="mt-4 p-4 bg-nature-50 border border-nature-200 rounded-lg">
              <p className="text-sm text-nature-700">
                <strong>Quick Summary:</strong> We respect your privacy and are committed to protecting your personal data. 
                This policy explains how we collect, use, and safeguard your information when you use Trek Tribe.
              </p>
            </div>
          </div>

          <div className="prose max-w-none">
            
            {/* Table of Contents */}
            <div className="mb-8 p-6 bg-forest-50 rounded-lg border border-forest-200">
              <h2 className="text-xl font-semibold text-forest-800 mb-4">Table of Contents</h2>
              <ul className="space-y-2 text-sm">
                <li><a href="#information-we-collect" className="text-nature-600 hover:underline">1. Information We Collect</a></li>
                <li><a href="#how-we-use" className="text-nature-600 hover:underline">2. How We Use Your Information</a></li>
                <li><a href="#sharing-disclosure" className="text-nature-600 hover:underline">3. Information Sharing and Disclosure</a></li>
                <li><a href="#cookies" className="text-nature-600 hover:underline">4. Cookies and Tracking Technologies</a></li>
                <li><a href="#data-security" className="text-nature-600 hover:underline">5. Data Security</a></li>
                <li><a href="#your-rights" className="text-nature-600 hover:underline">6. Your Rights and Choices</a></li>
                <li><a href="#data-retention" className="text-nature-600 hover:underline">7. Data Retention</a></li>
                <li><a href="#international-transfers" className="text-nature-600 hover:underline">8. International Data Transfers</a></li>
                <li><a href="#children" className="text-nature-600 hover:underline">9. Children's Privacy</a></li>
                <li><a href="#changes" className="text-nature-600 hover:underline">10. Changes to This Policy</a></li>
                <li><a href="#contact" className="text-nature-600 hover:underline">11. Contact Us</a></li>
              </ul>
            </div>

            {/* Section 1 */}
            <section id="information-we-collect" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                1. Information We Collect
              </h2>
              
              <h3 className="text-lg font-semibold text-forest-700 mb-3">Personal Information You Provide</h3>
              <ul className="list-disc pl-6 mb-4 text-forest-600">
                <li><strong>Account Information:</strong> Name, email address, password, profile information</li>
                <li><strong>Trip Information:</strong> Travel preferences, emergency contacts, dietary restrictions, medical conditions</li>
                <li><strong>Communication Data:</strong> Messages sent through our chat system, support inquiries</li>
                <li><strong>Payment Information:</strong> Credit card details, billing address (processed by secure third-party providers)</li>
                <li><strong>Location Data:</strong> GPS coordinates during trips (only when you enable location sharing)</li>
              </ul>

              <h3 className="text-lg font-semibold text-forest-700 mb-3">Information We Collect Automatically</h3>
              <ul className="list-disc pl-6 mb-4 text-forest-600">
                <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                <li><strong>Usage Data:</strong> Pages visited, time spent on site, click patterns, search queries</li>
                <li><strong>Location Information:</strong> Approximate location based on IP address</li>
                <li><strong>Cookies and Similar Technologies:</strong> See our Cookie Policy section below</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section id="how-we-use" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                2. How We Use Your Information
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">Service Provision</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Process bookings and payments</li>
                    <li>• Manage your account and profile</li>
                    <li>• Provide customer support</li>
                    <li>• Enable real-time chat functionality</li>
                    <li>• Facilitate trip organization</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">Safety & Security</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Emergency contact notifications</li>
                    <li>• Location tracking for safety</li>
                    <li>• Fraud prevention and detection</li>
                    <li>• Account security monitoring</li>
                    <li>• Trip safety management</li>
                  </ul>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">Communication</h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Trip updates and notifications</li>
                    <li>• Marketing communications (with consent)</li>
                    <li>• Service announcements</li>
                    <li>• Survey requests</li>
                    <li>• Support responses</li>
                  </ul>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h3 className="font-semibold text-orange-800 mb-2">Improvement</h3>
                  <ul className="text-sm text-orange-700 space-y-1">
                    <li>• Analyze usage patterns</li>
                    <li>• Improve our services</li>
                    <li>• Develop new features</li>
                    <li>• Personalize your experience</li>
                    <li>• Research and analytics</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="sharing-disclosure" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                3. Information Sharing and Disclosure
              </h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-medium">
                  🛡️ We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-forest-700 mb-3">We may share information with:</h3>
              <ul className="list-disc pl-6 mb-4 text-forest-600 space-y-2">
                <li><strong>Trip Participants:</strong> Your name and relevant trip information with other participants</li>
                <li><strong>Service Providers:</strong> Payment processors, email services, analytics providers (under strict agreements)</li>
                <li><strong>Emergency Contacts:</strong> Your designated contacts in case of emergencies during trips</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or legal process</li>
                <li><strong>Safety Purposes:</strong> To protect the rights, property, or safety of users or the public</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
              </ul>
            </section>

            {/* Section 4 - Cookies */}
            <section id="cookies" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                4. Cookies and Tracking Technologies
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 mb-2">🍪 Essential Cookies</h3>
                  <p className="text-sm text-yellow-700">
                    Required for basic website functionality, security, and user authentication. Cannot be disabled.
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">📊 Analytics Cookies</h3>
                  <p className="text-sm text-blue-700">
                    Help us understand website usage and improve our services. You can opt out in cookie preferences.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">🎯 Marketing Cookies</h3>
                  <p className="text-sm text-green-700">
                    Used to deliver personalized advertisements and measure campaign effectiveness. Optional.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">⚙️ Functional Cookies</h3>
                  <p className="text-sm text-purple-700">
                    Enable enhanced features like live chat and social media integration. Optional.
                  </p>
                </div>
              </div>

              <p className="text-forest-600 mb-4">
                You can manage your cookie preferences at any time through our cookie consent banner or 
                by visiting our <Link to="/cookie-policy" className="text-nature-600 hover:underline">Cookie Policy</Link> page.
              </p>
            </section>

            {/* Section 5 */}
            <section id="data-security" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                5. Data Security
              </h2>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium mb-2">🔒 Our Security Measures:</p>
                <ul className="text-green-700 space-y-1">
                  <li>• SSL/TLS encryption for data transmission</li>
                  <li>• Encrypted data storage</li>
                  <li>• Regular security audits and monitoring</li>
                  <li>• Limited access to personal information</li>
                  <li>• Secure authentication systems</li>
                  <li>• Regular staff security training</li>
                </ul>
              </div>

              <p className="text-forest-600">
                While we implement industry-standard security measures, no method of transmission over the internet 
                is 100% secure. We continuously work to improve our security practices and promptly address any vulnerabilities.
              </p>
            </section>

            {/* Section 6 */}
            <section id="your-rights" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                6. Your Rights and Choices
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">GDPR Rights (EU Users)</h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Right to access your data</li>
                    <li>• Right to rectification</li>
                    <li>• Right to erasure</li>
                    <li>• Right to data portability</li>
                    <li>• Right to object</li>
                    <li>• Right to restrict processing</li>
                  </ul>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">CCPA Rights (California Users)</h3>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Right to know what information is collected</li>
                    <li>• Right to delete personal information</li>
                    <li>• Right to opt-out of sale</li>
                    <li>• Right to non-discrimination</li>
                  </ul>
                </div>
              </div>

              <div className="bg-nature-50 border border-nature-200 rounded-lg p-4">
                <h3 className="font-semibold text-nature-800 mb-2">How to Exercise Your Rights:</h3>
                <ul className="text-nature-700 space-y-1">
                  <li>• Contact us at <a href="mailto:privacy@trekktribe.com" className="text-nature-600 underline">privacy@trekktribe.com</a></li>
                  <li>• Use the "Account Settings" section in your profile</li>
                  <li>• Submit a request through our <Link to="/contact" className="text-nature-600 underline">Contact Form</Link></li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section id="data-retention" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                7. Data Retention
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">Account Data</h3>
                  <p className="text-sm text-gray-700">
                    Retained for as long as your account is active, plus 3 years after account closure for legal and business purposes.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">Trip Data</h3>
                  <p className="text-sm text-gray-700">
                    Trip information is retained for 7 years for safety, insurance, and legal compliance purposes.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-2">Communication Data</h3>
                  <p className="text-sm text-gray-700">
                    Chat messages and support communications are retained for 2 years for quality assurance and dispute resolution.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section id="international-transfers" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                8. International Data Transfers
              </h2>
              
              <p className="text-forest-600 mb-4">
                Trek Tribe operates globally. Your information may be transferred to, stored in, and processed in 
                countries other than your own. We ensure appropriate safeguards are in place for international transfers:
              </p>
              
              <ul className="list-disc pl-6 text-forest-600 space-y-2">
                <li>EU Standard Contractual Clauses for GDPR compliance</li>
                <li>Adequacy decisions by relevant authorities</li>
                <li>Binding corporate rules where applicable</li>
                <li>Your explicit consent where required</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="children" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                9. Children's Privacy
              </h2>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium mb-2">
                  🔞 Trek Tribe is not intended for children under 18 years of age.
                </p>
                <p className="text-red-700">
                  We do not knowingly collect personal information from children under 18. If you believe we have 
                  inadvertently collected such information, please contact us immediately, and we will delete it.
                  Parents or guardians may accompany minors on trips with proper consent and supervision arrangements.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section id="changes" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                10. Changes to This Privacy Policy
              </h2>
              
              <p className="text-forest-600 mb-4">
                We may update this Privacy Policy periodically to reflect changes in our practices, technology, 
                legal requirements, or other factors. We will notify you of material changes through:
              </p>
              
              <ul className="list-disc pl-6 text-forest-600 space-y-1 mb-4">
                <li>Email notification to registered users</li>
                <li>Prominent notice on our website</li>
                <li>In-app notifications</li>
                <li>Updated "Last Modified" date at the top of this policy</li>
              </ul>
              
              <p className="text-forest-600">
                Your continued use of Trek Tribe after such changes constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Section 11 */}
            <section id="contact" className="mb-8">
              <h2 className="text-2xl font-semibold text-forest-800 mb-4 border-b-2 border-nature-200 pb-2">
                11. Contact Us
              </h2>
              
              <div className="bg-nature-50 border border-nature-200 rounded-lg p-6">
                <h3 className="font-semibold text-nature-800 mb-4">Data Protection Officer & Privacy Team</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-nature-700 mb-2">
                      <strong>Email:</strong> <a href="mailto:privacy@trekktribe.com" className="text-nature-600 underline">privacy@trekktribe.com</a>
                    </p>
                    <p className="text-nature-700 mb-2">
                      <strong>General Support:</strong> <a href="mailto:support@trekktribe.com" className="text-nature-600 underline">support@trekktribe.com</a>
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
                      Trek Tribe Privacy Team<br/>
                      123 Adventure Way<br/>
                      Mountain View, CA 94041<br/>
                      United States
                    </p>
                  </div>
                </div>
                <p className="text-nature-700 mt-4 text-sm">
                  <strong>Response Time:</strong> We aim to respond to all privacy inquiries within 30 days 
                  (or 1 month for GDPR requests).
                </p>
              </div>
            </section>

            {/* Footer */}
            <div className="text-center pt-8 border-t border-forest-200">
              <p className="text-forest-600 mb-4">
                This Privacy Policy is effective as of {lastUpdated} and applies to all information collected by Trek Tribe.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                <Link to="/terms" className="text-nature-600 hover:underline">Terms & Conditions</Link>
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

export default PrivacyPolicy;