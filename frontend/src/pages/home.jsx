import { useState, useEffect, useCallback } from 'react';
import API from '../api/axios';
import EventCard from '../component/eventCard';
import BookingModal from '../component/bookingModal';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import {
  Search, Zap, ShieldCheck, QrCode, TrendingUp,
  ChevronDown, ChevronUp, Calendar, CheckCircle2,
  ArrowRight, PlusCircle, Mail, Heart, Radio
} from 'lucide-react';

const defaultCategories = [
  'All', 'Music & Concerts', 'Conference', 'Concert', 'Workshop',
  'Tech & IT', 'Sports & Fitness', 'Arts & Theatre', 'Parties & Entertainment',
  'Business & Networking', 'Expos & Exhibitions', 'Seminars & Webinars', 'Food & Drink',
];

const faqs = [
  { q: 'How does atomic ticket booking guarantee I get my seat?', a: 'Our backend utilizes atomic database locking during booking transactions. This guarantees that two users can never reserve or purchase the exact same seat simultaneously, even during high-demand event drops.' },
  { q: 'How do I access my booked ticket at the venue?', a: 'Once booked, your ticket will appear instantly under "My Tickets" with a unique QR verification code and ticket token. Simply present this at the venue gate for instant check-in.' },
  { q: 'What is the fee for event organizers?', a: 'A 5% service fee is added to the ticket subtotal at checkout. The organizer dashboard displays verified ticket revenue excluding that fee.' },
  { q: 'Can I cancel or refund my ticket?', a: 'You can cancel an unpaid reservation from My Tickets. Contact support to request a paid booking refund; an administrator must verify it through Stripe.' },
];

