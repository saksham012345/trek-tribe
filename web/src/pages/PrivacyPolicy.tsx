import React from 'react';
import { Shield, Eye, Database, Cookie, Mail, Phone, Globe, Lock, UserCheck } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const lastUpdated = "January 9, 2025";

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-forest-600" />
            <h1 className="text-4xl font-bold text-forest-800">Privacy Policy</h1>
          </div>
          <p className="text-xl text-gray-600 mb-2">
            Your privacy matters to us at Trek Tribe
          </p>
          <p className="text-sm text-gray-500">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">

          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6" />
              1. Introduction
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed">
                Trek Tribe (“we,” “our,” or “us”) is a community-driven platform that connects travelers and organizers to create, discover, and participate in adventure trips and outdoor experiences.
              </p>
              <p className="text-gray-700 leading-relaxed mt-3">
                By using Trek Tribe, you agree to the practices described in this Privacy Policy. We are committed to handling your personal data responsibly, transparently, and securely.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Database className="w-6 h-6" />
              2. Information We Collect
            </h2>

            <div className="space-y-6">
              <div className="bg-forest-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">2.1 Information You Provide to Us</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Account Information:</strong> Name, email address, password, phone number</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Profile Information:</strong> Bio, profile photo, location, preferences, social links</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Trip Information:</strong> Trip details, bookings, reviews, uploaded images, participant data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Communications:</strong> Messages, chats, emails, and support requests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Payment Information:</strong> Payment status and transaction identifiers (payment details are processed by third-party payment providers)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-nature-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">2.2 Information Collected Automatically</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Usage Data:</strong> Pages visited, interactions, clicks, time spent</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Device Information:</strong> IP address, browser type, operating system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Location Data:</strong> Approximate location (city/country level only)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Cookies & Tracking Data:</strong> Login state, preferences, analytics data</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Legal Basis */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              3. Legal Basis for Processing Personal Data
            </h2>
            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-forest-500">
              <p className="text-gray-700 mb-4">We process your personal information based on one or more of the following legal grounds:</p>
              <ul className="grid md:grid-cols-2 gap-3 text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="text-forest-600">✓</span>
                  <span><strong>Consent:</strong> When you voluntarily provide information</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-forest-600">✓</span>
                  <span><strong>Contractual Necessity:</strong> To provide bookings and features</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-forest-600">✓</span>
                  <span><strong>Legal Obligations:</strong> Compliance with laws</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-forest-600">✓</span>
                  <span><strong>Legitimate Interests:</strong> Improving services, security</span>
                </li>
              </ul>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">4. How We Use Your Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="font-semibold text-forest-700 mb-1">Account Management</h4>
                <p className="text-sm text-gray-600">Create and manage user accounts</p>
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="font-semibold text-forest-700 mb-1">Trip Services</h4>
                <p className="text-sm text-gray-600">Enable trip discovery, bookings, and participation</p>
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="font-semibold text-forest-700 mb-1">Communication</h4>
                <p className="text-sm text-gray-600">Communicate important updates and notifications</p>
              </div>
              <div className="bg-white border border-gray-200 p-4 rounded-lg hover:shadow-md transition-shadow">
                <h4 className="font-semibold text-forest-700 mb-1">Security</h4>
                <p className="text-sm text-gray-600">Prevent fraud, abuse, and security threats</p>
              </div>
            </div>
            <p className="text-gray-600 mt-4 text-sm italic">
              We also use data to personalize recommendations, strictly improve functionality, and comply with legal requirements.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Cookie className="w-6 h-6" />
              5. Cookies and Tracking Technologies
            </h2>
            <div className="bg-blue-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed mb-4">
                We use cookies and similar technologies to enhance your experience.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <ul className="text-sm text-gray-700 space-y-2">
                  <li><strong>Essential Cookies:</strong> Required for core functionality</li>
                  <li><strong>Functional Cookies:</strong> Remember preferences and settings</li>
                </ul>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li><strong>Analytics Cookies:</strong> Understand usage trends (e.g., Google Analytics)</li>
                  <li><strong>Marketing Cookies:</strong> Used only if explicitly enabled by you</li>
                </ul>
              </div>
              <p className="text-sm text-blue-800">
                You can manage or withdraw cookie consent at any time through browser settings or our cookie preferences tool.
              </p>
            </div>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">6. Information Sharing and Disclosure</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <h4 className="font-semibold text-yellow-800 mb-1">We do not sell your personal data.</h4>
                <p className="text-yellow-700 text-sm">We may share your information only in specific situations like legal compliance or with trusted service providers.</p>
              </div>
              <ul className="space-y-2 text-gray-700 pl-4">
                <li className="flex items-start gap-2">
                  <span className="text-forest-600 mt-1">•</span>
                  <span><strong>With Other Users:</strong> Limited contact details may be shared with trip participants for coordination</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest-600 mt-1">•</span>
                  <span><strong>Service Providers:</strong> Trusted third parties (payment processors, hosting, email services)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest-600 mt-1">•</span>
                  <span><strong>Legal Compliance:</strong> When required by law, court order, or legal process</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest-600 mt-1">•</span>
                  <span><strong>Business Transfers:</strong> In case of merger, acquisition, or asset sale</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 mb-2">We retain personal data only for as long as necessary to:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1 mb-2">
              <li>Provide our Services</li>
              <li>Fulfill legal and contractual obligations</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="text-gray-700">When data is no longer required, it is securely deleted or anonymized.</p>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6" />
              8. Data Security
            </h2>
            <div className="bg-gray-50 p-6 rounded-xl">
              <p className="text-gray-700 mb-4">We implement appropriate technical and organizational safeguards:</p>
              <div className="flex flex-wrap gap-3 mb-4">
                <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700">SSL/TLS encryption</span>
                <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700">Secure data storage</span>
                <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700">Access controls</span>
                <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700">Regular monitoring</span>
              </div>
              <p className="text-gray-600 text-sm">However, no system is 100% secure, and we cannot guarantee absolute security.</p>
            </div>
          </section>


          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <UserCheck className="w-6 h-6" />
              9. Your Privacy Rights
            </h2>
            <div className="bg-purple-50 p-6 rounded-xl">
              <p className="text-gray-700 mb-4">Depending on your jurisdiction, you may have the right to:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Access your personal data</li>
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Correct inaccurate data</li>
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Request deletion</li>
                </ul>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Object to processing</li>
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Withdraw consent</li>
                  <li className="flex items-center gap-2"><span className="text-purple-600">✓</span> Request data portability</li>
                </ul>
              </div>
              <p className="mt-4 text-purple-800 text-sm font-medium">You can exercise these rights via your account settings or by contacting us.</p>
            </div>
          </section>

          {/* Children / International / Changes */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-forest-800 mb-2">10. Children’s Privacy</h2>
              <p className="text-gray-700">
                Trek Tribe is not intended for children under the applicable legal age. We do not knowingly collect personal data from minors. If you believe a minor has provided us with data, please contact us immediately.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-forest-800 mb-2 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                11. International Data Transfers
              </h2>
              <p className="text-gray-700">
                Your information may be processed or stored outside your country of residence. When we transfer data internationally, we ensure appropriate safeguards are in place as required by applicable law.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-forest-800 mb-2">12. Changes to This Privacy Policy</h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated “Last Updated” date. Continued use of our Services means you accept the updated policy.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-forest-800 mb-2">13. Contact Us</h2>
              <p className="text-gray-700 mb-2">
                If you have questions or concerns about this Privacy Policy or your data, please contact us at:
              </p>
              <div className="bg-forest-50 p-4 rounded-lg inline-block">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-forest-600" />
                  <span className="text-sm font-medium text-gray-800">trektribe.root@gmail.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-forest-600" />
                  <span className="text-sm font-medium text-gray-800">9876177839</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;