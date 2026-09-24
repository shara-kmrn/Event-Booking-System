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
} from 'lucide-react';

const MyTickets = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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
              My Tickets & Bookings
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Present your QR token at the event entrance for rapid gate scanning and check-in.
            </p>
          </div>
        </div>

        {/* Tickets Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Fetching your digital gate passes...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center max-w-lg mx-auto border border-slate-800 space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <TicketIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">No Tickets Booked Yet</h3>
            <p className="text-slate-400 text-sm">
              You haven't reserved tickets for any events. Browse upcoming events to get your gate passes!
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/25 transition hover:scale-105"
            >
              Explore Events
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookings.map((booking) => {
              const event = booking.eventId || booking.event || {};
              const qrToken = booking.qrCodeString || booking.ticketToken || booking._id;
              const isCheckedIn = booking.isCheckedIn;
              const status = booking.paymentStatus || booking.status || 'paid';
              const ticketQty = booking.ticketQuantity || booking.quantity || 1;
              const totalAmount = booking.totalAmount || booking.totalPrice || 0;
              const ticketTier = booking.ticketType || 'General';

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
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${
                          status === 'paid' || status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        ✓ {status.toUpperCase()}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isCheckedIn
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {isCheckedIn ? 'Checked In' : 'Valid for Gate'}
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
                          {event.date ? new Date(event.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }) : 'Date TBA'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="truncate text-slate-300">{event.location || 'Location TBA'}</span>
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

                    {/* QR Code Pass Box */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="bg-white p-3 rounded-xl shadow-xl shadow-indigo-500/10 border-2 border-indigo-400">
                        <QRCodeSVG value={qrToken} size={140} level="H" />
                      </div>

                      <div>
                        <p className="text-[11px] text-slate-400 font-medium mb-0.5">Scan Code at Gate Pass Entry</p>
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