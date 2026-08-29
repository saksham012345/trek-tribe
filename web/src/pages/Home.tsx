import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import api from '../config/api';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import AIRecommendations from '../components/AIRecommendations';
import AIAnalyticsDashboard from '../components/AIAnalyticsDashboard';
import { Helmet } from 'react-helmet-async';
import HeroImmersiveScene from '../components/HeroImmersiveScene';
import ScrollJourney from '../components/ScrollJourney';
import LiveActivityTicker from '../components/LiveActivityTicker';
import { GlassCard, ScarcityBadge } from '../components/ui/Glass';
import useMagneticHover from '../hooks/useMagneticHover';
import {
  ArrowRight, Mountain, Trees, Waves, Sparkles as SparklesIcon, Sun, Snowflake, PawPrint, Flower2,
  Globe2, Users as UsersIcon, Leaf, ShieldCheck, UserPlus, Search, Handshake, Tent, MapPin,
  Calendar, Backpack, BookOpenCheck, Compass as CompassIcon, BarChart3, TrendingUp, Target, Mail, Lock, Rocket, Gem
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);


interface Trip {
  _id: string;
  title: string;
  description: string;
  destination: string;
  price: number;
  capacity: number;
  participants: string[];
  categories: string[];
  images: string[];
  organizerId: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface Post {
  _id: string;
  authorId: {
    _id: string;
    name: string;
    profilePhoto?: string;
    role: string;
  };
  type: 'trip_memory' | 'general_post' | 'link_share' | 'experience';
  title: string;
  content: string;
  images?: string[];
}

interface HomeProps {
  user?: User | null;
}

interface HomePresentationSettings {
  heroImages: string[];
  overlayStyle: 'light' | 'dark';
  fontFamily: string;
}

const defaultHeroImages: string[] = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500534314209-a26db0f5b361?q=80&w=1600&auto=format&fit=crop'
];