const featureCards = [
  { icon: ShieldCheck, title: 'Atomic Booking Lock', desc: 'Database transactions prevent overselling or race conditions during high-demand ticket drops.' },
  { icon: QrCode, title: 'Instant QR Pass', desc: 'Unforgeable QR verification tokens generated per booking for rapid gate scanning.' },
  { icon: TrendingUp, title: 'Organizer Analytics', desc: 'Verified ticket revenue and event sales insights, with service fees reported separately.' },
  { icon: Zap, title: 'Instant Confirmation', desc: 'Immediate ticket issuance with zero waiting time or email delivery delays.' },
];

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState(''), [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [loadError, setLoadError] = useState('');
  const [categoriesList, setCategoriesList] = useState(defaultCategories);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBookingEvent, setSelectedBookingEvent] = useState(null);
  const [message, setMessage] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');


  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchEventsWithCatch = useCallback(async (signal) => {
    setLoading(true);
    try {
      const { data } = await API.get('/events/upcoming', { signal, params: { page, search: searchQuery || undefined, category: selectedCategory === 'All' ? undefined : selectedCategory, location: locationFilter || undefined, date: dateFilter || undefined } });
      if (!signal?.aborted) { setEvents(data.events); setTotal(data.total); setLoadError(''); }
    } catch (error) { if (error.code !== 'ERR_CANCELED') setLoadError(error.response?.data?.message || 'Unable to load events. Please try again.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, searchQuery, selectedCategory, locationFilter, dateFilter]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchEventsWithCatch(controller.signal), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [fetchEventsWithCatch]);
  useEffect(() => {
    let active = true;
    API.get('/events/categories').then(({ data }) => {
      if (active && data.length) setCategoriesList(Array.from(new Set(['All', ...data.map((category) => category.name)])));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const handleBooking = (event) => {
    if (!user) { navigate('/login'); return; }
    setSelectedBookingEvent(event);
  };

  const filteredEvents = events;

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    setMessage({ type: 'error', text: 'Newsletter subscriptions are not available yet.' });
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-body)' }}>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">

        {/* Announcement Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-8"
          style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Atomic Concurrency Engine & QR Gate Pass</span>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6" style={{ color: 'var(--text-heading)' }}>
          Experience Live Events with <br className="hidden sm:inline" />
          <span style={{ color: 'var(--accent-text)' }}>Zero Double Bookings</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-base sm:text-xl max-w-3xl mx-auto mb-10 leading-relaxed font-normal" style={{ color: 'var(--text-subtle)' }}>
          Book verified tickets atomically, manage instant gate check-ins with unforgeable QR tokens, and enjoy seamless live experiences.
        </p>

        {/* Hero Search */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="p-2.5 sm:p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="relative flex-1 w-full flex items-center">
              <Search className="w-5 h-5 absolute left-4 pointer-events-none" style={{ color: 'var(--accent-text)' }} />
              <input
                type="text"
                placeholder="Search events by title, venue, or keyword..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full rounded-xl pl-11 pr-4 py-3 text-sm ev-input"
              />
            </div>
            <a
              href="#events-list"
              className="w-full sm:w-auto px-6 py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 whitespace-nowrap transition"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
            >
              <Zap className="w-4 h-4" />
              Find Events
            </a>
          </div>

          {/* Category Chips */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-subtle)' }}>Categories:</span>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition cursor-pointer"
                style={{
                  backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: selectedCategory === cat ? 'var(--text-on-primary)' : 'var(--text-subtle)',
                  border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border)',
                }}
                onMouseEnter={e => { if (selectedCategory !== cat) { e.currentTarget.style.borderColor = 'var(--primary-border)'; e.currentTarget.style.color = 'var(--text-heading)'; } }}
                onMouseLeave={e => { if (selectedCategory !== cat) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-subtle)'; } }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#events-list"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
          >
            Explore All Events
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={() => navigate(user ? (user.role === 'organizer' ? '/organizer/dashboard' : '/') : '/register')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition ev-btn-secondary"
          >
            <PlusCircle className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            Host an Event
          </button>
        </div>
      </section>

      {/* Toast Notification */}
      {message && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md ev-animate-in">
          <div
            className="p-4 rounded-xl flex items-start gap-3"
            style={{
              backgroundColor: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
              border: message.type === 'success' ? '1px solid var(--success-border)' : '1px solid var(--error-border)',
              color: message.type === 'success' ? 'var(--success-text)' : 'var(--error-text)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium leading-relaxed">{message.text}</div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pt-8 flex flex-wrap gap-4">
        <label>Location<input className="ev-input p-3 rounded-xl block" value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }} /></label>
        <label>Date (UTC)<input type="date" className="ev-input p-3 rounded-xl block" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} /></label>
      </div>
      {loadError && <p role="alert" className="max-w-7xl mx-auto p-6 text-danger">{loadError}</p>}
      {/* Events Section */}
      <section id="events-list" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-text)' }}>
              <Radio className="w-4 h-4 animate-pulse" style={{ color: 'var(--error-text)' }} />
              <span>Real-Time Catalog</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
              Upcoming <span style={{ color: 'var(--accent-text)' }}>Events</span>
            </h2>
          </div>
          <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
            Showing <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{filteredEvents.length}</span> of {total} active events
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Fetching atomic event listings...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="ev-card rounded-2xl p-12 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>No matching events found</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-subtle)' }}>Try adjusting your search criteria or category filter.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setLocationFilter(''); setDateFilter(''); setPage(1); }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ev-btn-secondary"
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

      <nav aria-label="Event pages" className="max-w-7xl mx-auto px-6 pb-8 flex gap-4 items-center">
        <button disabled={page === 1 || loading} onClick={() => setPage(page - 1)} className="ev-btn-secondary p-3 rounded-xl">Previous</button><span>Page {page}</span>
        <button disabled={page * 24 >= total || loading} onClick={() => setPage(page + 1)} className="ev-btn-secondary p-3 rounded-xl">Next</button>
      </nav>
      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--text-heading)' }}>
            Engineered for <span style={{ color: 'var(--accent-text)' }}>Trust & Speed</span>
          </h2>
          <p className="text-base" style={{ color: 'var(--text-subtle)' }}>
            Built with modern architecture to deliver instant seat locks, high performance, and effortless event hosting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureCards.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="ev-card p-6 rounded-2xl transition hover:-translate-y-0.5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-heading)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-subtle)' }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Organizers CTA */}
      <section id="organizers" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 inline-block" style={{ color: 'var(--accent-text)', backgroundColor: 'var(--primary-muted)', border: '1px solid var(--primary-border)' }}>
              Host Your Next Event
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight" style={{ color: 'var(--text-heading)' }}>
              Are You an Event Organizer? <br />
              Publish & Sell Tickets in Minutes.
            </h2>
            <p className="text-sm sm:text-base mb-8 leading-relaxed" style={{ color: 'var(--text-body)' }}>
              Create custom ticket tiers, manage capacity seamlessly, monitor sales analytics in real-time, and verify tickets at the venue gate with our built-in QR scanner.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-3 font-bold rounded-xl text-sm transition cursor-pointer"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                Start Host Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-3 font-semibold rounded-xl text-sm transition cursor-pointer ev-btn-secondary"
              >
                Sign In to Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold mb-3" style={{ color: 'var(--text-heading)' }}>
            Frequently Asked <span style={{ color: 'var(--accent-text)' }}>Questions</span>
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Everything you need to know about booking and managing events.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="ev-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex justify-between items-center gap-4 text-sm sm:text-base font-semibold transition cursor-pointer"
                style={{ color: 'var(--text-heading)' }}
              >
                <span>{faq.q}</span>
                {openFaq === idx
                  ? <ChevronUp className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-text)' }} />
                  : <ChevronDown className="w-5 h-5 shrink-0" style={{ color: 'var(--text-subtle)' }} />
                }
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-sm leading-relaxed pt-3" style={{ color: 'var(--text-body)', borderTop: '1px solid var(--border)' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-16 pb-12 px-4 sm:px-6 lg:px-8" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Eventra</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
              The high-concurrency event ticketing platform powered by atomic reservation technology.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-heading)' }}>Quick Links</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
              <li><a href="#events-list" className="hover:text-accent transition">Browse Events</a></li>
              <li><a href="#features" className="hover:text-accent transition">Why Choose Us</a></li>
              <li><a href="#organizers" className="hover:text-accent transition">Host an Event</a></li>
              <li><a href="#faq" className="hover:text-accent transition">Help & FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-heading)' }}>Legal & Privacy</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
              <li><span className="hover:text-accent transition cursor-pointer">Terms of Service</span></li>
              <li><span className="hover:text-accent transition cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-accent transition cursor-pointer">Organizer Terms</span></li>
              <li><span className="hover:text-accent transition cursor-pointer">Refund Guidelines</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-heading)' }}>Newsletter</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>Subscribe to get alerts for hot upcoming event drops.</p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                required
                placeholder="Enter your email..."
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="ev-input rounded-lg px-3 py-2 text-xs flex-1"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                <Mail className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row justify-between items-center text-xs gap-4" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
          <p>© {new Date().getFullYear()} Eventra. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 inline" style={{ color: 'var(--error-text)', fill: 'var(--error-text)' }} />
            <span>for seamless live event experiences.</span>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      {selectedBookingEvent && (
        <BookingModal
          event={selectedBookingEvent}
          user={user}
          onClose={() => setSelectedBookingEvent(null)}
          onBookingSuccess={(booking) => {
            setMessage({
              type: 'success',
              text: `🎉 Seat reserved & paid successfully for "${selectedBookingEvent.title}"! Ref: ${booking.qrCodeString || booking._id}`,
            });
            fetchEventsWithCatch();
            setTimeout(() => setMessage(null), 7000);
          }}
        />
      )}
    </div>
  );
};

export default Home;