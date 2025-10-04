import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-forest-900 text-forest-100 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 mb-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-nature-500 to-forest-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">T</span>
              </div>
              <h3 className="text-2xl font-bold text-white">Trek Tribe</h3>
            </div>
            <p className="text-forest-300 mb-6 leading-relaxed">
              Connecting nature lovers with extraordinary wilderness experiences. 
              Explore responsibly, adventure sustainably.
            </p>
            <div className="flex space-x-4">
              <a 
                href="#" 
                className="w-10 h-10 bg-forest-800 hover:bg-nature-600 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="Follow us on Facebook"
              >
                <span className="text-lg">📘</span>
              </a>
              <a 
                href="#" 
                className="w-10 h-10 bg-forest-800 hover:bg-nature-600 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="Follow us on Instagram"
              >
                <span className="text-lg">📷</span>
              </a>
              <a 
                href="#" 
                className="w-10 h-10 bg-forest-800 hover:bg-nature-600 rounded-full flex items-center justify-center transition-colors duration-300"
                aria-label="Follow us on Twitter"
              >
                <span className="text-lg">🐦</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Explore</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/trips" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  All Adventures
                </Link>
              </li>
              <li>
                <Link to="/trips?category=mountain" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Mountain Expeditions
                </Link>
              </li>
              <li>
                <Link to="/trips?category=forest" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Forest Treks
                </Link>
              </li>
              <li>
                <Link to="/trips?category=water" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Water Adventures
                </Link>
              </li>
              <li>
                <Link to="/trips?category=wildlife" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Wildlife Safaris
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Community</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/register" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Join Us
                </Link>
              </li>
              <li>
                <Link to="/profile" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Your Profile
                </Link>
              </li>
              <li>
                <Link to="/data-management" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Data Privacy
                </Link>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Success Stories
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Help Center
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Our Mission
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Sustainability
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-forest-300 hover:text-nature-400 transition-colors duration-200">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="border-t border-forest-800 pt-8 mb-8">
          <div className="max-w-md mx-auto text-center">
            <h4 className="text-xl font-semibold text-white mb-4">Stay Connected to Nature</h4>
            <p className="text-forest-300 mb-6">
              Get adventure inspiration, sustainability tips, and early access to new expeditions.
            </p>
            <div className="flex max-w-md mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 bg-forest-800 border border-forest-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-transparent text-white placeholder-forest-400"
              />
              <button className="px-6 py-3 bg-nature-600 hover:bg-nature-700 text-white rounded-r-lg font-semibold transition-colors duration-200">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-forest-800 pt-8">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
            {/* Copyright */}
            <div className="text-center lg:text-left">
              <p className="text-forest-400">
                © {new Date().getFullYear()} Trek Tribe. All rights reserved.
              </p>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link 
                to="/privacy" 
                className="text-forest-300 hover:text-nature-400 transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms" 
                className="text-forest-300 hover:text-nature-400 transition-colors duration-200"
              >
                Terms & Conditions
              </Link>
              <Link 
                to="/cookie-settings" 
                className="text-forest-300 hover:text-nature-400 transition-colors duration-200"
              >
                Cookie Settings
              </Link>
              <a 
                href="#" 
                className="text-forest-300 hover:text-nature-400 transition-colors duration-200"
              >
                Accessibility
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-forest-400 text-sm">
                <span className="mr-2">🔒</span>
                <span>Secure</span>
              </div>
              <div className="flex items-center text-forest-400 text-sm">
                <span className="mr-2">🌱</span>
                <span>Carbon Neutral</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;