import React from 'react';
import { Link } from 'react-router-dom';
import { Mountain } from 'lucide-react';

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
    Twitter: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 4.5c-.8.36-1.66.6-2.56.71a4.48 4.48 0 0 0 1.96-2.48 8.94 8.94 0 0 1-2.83 1.08 4.46 4.46 0 0 0-7.6 4.07A12.66 12.66 0 0 1 1.64 3.16a4.46 4.46 0 0 0 1.38 5.95 4.4 4.4 0 0 1-2.02-.56v.06a4.46 4.46 0 0 0 3.58 4.37 4.5 4.5 0 0 1-2 .08 4.46 4.46 0 0 0 4.17 3.1A8.95 8.95 0 0 1 0 18.13a12.6 12.6 0 0 0 6.84 2c8.2 0 12.7-6.8 12.7-12.7l-.02-.58A9.1 9.1 0 0 0 22 4.5Z" />
        </svg>
    ),
    Instagram: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    ),
    LinkedIn: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v16H4z" opacity="0" />
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M7 10v7M7 7v.01M11 17v-4.5a2.5 2.5 0 0 1 5 0V17M11 17v-7" />
        </svg>
    ),
    Facebook: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h-2a5 5 0 0 0-5 5v2H6v4h2v7h4v-7h3l1-4h-4V8a1 1 0 0 1 1-1h3z" />
        </svg>
    ),
};

const Footer: React.FC = () => {
    return (
        <footer className="bg-forest-900 text-nature-100 pt-16 pb-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-sm rounded-xl group-hover:bg-white/20 transition-all duration-300">
                                <Mountain size={20} strokeWidth={2} className="text-white" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-white to-nature-300 bg-clip-text text-transparent">
                                TrekTribe
                            </span>
                        </Link>
                        <p className="text-nature-300 leading-relaxed text-sm">
                            Connect with fellow adventurers, discover hidden gems, and create memories that last a lifetime. Your journey begins here.
                        </p>
                        <div className="flex gap-3 pt-2">
                            {[
                                { label: 'Twitter', href: '#' },
                                { label: 'Instagram', href: '#' },
                                { label: 'LinkedIn', href: '#' },
                                { label: 'Facebook', href: '#' },
                            ].map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 ease-spring text-nature-200 hover:text-white"
                                    aria-label={social.label}
                                >
                                    {SOCIAL_ICONS[social.label]}
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
                                { label: 'Find Adventures', to: '/discover' },
                                { label: 'Meet Organizers', to: '/search' },
                                { label: 'AI Travel Assistant', to: '/ai-showcase' },
                                { label: 'Community Stories', to: '/blogs' },
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
                            <div className="relative glass-panel-dark rounded-glass-sm p-1">
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 bg-transparent border-0 rounded-xl text-white placeholder-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-all"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-forest-600 hover:bg-forest-500 hover:shadow-glow-forest text-white rounded-lg transition-all duration-300 ease-spring text-sm font-medium"
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
