import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
    return (
        <footer className="bg-forest-900 text-nature-100 pt-16 pb-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl group-hover:bg-white/20 transition-all duration-300">
                                <span className="text-2xl">🏔️</span>
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-white to-nature-300 bg-clip-text text-transparent">
                                TrekTribe
                            </span>
                        </Link>
                        <p className="text-nature-300 leading-relaxed text-sm">
                            Connect with fellow adventurers, discover hidden gems, and create memories that last a lifetime. Your journey begins here.
                        </p>
                        <div className="flex gap-4 pt-2">
                            {[
                                { label: 'Twitter', icon: '🐦', href: '#' },
                                { label: 'Instagram', icon: '📸', href: '#' },
                                { label: 'LinkedIn', icon: '💼', href: '#' },
                                { label: 'Facebook', icon: '📘', href: '#' },
                            ].map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-forest-800 hover:bg-forest-700 hover:scale-110 transition-all duration-300 text-lg"
                                    aria-label={social.label}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-earth-500 rounded-full"></span>
                            Discover
                        </h3>
                        <ul className="space-y-4">
                            {[
                                { label: 'Find Adventures', to: '/trips' },
                                { label: 'Meet Organizers', to: '/search' },
                                { label: 'AI Travel Assistant', to: '/ai-showcase' },
                                { label: 'Community Stories', to: '/stories' },
                            ].map((link) => (
                                <li key={link.label}>
                                    <Link
                                        to={link.to}
                                        className="text-nature-300 hover:text-white hover:translate-x-1 transition-all duration-300 inline-block"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Organizer */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-forest-500 rounded-full"></span>
                            For Organizers
                        </h3>
                        <ul className="space-y-4">
                            {[
                                { label: 'Become an Organizer', to: '/join-as-organizer' },
                                { label: 'Host a Trip', to: '/create-trip' },
                                { label: 'Success Stories', to: '/organizer-stories' },
                                { label: 'Organizer Guidelines', to: '/guidelines' },
                            ].map((link) => (
                                <li key={link.label}>
                                    <Link
                                        to={link.to}
                                        className="text-nature-300 hover:text-white hover:translate-x-1 transition-all duration-300 inline-block"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-nature-500 rounded-full"></span>
                            Stay Updated
                        </h3>
                        <p className="text-nature-300 text-sm mb-4">
                            Subscribe to get the latest adventures and travel tips directly to your inbox.
                        </p>
                        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 bg-forest-950 border border-forest-800 rounded-xl text-white placeholder-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-1 top-1 bottom-1 px-4 bg-forest-600 hover:bg-forest-500 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                    Join
                                </button>
                            </div>
                            <p className="text-xs text-forest-400">
                                By subscribing, you agree to our Policy.
                            </p>
                        </form>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-forest-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-forest-400">
                    <p>© {new Date().getFullYear()} TrekTribe. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to="/privacy-policy" className="hover:text-nature-300 transition-colors">Privacy Policy</Link>
                        <Link to="/terms-conditions" className="hover:text-nature-300 transition-colors">Terms of Service</Link>
                        <Link to="/cookie-settings" className="hover:text-nature-300 transition-colors">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