const Home: React.FC<HomeProps> = ({ user: userProp }) => {
  const { user: currentUser } = useAuth();
  const user = (userProp ?? (currentUser as User | null)) as User | null;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [stats, setStats] = useState({ totalTrips: 0, totalUsers: 0, totalOrganizers: 0 });
  const [featuredTrips, setFeaturedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [homeSettings, setHomeSettings] = useState<HomePresentationSettings>({
    heroImages: defaultHeroImages,
    overlayStyle: 'light',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  });

  const heroImages = homeSettings.heroImages?.length > 0 ? homeSettings.heroImages : defaultHeroImages;
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroSceneWrapRef = useRef<HTMLDivElement>(null);
  const exploreBtnRef = useMagneticHover<HTMLAnchorElement>(0.3);
  const joinBtnRef = useMagneticHover<HTMLAnchorElement>(0.3);

  const stepsGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = stepsGridRef.current?.querySelectorAll<HTMLElement>('.how-it-works-step');
    if (!steps || steps.length === 0 || prefersReducedMotion) return;

    gsap.set(steps, { opacity: 0, y: 30 });
    const st = ScrollTrigger.create({
      trigger: stepsGridRef.current,
      start: 'top 80%',
      onEnter: () => {
        gsap.to(steps, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.12 });
      },
      once: true,
    });
    return () => st.kill();
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const words = heroContentRef.current?.querySelectorAll<HTMLElement>('.hero-word-reveal');
    if (words && words.length > 0 && !prefersReducedMotion) {
      gsap.to(words, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.045,
        delay: 0.15,
      });
    }

    let st: ScrollTrigger | undefined;
    if (heroSectionRef.current && heroSceneWrapRef.current && !prefersReducedMotion) {
      st = ScrollTrigger.create({
        trigger: heroSectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          gsap.set(heroSceneWrapRef.current, { opacity: 1 - p, y: p * 80 });
          if (heroContentRef.current) {
            gsap.set(heroContentRef.current, { opacity: 1 - p * 1.3, y: p * 40 });
          }
        },
      });
    }

    return () => {
      st?.kill();
    };
  }, []);

  // Fetch platform stats and featured trips
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch stats
        try {
          const statsResponse = await api.get('/stats');
          const statsData = statsResponse.data;
          setStats({
            totalTrips: statsData.totalTrips || 0,
            totalUsers: statsData.totalUsers || 0,
            totalOrganizers: statsData.totalOrganizers || 0,
          });
        } catch (error) {
          console.error('Failed to fetch stats:', error);
          // Silently fail - stats are not critical
        }

        // Fetch featured trips (limit to 6 for homepage)
        try {
          const tripsResponse = await api.get('/trips?limit=6');
          const tripsData = tripsResponse.data;
          const trips = Array.isArray(tripsData?.data)
            ? tripsData.data
            : Array.isArray(tripsData)
              ? tripsData
              : [];
          setFeaturedTrips(trips.slice(0, 6));
        } catch (error) {
          console.error('Failed to fetch featured trips:', error);
        }

        // Fetch homepage visual settings from admin CMS
        try {
          const settingsResponse = await api.get('/api/site-settings/public');
          const home = settingsResponse?.data?.data?.home;
          if (home) {
            setHomeSettings((prev) => ({
              heroImages: Array.isArray(home.heroImages) && home.heroImages.length > 0 ? home.heroImages : prev.heroImages,
              overlayStyle: home.overlayStyle === 'dark' ? 'dark' : 'light',
              fontFamily: typeof home.fontFamily === 'string' && home.fontFamily.trim() ? home.fontFamily : prev.fontFamily
            }));
          }
        } catch (error) {
          console.error('Failed to fetch home settings:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const canonicalHomeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : 'https://tripe.sbpgm.com/';

  return (
    <div className="min-h-screen bg-forest-50" style={{ fontFamily: homeSettings.fontFamily }}>
      <Helmet>
        <title>TrekTribe | Group Trips, Adventure Travel & Eco-Tourism</title>
        <meta name="description" content="Join TrekTribe for the best group trips, adventure travel, solo trips, and weekend getaways. Connect with nature and like-minded travelers." />
        <meta name="keywords" content="group trips, adventure travel, budget trips, family trips, solo trips, weekend trips, eco-tourism, hiking groups" />
        <link rel="canonical" href={canonicalHomeUrl} />
      </Helmet>
      {/* Hero Section — immersive 3D centerpiece */}
      <section
        ref={heroSectionRef}
        className="relative min-h-[85vh] md:min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#0f172a] to-forest-950"
      >
        {/* CMS-configurable photo, kept functional but blended low so it doesn't fight the immersive backdrop */}
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-luminosity transition-opacity duration-1000"
          style={{
            backgroundImage: `url('${heroImages[currentImageIndex]}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/60" />

        <div ref={heroSceneWrapRef} className="absolute inset-0">
          <HeroImmersiveScene />
        </div>

        <div ref={heroContentRef} className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-8 lg:px-12 py-24">
          <div className="max-w-3xl">
            <div className="corner-frame inline-block pl-4 pt-3 mb-8">
              <span className="text-xs md:text-sm font-semibold tracking-[0.2em] uppercase text-forest-300">
                Adventure Operating System
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] text-white mb-8">
              {['Trails', 'worth'].map((w, i) => (
                <span key={i} className="hero-word-reveal mr-3">{w}</span>
              ))}
              <br />
              <span className="hero-word-reveal font-display-serif italic font-medium text-forest-300">
                remembering.
              </span>
            </h1>

            <p className="hero-word-reveal text-lg md:text-xl text-forest-100/80 max-w-xl leading-relaxed mb-10">
              Join a community of eco-conscious adventurers. Explore pristine forests, majestic mountains,
              and untouched wilderness while making lifelong connections.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                ref={exploreBtnRef}
                to="/discover"
                className="group relative px-8 py-4 bg-forest-500 hover:bg-forest-400 hover:shadow-glow-forest text-forest-950 rounded-full text-base md:text-lg font-semibold transition-colors duration-300 shadow-lg"
              >
                <span className="flex items-center justify-center gap-2">
                  Explore Adventures
                  <ArrowRight size={20} strokeWidth={2.25} className="group-hover:translate-x-1 transition-transform duration-300 ease-spring" />
                </span>
              </Link>
              {!user && (
                <Link
                  ref={joinBtnRef}
                  to="/register"
                  className="group px-10 py-4 glass-panel-dark border border-white/15 hover:bg-white/10 text-white rounded-full text-lg font-semibold transition-colors duration-300"
                >
                  <span className="flex items-center justify-center gap-2">Join Community</span>
                </Link>
              )}
            </div>
          </div>

          {/* Live stats — compact panel, upper-right on desktop (clear of the fixed floating join CTA at bottom-right) */}
          <div className="hidden lg:flex absolute right-6 top-4 glass-panel-dark rounded-glass px-6 py-4 gap-6 scale-90">
            <div className="text-left">
              <div className="text-2xl font-bold text-forest-300 tabular-nums">{stats.totalTrips || 0}</div>
              <div className="text-forest-200/70 text-xs uppercase tracking-wide">Adventures</div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-forest-300 tabular-nums">{stats.totalUsers || 0}</div>
              <div className="text-forest-200/70 text-xs uppercase tracking-wide">Explorers</div>
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-forest-300 tabular-nums">{stats.totalOrganizers || 0}</div>
              <div className="text-forest-200/70 text-xs uppercase tracking-wide">Organizers</div>
            </div>
          </div>

          {/* Mobile stats — inline below CTAs */}
          <div className="lg:hidden grid grid-cols-3 gap-3 mt-12 max-w-md glass-panel-dark rounded-glass px-4 py-4">
            <div className="text-center">
              <div className="text-xl font-bold text-forest-300 tabular-nums">{stats.totalTrips || 0}</div>
              <div className="text-forest-200/70 text-[11px] uppercase tracking-wide">Adventures</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-forest-300 tabular-nums">{stats.totalUsers || 0}</div>
              <div className="text-forest-200/70 text-[11px] uppercase tracking-wide">Explorers</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-forest-300 tabular-nums">{stats.totalOrganizers || 0}</div>
              <div className="text-forest-200/70 text-[11px] uppercase tracking-wide">Organizers</div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce z-10">
          <div className="w-6 h-10 border-2 rounded-full flex justify-center border-forest-300/50">
            <div className="w-1 h-3 rounded-full mt-2 animate-pulse bg-forest-300/70"></div>
          </div>
        </div>
      </section>

      {/* Adventure Categories Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-forest-50/30 to-nature-50/30"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Choose Your
              <span className="text-blue-600">Adventure Style</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              From serene forest walks to adrenaline-pumping mountain climbs, find your perfect wilderness experience
            </p>
          </div>

          {/* Adventure categories -- horizontal scroll on mobile, grid on md+ */}
          <div className="chips-scroll md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {[
              { Icon: Mountain, title: 'Mountain Expeditions', desc: "Conquer majestic peaks and witness breathtaking views from the world's highest mountains." },
              { Icon: Trees, title: 'Forest Treks', desc: 'Immerse yourself in ancient forests and discover hidden trails through pristine wilderness.' },
              { Icon: Waves, title: 'Water Adventures', desc: 'Navigate crystal-clear rivers, pristine lakes, and explore coastal wilderness areas.' },
              { Icon: SparklesIcon, title: 'Aurora Watching', desc: "Chase the northern lights across Arctic landscapes and witness nature's most magical display." },
            ].map((cat, i) => (
              <GlassCard key={cat.title} delayMs={i * 60} className="group flex-shrink-0 w-56 md:w-auto p-6 md:p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-forest-500 to-forest-700 flex items-center justify-center shadow-elevation-2 group-hover:scale-110 transition-transform duration-300 ease-spring">
                  <cat.Icon size={28} strokeWidth={2} className="text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-forest-800 mb-2 md:mb-3">{cat.title}</h3>
                <p className="text-forest-600 text-sm leading-relaxed hidden md:block">{cat.desc}</p>
              </GlassCard>
            ))}
          </div>

          <div className="chips-scroll md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8 md:mt-8 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            {[
              { Icon: Sun, title: 'Desert Expeditions', desc: 'Explore vast desert landscapes, ancient dunes, and oasis hidden in the wilderness.' },
              { Icon: Snowflake, title: 'Arctic Adventures', desc: 'Venture into the pristine Arctic wilderness and experience life at the edge of the world.' },
              { Icon: PawPrint, title: 'Wildlife Safaris', desc: 'Observe magnificent wildlife in their natural habitats across protected wilderness areas.' },
              { Icon: Flower2, title: 'Botanical Expeditions', desc: 'Discover rare plants, ancient trees, and botanical wonders in remote natural gardens.' },
            ].map((cat, i) => (
              <GlassCard key={cat.title} delayMs={i * 60} className="group flex-shrink-0 w-56 md:w-auto p-6 md:p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-earth-500 to-earth-700 flex items-center justify-center shadow-elevation-2 group-hover:scale-110 transition-transform duration-300 ease-spring">
                  <cat.Icon size={28} strokeWidth={2} className="text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-forest-800 mb-2 md:mb-3">{cat.title}</h3>
                <p className="text-forest-600 text-sm leading-relaxed hidden md:block">{cat.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* The TrekTribe Journey — full scroll-driven 3D narrative (trekker climbs as you scroll, sky cycles day/night) */}
      <ScrollJourney />

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              How
              <span className="text-blue-600">Adventure</span>
              <span className="text-forest-700"> Works</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              Join thousands of nature lovers in just 4 simple steps. Your next wilderness adventure is closer than you think!
            </p>
          </div>

          <div ref={stepsGridRef} className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { Icon: UserPlus, title: 'Create Account', desc: 'Sign up in seconds and choose whether you want to explore adventures or organize your own expeditions.' },
              { Icon: Search, title: 'Find Adventure', desc: 'Browse through hundreds of curated wilderness experiences. Filter by location, difficulty, and adventure type.' },
              { Icon: Handshake, title: 'Join & Connect', desc: 'Book your spot and connect with fellow adventurers. Share excitement and plan together before the journey.' },
              { Icon: Tent, title: 'Experience Magic', desc: 'Embark on your wilderness adventure, create lasting memories, and form friendships that last a lifetime.' },
            ].map((step, i) => (
              <div key={step.title} className="how-it-works-step text-center group">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-forest-500 to-blue-500 rounded-full flex items-center justify-center mx-auto shadow-elevation-2 group-hover:shadow-glow-forest transition-all duration-300 ease-spring transform group-hover:scale-110">
                    <step.Icon size={30} strokeWidth={2} className="text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-elevation-1">{i + 1}</div>
                </div>
                <h3 className="text-xl font-bold text-forest-800 mb-3">{step.title}</h3>
                <p className="text-forest-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Featured Trips Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nature-50/30 to-forest-50/30"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Epic
              <span className="text-blue-600">Adventures</span>
              <span className="text-forest-700"> Await</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-2xl mx-auto leading-relaxed">
              Embark on extraordinary journeys that will connect you with nature and fellow adventurers
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-forest-200 border-t-forest-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {featuredTrips && featuredTrips.length > 0 ? featuredTrips.map((trip, index) => {
                const spotsLeft = Math.max(0, (trip.capacity || 0) - (trip.participants?.length || 0));
                const CategoryIcon = (trip.categories && trip.categories.includes('Mountain')) ? Mountain :
                  (trip.categories && trip.categories.includes('Nature')) ? Trees :
                    (trip.categories && trip.categories.includes('Beach')) ? Waves :
                      (trip.categories && trip.categories.includes('Cultural')) ? BookOpenCheck :
                        (trip.categories && trip.categories.includes('Adventure')) ? Backpack : CompassIcon;
                return (
                <GlassCard key={trip._id || index} delayMs={index * 60} className="overflow-hidden p-0">
                  <div className="relative h-52 overflow-hidden">
                    {trip.images && trip.images.length > 0 ? (
                      <>
                        <img
                          src={trip.images[0]}
                          alt={trip.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.parentElement?.querySelector('.fallback-bg') as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/20"></div>
                      </>
                    ) : null}
                    <div className={`fallback-bg absolute inset-0 bg-gradient-to-br from-forest-400 to-blue-500 flex items-center justify-center ${trip.images && trip.images.length > 0 ? 'hidden' : 'flex'}`}>
                      <div className="text-center text-white">
                        <CategoryIcon size={48} strokeWidth={1.75} className="mx-auto mb-2" />
                        <p className="text-sm opacity-90 font-medium">{trip.categories && trip.categories.length > 0 ? trip.categories[0] : 'Adventure'}</p>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <div className="glass-panel rounded-full px-3 py-1 text-forest-800 text-sm font-semibold tabular-nums">
                        {'\u20b9'}{trip.price.toLocaleString()}
                      </div>
                    </div>
                    {spotsLeft > 0 && spotsLeft <= 5 && (
                      <div className="absolute top-4 left-4">
                        <ScarcityBadge spotsLeft={spotsLeft} className="glass-panel !bg-red-50/90" />
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-3 text-forest-800 group-hover:text-blue-600 transition-colors">
                      {trip.title}
                    </h3>
                    <p className="text-forest-600 mb-4 line-clamp-2 leading-relaxed">
                      {trip.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-forest-500">
                        <MapPin size={15} strokeWidth={2} className="mr-2 flex-shrink-0" />
                        <span className="text-sm font-medium">{trip.destination}</span>
                      </div>
                      <div className="flex items-center text-forest-500">
                        <UsersIcon size={15} strokeWidth={2} className="mr-2 flex-shrink-0" />
                        <span className="text-sm tabular-nums">{trip.participants?.length || 0}/{trip.capacity} adventurers</span>
                        <div className="flex-1"></div>
                        <div className="w-16 bg-forest-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${((trip.participants?.length || 0) / trip.capacity) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center text-forest-500">
                        <Calendar size={15} strokeWidth={2} className="mr-2 flex-shrink-0" />
                        <span className="text-sm">{new Date(trip.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {trip.categories && trip.categories.length > 0 ? trip.categories?.map((category, catIndex) => (
                        <span key={catIndex} className="px-2 py-1 bg-forest-100 text-forest-700 text-xs rounded-full font-medium">
                          {category}
                        </span>
                      )) : (
                        <span className="px-2 py-1 bg-forest-100 text-forest-700 text-xs rounded-full font-medium">
                          Adventure
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/trip/${trip._id}`}
                      className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-forest-600 to-blue-600 hover:from-forest-700 hover:to-blue-700 hover:shadow-glow-forest text-white py-3 rounded-xl font-semibold transition-all duration-300 ease-spring text-center"
                    >
                      Join Adventure
                      <ArrowRight size={16} strokeWidth={2.25} />
                    </Link>
                  </div>
                </GlassCard>
                );
              }) : (
                <div className="col-span-full text-center py-12">
                  <Trees size={56} strokeWidth={1.5} className="mx-auto mb-4 text-forest-300" />
                  <h3 className="text-xl font-semibold text-forest-600 mb-2">No Adventures Yet</h3>
                  <p className="text-forest-500">New adventures are being planned. Check back soon!</p>
                </div>
              )}
            </div>
          )}

          <div className="text-center mt-16">
            <Link
              to="/discover"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-forest-600 hover:from-blue-700 hover:to-forest-700 hover:shadow-glow-forest text-white px-10 py-4 rounded-full text-lg font-bold transition-all duration-300 ease-spring transform hover:scale-105 shadow-lg"
            >
              Discover All Adventures
              <ArrowRight size={20} strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </section>

      {/* Live Social Proof */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-4 relative z-10">
        <LiveActivityTicker />
      </div>

      {/* Safety & Sustainability Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Safety First,
              <span className="text-blue-600">Planet Always</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              We're committed to responsible adventure tourism that protects both our adventurers and the precious wilderness we explore
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <div className="space-y-8">
                {[
                  { Icon: ShieldCheck, title: 'Certified Safety Protocols', desc: 'All our guides are certified wilderness professionals with first aid training. We maintain the highest safety standards and carry emergency equipment on every expedition.' },
                  { Icon: Leaf, title: 'Carbon Neutral Adventures', desc: 'We offset 100% of our carbon footprint through verified reforestation projects. Every adventure contributes to protecting the wilderness we love to explore.' },
                  { Icon: Globe2, title: 'Local Community Support', desc: 'We partner with local communities and indigenous guides, ensuring tourism benefits the people who call these wilderness areas home.' },
                  { Icon: PawPrint, title: 'Wildlife Protection', desc: 'We follow strict Leave No Trace principles and contribute to wildlife conservation efforts. Our presence helps fund protection of endangered species and habitats.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start">
                    <div className="w-12 h-12 bg-gradient-to-br from-forest-500 to-blue-500 rounded-full flex items-center justify-center mr-4 flex-shrink-0 shadow-elevation-1">
                      <item.Icon size={20} strokeWidth={2} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-forest-800 mb-2">{item.title}</h3>
                      <p className="text-forest-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <GlassCard reveal={false} className="p-6">
                <p className="text-lg text-forest-700">
                  Our commitment to sustainable adventure travel ensures every journey contributes positively to conservation and local communities.
                </p>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* Equipment & Preparation Section */}
      <section className="py-20 bg-gradient-to-br from-forest-50 to-nature-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-forest-800 mb-6">
              Gear Up for
              <span className="text-blue-600">Adventure</span>
            </h2>
            <p className="text-xl text-forest-600 max-w-3xl mx-auto leading-relaxed">
              We provide all essential equipment and guide you through preparation for your wilderness experience
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            {[
              {
                Icon: Backpack, gradient: 'from-forest-500 to-blue-500', title: 'Essential Gear Provided', items: [
                  'Professional hiking backpacks', 'Weather-appropriate clothing', 'High-quality camping equipment',
                  'Navigation and safety gear', 'First aid and emergency supplies', 'Cooking and water purification'
                ]
              },
              {
                Icon: BookOpenCheck, gradient: 'from-earth-500 to-orange-500', title: 'Pre-Trip Preparation', items: [
                  'Detailed packing checklists', 'Fitness preparation guides', 'Weather and terrain briefings',
                  'Cultural sensitivity training', 'Emergency contact protocols', 'Group introduction sessions'
                ]
              },
              {
                Icon: CompassIcon, gradient: 'from-purple-500 to-blue-500', title: 'Expert Guidance', items: [
                  'Certified wilderness guides', 'Local expert knowledge', 'Wildlife identification training',
                  'Photography tips and techniques', 'Survival skills workshops', '24/7 support during trips'
                ]
              },
            ].map((card) => (
              <GlassCard key={card.title} className="p-8">
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-br ${card.gradient} rounded-full flex items-center justify-center mx-auto mb-4 shadow-elevation-2`}>
                    <card.Icon size={26} strokeWidth={2} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-forest-800">{card.title}</h3>
                </div>
                <ul className="space-y-3 text-forest-600">
                  {card.items.map((li) => (
                    <li key={li} className="flex items-center"><ShieldCheck size={16} strokeWidth={2.25} className="mr-3 text-forest-500 flex-shrink-0" />{li}</li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CRM Preview Section for Organizers */}
      {user && user.role === 'organizer' && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-forest-900">
                Manage Your Business with
                <span className="text-blue-600"> Professional CRM</span>
              </h2>
              <p className="text-xl text-forest-700 max-w-3xl mx-auto">
                {(user as any)?.isPremium ?
                  'Unlock the full power of CRM tools to manage leads, track conversions, and grow your tour business.' :
                  'Upgrade to Premium and get exclusive CRM tools to manage leads and grow your tour business.'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* CRM Features */}
              <div className="space-y-6">
                {[
                  { Icon: BarChart3, title: 'Lead Management', premium: 'Capture and manage leads from travelers interested in your trips', free: 'See how premium members capture and track all their potential customers' },
                  { Icon: TrendingUp, title: 'Analytics & Insights', premium: 'Track conversion rates and identify your best performing trips', free: 'Premium members get detailed analytics on their trip performance' },
                  { Icon: Target, title: 'Conversion Tracking', premium: 'Monitor lead statuses from new to qualified customers', free: 'See how premium members track their sales pipeline' },
                  { Icon: Mail, title: 'Email Marketing', premium: 'Send targeted campaigns to your leads and followers', free: 'Premium members can email their entire customer base' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 items-start">
                    <div className="w-11 h-11 rounded-xl bg-forest-100 flex items-center justify-center flex-shrink-0">
                      <item.Icon size={22} strokeWidth={2} className="text-forest-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-forest-900 mb-2">{item.title}</h3>
                      <p className="text-forest-700">{(user as any)?.isPremium ? item.premium : item.free}</p>
                    </div>
                  </div>
                ))}

                {(user as any)?.isPremium ? (
                  <Link
                    to="/crm"
                    className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-blue-600 hover:bg-blue-700 hover:shadow-glow-forest text-white rounded-full font-bold text-lg transition-all duration-300 ease-spring transform hover:scale-105 shadow-lg"
                  >
                    <Rocket size={20} strokeWidth={2.25} /> Go to CRM Dashboard
                    <ArrowRight size={18} strokeWidth={2.25} />
                  </Link>
                ) : (
                  <GlassCard reveal={false} className="mt-8 p-4 !rounded-xl">
                    <p className="text-blue-900 font-semibold mb-3 flex items-center gap-2"><Gem size={18} strokeWidth={2.25} /> Unlock Premium CRM</p>
                    <Link
                      to="/subscriptions"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-all duration-300 ease-spring transform hover:scale-105"
                    >
                      Upgrade to Premium
                      <ArrowRight size={18} strokeWidth={2.25} />
                    </Link>
                  </GlassCard>
                )}
              </div>

              {/* CRM Visual Preview */}
              <div className="relative">
                <GlassCard reveal={false} className="p-8">
                  {(user as any)?.isPremium ? (
                    <>
                      <div className="bg-white/70 rounded-xl p-6 mb-6 border border-blue-100">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="text-2xl font-bold text-blue-600 tabular-nums">24</div>
                            <div className="text-sm text-forest-700 mt-1">Total Leads</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="text-2xl font-bold text-green-600 tabular-nums">68%</div>
                            <div className="text-sm text-forest-700 mt-1">Conversion Rate</div>
                          </div>
                        </div>
                        <div className="bg-gradient-to-r from-blue-100 to-green-100 h-24 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <BarChart3 size={32} strokeWidth={1.75} className="mx-auto mb-2 text-forest-700" />
                            <div className="text-sm font-semibold text-forest-700">Your Lead Performance</div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-white/70 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span className="font-semibold text-forest-800">New leads</span>
                          </div>
                          <span className="text-lg font-bold text-forest-900 tabular-nums">8</span>
                        </div>
                        <div className="flex items-center justify-between bg-white/70 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="font-semibold text-forest-800">Interested</span>
                          </div>
                          <span className="text-lg font-bold text-forest-900 tabular-nums">12</span>
                        </div>
                        <div className="flex items-center justify-between bg-white/70 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="font-semibold text-forest-800">Qualified</span>
                          </div>
                          <span className="text-lg font-bold text-forest-900 tabular-nums">4</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-white/70 rounded-lg p-6 border border-blue-200">
                        <div className="flex items-center gap-4 mb-4">
                          <Lock size={32} strokeWidth={2} className="text-forest-700" />
                          <div>
                            <h3 className="font-bold text-forest-900">Premium Feature</h3>
                            <p className="text-sm text-forest-700">Available for Premium members</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 opacity-70">
                        {[
                          { Icon: BarChart3, label: 'Lead Stats' },
                          { Icon: TrendingUp, label: 'Analytics' },
                          { Icon: Target, label: 'Conversion' },
                          { Icon: Mail, label: 'Email Tools' },
                        ].map((mini) => (
                          <div key={mini.label} className="bg-white/70 rounded-lg p-4 text-center border border-gray-200">
                            <mini.Icon size={22} strokeWidth={2} className="mx-auto mb-2 text-forest-700" />
                            <div className="text-xs font-semibold text-forest-700">{mini.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-center">
                        <p className="text-sm text-blue-900 font-semibold">
                          Upgrade to Premium to see your live CRM dashboard and start managing leads.
                        </p>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Call to Action Section */}
      <section className="py-20 bg-gradient-to-br from-forest-50 to-nature-50 text-forest-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-white/40"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-forest-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Your Next
            <span className="text-blue-700">Adventure</span>
            <br />Starts Here
          </h2>
          <p className="text-xl md:text-2xl text-forest-700 mb-12 leading-relaxed">
            Join thousands of nature lovers who have discovered their wild side.
            <br />Create memories that will last a lifetime in Earth's most beautiful places.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center">
            <Link
              to="/register"
              className="group relative px-10 py-5 md:px-12 md:py-6 bg-blue-500 hover:bg-blue-600 hover:shadow-glow-forest text-white rounded-full text-lg md:text-xl font-bold transition-all duration-300 ease-spring transform hover:scale-105 shadow-2xl"
            >
              <span className="flex items-center justify-center gap-3">
                <Rocket size={22} strokeWidth={2.25} /> Start Your Journey
                <ArrowRight size={22} strokeWidth={2.25} className="group-hover:translate-x-2 transition-transform duration-300 ease-spring" />
              </span>
            </Link>

            <Link
              to="/discover"
              className="group px-12 py-6 glass-panel border-forest-300/60 hover:bg-forest-200/40 hover:text-forest-900 text-forest-800 rounded-full text-xl font-bold transition-all duration-300 ease-spring transform hover:scale-105"
            >
              <span className="flex items-center justify-center gap-3">
                <Search size={22} strokeWidth={2.25} /> Explore Adventures
              </span>
            </Link>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-700 mb-2">Join Today</div>
              <div className="text-forest-700">Start your first adventure</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-700 mb-2">Connect</div>
              <div className="text-forest-700">Meet fellow adventurers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-700 mb-2">Explore</div>
              <div className="text-forest-700">Discover wild places</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
