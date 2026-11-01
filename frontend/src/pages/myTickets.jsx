import { useState, useEffect } from 'react';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  MapPin,
  Ticket as TicketIcon,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Tag,
  Download,
  AlertCircle,
  Sparkles,
  History,
} from 'lucide-react';

const MyTickets = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    try {
      const { data } = await API.get('/bookings/my-bookings');
      setBookings(data);
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const currentTime = new Date();

  // Categorize bookings into Upcoming vs Past
  const upcomingBookings = bookings.filter((b) => {
    const startDT = b.eventId?.startDateTime ? new Date(b.eventId.startDateTime) : (b.eventId?.date ? new Date(b.eventId.date) : null);
    if (!startDT) return true;
    return startDT > currentTime || b.isUpcoming === true;
  });

  const pastBookings = bookings.filter((b) => {
    const endDT = b.eventId?.endDateTime ? new Date(b.eventId.endDateTime) : (b.eventId?.date ? new Date(b.eventId.date) : null);
    if (!endDT) return false;
    return endDT <= currentTime || b.isUpcoming === false;
  });

  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Digital Gate Pass Wallet</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <TicketIcon className="w-8 h-8 text-indigo-400" />
              My Bookings & Digital Passes
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Present your QR token at the event entrance for rapid gate scanning and check-in.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TicketIcon className="w-4 h-4" />
              Upcoming ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'past'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              Past Bookings ({pastBookings.length})
            </button>
          </div>
        </div>

        {/* Tickets Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Fetching your digital gate passes...</p>
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center max-w-lg mx-auto border border-slate-800 space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <TicketIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">
              {activeTab === 'upcoming' ? 'No Upcoming Bookings' : 'No Past Bookings'}
            </h3>
            <p className="text-slate-400 text-sm">
              {activeTab === 'upcoming'
                ? "You haven't reserved tickets for any upcoming events. Browse events to secure your seats!"
                : 'Your past completed event bookings will be preserved here for your reference.'}
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/25 transition hover:scale-105"
            >
              Explore Upcoming Events
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedBookings.map((booking) => {
              const event = booking.eventId || booking.event || {};
              const qrToken = booking.qrToken || booking.qrCodeString || booking._id;
              const bookingIdStr = booking.bookingId || booking._id;
              const isCheckedIn = booking.isCheckedIn || booking.ticketStatus === 'USED';
              const payStatus = (booking.paymentStatus || 'paid').toUpperCase();
              const ticketQty = booking.ticketQuantity || booking.quantity || 1;
              const totalAmount = booking.totalAmount || booking.totalPrice || 0;
              const ticketTier = booking.ticketType || 'General';
              const locationDisplay = booking.locationName || event.location || 'Main Venue';

              return (
                <div
                  key={booking._id}
                  className="glass-card rounded-3xl overflow-hidden border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between shadow-2xl relative"
                >
                  {/* Ticket Header & Status Badges */}
                  <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 mb-2 inline-block">
                        {event.category || 'Event Pass'}
                      </span>
                      <h3 className="text-xl font-extrabold text-white leading-tight">
                        {event.title || 'Event Details'}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">Booking ID: {bookingIdStr}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${
                          payStatus === 'PAID' || payStatus === 'CONFIRMED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        ✓ {payStatus}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isCheckedIn
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : activeTab === 'past'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isCheckedIn ? 'Checked In (USED)' : activeTab === 'past' ? 'Event Ended' : 'Valid for Gate'}
                      </span>
                    </div>
                  </div>

                  {/* Event Details Body */}
                  <div className="p-6 space-y-5 flex-1">
                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-200">
                          {event.date || event.startDateTime ? new Date(event.startDateTime || event.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }) : 'Date TBA'} ({event.startTime || '07:00 PM'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="truncate text-slate-300">{locationDisplay}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Tag className="w-4 h-4" />
                        </div>
                        <span className="text-slate-300">
                          Tier: <strong className="text-white">{ticketTier}</strong> • {ticketQty} Ticket(s) (${totalAmount} USD)
                        </span>
                      </div>
                    </div>

                    {/* QR Code Pass Box (Only active for upcoming/valid bookings or display token) */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="bg-white p-3 rounded-xl shadow-xl shadow-indigo-500/10 border-2 border-indigo-400">
                        <QRCodeSVG value={qrToken} size={140} level="H" />
                      </div>

                      <div>
                        <p className="text-[11px] text-slate-400 font-medium mb-0.5">Secure Gate Check-In QR Pass</p>
                        <p className="text-xs font-mono font-bold text-indigo-300 tracking-wider break-all select-all">
                          {qrToken}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Unforgeable QR Hash
                    </span>
                    <span>Booked on {new Date(booking.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;