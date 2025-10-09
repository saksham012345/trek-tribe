import React from 'react';
import { Shield, Eye, Database, Cookie, Mail, Phone } from 'lucide-react';

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
            Your privacy is important to us at Trek Tribe
          </p>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated}
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
                Welcome to Trek Tribe ("we," "our," or "us"). We are committed to protecting your personal information 
                and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
                your information when you use our website and services.
              </p>
              <p className="text-gray-700 leading-relaxed mt-3">
                Trek Tribe is a community platform that connects adventure enthusiasts, organizes trips, and facilitates 
                outdoor experiences. We believe in transparency and want you to understand how we handle your data.
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
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Information You Provide</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Account Information:</strong> Name, email address, password, phone number</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Profile Information:</strong> Bio, location, profile photo, social media links</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Trip Information:</strong> Trip details, reviews, photos, participant data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Communication Data:</strong> Messages, chat conversations, support requests</span>
                  </li>
                </ul>
              </div>

              <div className="bg-nature-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-forest-800 mb-3">Information Automatically Collected</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Usage Data:</strong> Pages visited, time spent, clicks, interactions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Device Information:</strong> IP address, browser type, operating system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Location Data:</strong> General location (city/country) for trip recommendations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-nature-600 mt-1">•</span>
                    <span><strong>Cookies:</strong> Login status, preferences, analytics data</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">3. How We Use Your Information</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="border-l-4 border-forest-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Service Delivery</h4>
                  <p className="text-gray-600 text-sm">Provide trip booking, user accounts, and platform functionality</p>
                </div>
                <div className="border-l-4 border-forest-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Communication</h4>
                  <p className="text-gray-600 text-sm">Send trip updates, confirmations, and important notifications</p>
                </div>
                <div className="border-l-4 border-forest-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Safety & Security</h4>
                  <p className="text-gray-600 text-sm">Verify identities, prevent fraud, and ensure user safety</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="border-l-4 border-nature-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Personalization</h4>
                  <p className="text-gray-600 text-sm">Recommend trips, customize experience based on preferences</p>
                </div>
                <div className="border-l-4 border-nature-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Analytics</h4>
                  <p className="text-gray-600 text-sm">Understand usage patterns and improve our services</p>
                </div>
                <div className="border-l-4 border-nature-600 pl-4">
                  <h4 className="font-semibold text-gray-800">Legal Compliance</h4>
                  <p className="text-gray-600 text-sm">Meet legal obligations and respond to legal requests</p>
                </div>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4 flex items-center gap-2">
              <Cookie className="w-6 h-6" />
              4. Cookies and Tracking Technologies
            </h2>
            <div className="bg-blue-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed mb-4">
                We use cookies and similar tracking technologies to enhance your experience on Trek Tribe. 
                You can control cookie preferences through our cookie consent banner.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">Types of Cookies:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Essential cookies (always active)</li>
                    <li>• Functional cookies (enhance features)</li>
                    <li>• Analytics cookies (Google Analytics)</li>
                    <li>• Marketing cookies (advertising)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">Your Controls:</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Customize preferences anytime</li>
                    <li>• Block specific cookie types</li>
                    <li>• Clear cookies from browser</li>
                    <li>• Opt-out of analytics tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">5. Information Sharing and Disclosure</h2>
            <div className="space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">We DO NOT sell your personal information.</h4>
                <p className="text-yellow-700 text-sm">
                  Your data is never sold to third parties for marketing purposes.
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">We may share information in these situations:</h4>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Trip Participants:</strong> Share contact info with other trip participants for coordination</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Service Providers:</strong> Payment processors, email services, hosting providers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Legal Requirements:</strong> When required by law, court orders, or legal process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-forest-600 mt-1">•</span>
                    <span><strong>Safety Concerns:</strong> To protect users from harm or illegal activities</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">6. Data Security</h2>
            <div className="bg-green-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed mb-4">
                We implement appropriate security measures to protect your personal information against 
                unauthorized access, alteration, disclosure, or destruction.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-forest-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-forest-800 text-sm">Encryption</h4>
                  <p className="text-xs text-gray-600">SSL/TLS encryption for data transmission</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-forest-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-forest-800 text-sm">Secure Storage</h4>
                  <p className="text-xs text-gray-600">Protected servers and databases</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-forest-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-forest-800 text-sm">Access Controls</h4>
                  <p className="text-xs text-gray-600">Limited access on need-to-know basis</p>
                </div>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">7. Your Privacy Rights</h2>
            <div className="bg-purple-50 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed mb-4">
                You have several rights regarding your personal information:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Access:</strong> Request copies of your personal data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Correction:</strong> Request to correct inaccurate information</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Deletion:</strong> Request deletion of your data</span>
                  </li>
                </ul>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Portability:</strong> Request data in a portable format</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Object:</strong> Object to certain data processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span><strong>Withdraw Consent:</strong> Withdraw consent anytime</span>
                  </li>
                </ul>
              </div>
              <div className="mt-4 p-4 bg-purple-100 rounded-lg">
                <p className="text-purple-800 text-sm">
                  <strong>How to exercise your rights:</strong> Contact us at privacy@trekktribe.com or 
                  use the settings in your account dashboard.
                </p>
              </div>
            </div>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">8. Children's Privacy</h2>
            <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
              <p className="text-gray-700 leading-relaxed">
                Trek Tribe is not intended for children under 13 years of age. We do not knowingly collect 
                personal information from children under 13. If you are a parent or guardian and believe your 
                child has provided us with personal information, please contact us immediately.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-forest-800 mb-4">9. Contact Us</h2>
            <div className="bg-gradient-to-r from-forest-600 to-nature-600 text-white p-6 rounded-xl">
              <p className="mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5" />
                  <span>privacy@trekktribe.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5" />
                  <span>+1 (555) 123-4567</span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5">📍</div>
                  <div>
                    <p>Trek Tribe Privacy Team</p>
                    <p>123 Adventure Lane, Mountain View, CA 94041</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Changes to Policy */}
          <section>
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Changes to This Privacy Policy</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date. 
                We encourage you to review this Privacy Policy periodically for any changes.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;