import { useState, useEffect } from 'react';
import API from '../api/axios';
import EventCard from '../component/eventCard';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Zap,
  ShieldCheck,
  QrCode,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Layers,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  Mail,
  Heart,
  Globe,
  Radio
} from 'lucide-react';

const categoriesList = [
  'All',
  'Conference',
  'Concert',
  'Workshop',
  'Tech',
  'Sports',
];

const faqs = [
  {
    q: 'How does atomic ticket booking guarantee I get my seat?',
    a: 'Our backend utilizes atomic database locking during booking transactions. This guarantees that two users can never reserve or purchase the exact same seat simultaneously, even during high-demand event drops.',
  },
  {
    q: 'How do I access my booked ticket at the venue?',
    a: 'Once booked, your ticket will appear instantly under "My Tickets" with a unique QR verification code and ticket token. Simply present this at the venue gate for instant check-in.',
  },
  {
    q: 'What is the fee for event organizers?',
    a: 'Organizers enjoy a flat 5% platform service fee on ticket sales. Net earnings are tracked in real-time on your Organizer Dashboard with automatic analytics.',
  },
  {
    q: 'Can I cancel or refund my ticket?',
    a: 'Refund policies are configured by event organizers per event. Contact the organizer or check event terms before booking.',
  },
];

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [message, setMessage] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data } = await API.get('/events');
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } fontEndFinally: {
      setLoading(false);
    }
  };

  // Safe fallback if finally block syntax
  const fetchEventsWithCatch = async () => {
    try {
      const { data } = await API.get('/events');
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (event) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await API.post('/bookings', {
        eventId: event._id,
        quantity: 1,
      });
      setMessage({
        type: 'success',
        text: `🎉 Seat reserved successfully for "${event.title}"! View it in My Tickets.`,
      });
      fetchEventsWithCatch(); // Refresh remaining tickets
      
      // Auto dismiss message after 5 sec
      setTimeout(() => setMessage(null), 6000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Booking failed. Please try again.',
      });
      setTimeout(() => setMessage(null), 6000);
    }
  };

  // Filter logic
  const filteredEvents = events.filter((evt) => {
    const matchesCategory =
      selectedCategory === 'All' || evt.category === selectedCategory;
    const matchesSearch =
      evt.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (newsletterEmail) {
      setNewsletterSubscribed(true);
      setNewsletterEmail('');
      setTimeout(() => setNewsletterSubscribed(false), 5000);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100 overflow-hidden">
      
      {/* Background Decorative Glows */}
      <div className="gradient-glow top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 animate-pulse-slow" />
      <div className="gradient-glow top-1/3 right-10 w-[450px] h-[450px] bg-purple-600/20 animate-pulse-slow" style={{ animationDelay: '2s' }} />
      <div className="gradient-glow bottom-1/4 left-10 w-[400px] h-[400px] bg-pink-600/15 animate-pulse-slow" style={{ animationDelay: '4s' }} />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* Top Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-8 shadow-xl shadow-indigo-500/10 hover:border-indigo-500/50 transition">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Atomic Concurrency Engine & QR Gate Pass</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
          Experience Live Events with <br className="hidden sm:inline" />
          <span className="gradient-text">Zero Double Bookings</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-slate-400 text-base sm:text-xl max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
          Book verified tickets atomically, manage instant gate check-ins with unforgeable QR tokens, and enjoy seamless live experiences.
        </p>

        {/* Interactive Hero Search & Quick Filters */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="glass-panel p-2.5 sm:p-3 rounded-2xl border border-slate-800 shadow-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full flex items-center">
              <Search className="w-5 h-5 text-indigo-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search events by title, venue, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-500"
              />
            </div>

            <div className="w-full sm:w-auto flex items-center gap-2">
              <a
                href="#events-list"
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                Find Events
              </a>
            </div>
          </div>

          {/* Quick Category Chips */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-4">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mr-1">
              Categories:
            </span>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 border border-indigo-400'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#events-list"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
          >
            Explore All Events
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={() => navigate(user ? (user.role === 'organizer' ? '/organizer/dashboard' : '/') : '/register')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            Host an Event
          </button>
        </div>

      </section>

      {/* Live Stats Trust Bar */}
      <section className="border-y border-slate-800/80 bg-slate-950/60 backdrop-blur-md py-8 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-4 border-r border-slate-800/60 last:border-none">
            <div className="text-3xl sm:text-4xl font-extrabold text-white gradient-text">10k+</div>
            <div className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">Tickets Booked</div>
          </div>
          <div className="p-4 border-r border-slate-800/60 last:border-none">
            <div className="text-3xl sm:text-4xl font-extrabold text-white gradient-text">99.9%</div>
            <div className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">Atomic Uptime</div>
          </div>
          <div className="p-4 border-r border-slate-800/60 last:border-none">
            <div className="text-3xl sm:text-4xl font-extrabold text-white gradient-text">500+</div>
            <div className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">Organizers</div>
          </div>
          <div className="p-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-white gradient-text">0</div>
            <div className="text-xs text-slate-400 mt-1 uppercase font-semibold tracking-wider">Double-Bookings</div>
          </div>
        </div>
      </section>

      {/* Toast Notification Alert */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5">
          <div
            className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
              message.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium leading-relaxed">{message.text}</div>
          </div>
        </div>
      )}

      {/* Featured / Live Events Section */}
      <section id="events-list" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Radio className="w-4 h-4 animate-pulse text-rose-500" />
              <span>Real-Time Catalog</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Upcoming <span className="gradient-text">Events</span>
            </h2>
          </div>
          
          <div className="text-sm text-slate-400">
            Showing <span className="text-white font-bold">{filteredEvents.length}</span> active events
          </div>
        </div>

        {/* Loading Spinner / Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Fetching atomic event listings...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto border border-slate-800">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No matching events found</h3>
            <p className="text-slate-400 text-sm mb-6">
              Try adjusting your search criteria or category filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((evt) => (
              <EventCard key={evt._id} event={evt} onBook={handleBooking} />
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Engineered for <span className="gradient-text">Trust & Speed</span>
          </h2>
          <p className="text-slate-400 text-base">
            Built with modern architecture to deliver instant seat locks, high performance, and effortless event hosting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="glass-card p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Atomic Booking Lock</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Database transactions prevent overselling or race conditions during high-demand ticket drops.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-5">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant QR Pass</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Unforgeable QR verification tokens generated per booking for rapid gate scanning.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-5">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Organizer Analytics</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Real-time net revenue insights with automatic 95% payout calculations and sales tracking.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Confirmation</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Immediate ticket issuance with zero waiting time or email delivery delays.
            </p>
          </div>

        </div>
      </section>

      {/* For Organizers CTA Banner */}
      <section id="organizers" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 bg-gradient-to-r from-indigo-900/90 via-purple-900/80 to-slate-900 border border-indigo-500/30 shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-500/40 px-3 py-1 rounded-full mb-4 inline-block">
              Host Your Next Event
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
              Are You an Event Organizer? <br />
              Publish & Sell Tickets in Minutes.
            </h2>
            <p className="text-indigo-200 text-sm sm:text-base mb-8 leading-relaxed">
              Create custom ticket tiers, manage capacity seamlessly, monitor sales analytics in real-time, and verify tickets at the venue gate with our built-in QR scanner.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 bg-white text-indigo-950 font-bold rounded-xl text-sm hover:bg-slate-100 transition shadow-lg cursor-pointer"
              >
                Start Host Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 bg-indigo-950/80 hover:bg-indigo-900 text-white font-semibold rounded-xl text-sm border border-indigo-700/50 transition cursor-pointer"
              >
                Sign In to Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white mb-3">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-slate-400 text-sm">
            Everything you need to know about booking and managing events.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl overflow-hidden border border-slate-800/80 transition"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex justify-between items-center gap-4 text-white font-semibold text-sm sm:text-base hover:text-indigo-300 transition cursor-pointer"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="w-5 h-5 text-indigo-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-slate-400 text-sm leading-relaxed border-t border-slate-800/50 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-slate-800/80 bg-slate-950 pt-16 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white">Eventra</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              The high-concurrency event ticketing platform powered by atomic reservation technology.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#events-list" className="hover:text-indigo-400 transition">Browse Events</a></li>
              <li><a href="#features" className="hover:text-indigo-400 transition">Why Choose Us</a></li>
              <li><a href="#organizers" className="hover:text-indigo-400 transition">Host an Event</a></li>
              <li><a href="#faq" className="hover:text-indigo-400 transition">Help & FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Legal & Privacy</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span className="hover:text-indigo-400 transition cursor-pointer">Terms of Service</span></li>
              <li><span className="hover:text-indigo-400 transition cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-indigo-400 transition cursor-pointer">Organizer Terms</span></li>
              <li><span className="hover:text-indigo-400 transition cursor-pointer">Refund Guidelines</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Newsletter</h4>
            <p className="text-slate-400 text-xs mb-3">
              Subscribe to get alerts for hot upcoming event drops.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="Enter your email..."
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Mail className="w-4 h-4" />
              </button>
            </form>
            {newsletterSubscribed && (
              <p className="text-xs text-emerald-400 mt-2 font-medium">✓ Subscribed successfully!</p>
            )}
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Eventra. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>for seamless live event experiences.</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Home;