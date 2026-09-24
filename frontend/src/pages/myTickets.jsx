import { useState, useEffect } from 'react';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Ticket as TicketIcon, User, Printer, Building, Clock } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <TicketIcon className="w-8 h-8 text-indigo-400" />
            My Bookings & QR Passes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Show your QR pass at the venue gate for instant atomic check-in.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16 space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Fetching your digital QR tickets...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-card text-center border border-slate-800 rounded-2xl p-12 text-slate-400 max-w-md mx-auto space-y-4">
          <TicketIcon className="w-12 h-12 text-indigo-500/40 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Tickets Booked Yet</h3>
          <p className="text-xs text-slate-400">Explore active events and book your seat now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="glass-card border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl"
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-full inline-block mb-1">
                      {booking.ticketType || 'General'}
                    </span>
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {booking.eventId?.title || 'Event Details'}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                      booking.paymentStatus === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {booking.paymentStatus === 'paid' ? 'Confirmed' : booking.paymentStatus}
                  </span>
                </div>

                {/* Event Metadata */}
                <div className="space-y-2 text-xs text-slate-300 border-y border-slate-800/80 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>
                      {booking.eventId?.date
                        ? new Date(booking.eventId.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  {booking.eventId?.startTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{booking.eventId.startTime} - {booking.eventId.endTime || '11:00 PM'}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{booking.eventId?.location || 'N/A'}</span>
                  </div>
                  {booking.eventId?.tenantId?.name && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Organizer: <strong className="text-slate-200">{booking.eventId.tenantId.name}</strong></span>
                    </div>
                  )}
                  {booking.customerName && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Attendee: <strong className="text-slate-200">{booking.customerName}</strong></span>
                    </div>
                  )}
                  <div className="text-slate-400 pt-1">
                    Quantity: <span className="text-white font-bold">{booking.ticketQuantity}</span> | Total Paid: <span className="text-emerald-400 font-bold">${booking.totalAmount}</span>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <div className="bg-white p-3 rounded-xl shadow-md">
                    <QRCodeSVG
                      value={booking.qrCodeString || booking._id}
                      size={140}
                      level="H"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono tracking-wider break-all text-center">
                    {booking.qrCodeString || booking._id}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">Gate Status: {booking.isCheckedIn ? 'Checked-In' : 'Valid Pass'}</span>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-400" />
                  Print Pass
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTickets;