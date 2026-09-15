import { useState, useEffect } from 'react';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react';

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
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <TicketIcon className="w-8 h-8 text-indigo-400" />
          My Tickets
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Show your QR code at the event entrance for instant verification.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading tickets...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center bg-slate-900 border border-slate-800 rounded-xl p-8 text-slate-400">
          You have not booked any tickets yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {booking.event?.title || 'Event Details'}
                  </h3>
                  <span
                    className={`text-xs px-2.5 py-1 rounded font-semibold uppercase tracking-wider ${
                      booking.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>
                      {booking.event?.date
                        ? new Date(booking.event.date).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span>{booking.event?.location || 'N/A'}</span>
                  </div>
                  <div className="text-slate-400">
                    Quantity: <span className="text-white font-medium">{booking.quantity}</span> | Total Paid: <span className="text-emerald-400 font-medium">${booking.totalPrice}</span>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3">
                  <div className="bg-white p-3 rounded-lg shadow-md">
                    <QRCodeSVG
                      value={booking.ticketToken || booking._id}
                      size={130}
                      level="H"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono tracking-wider break-all text-center">
                    ID: {booking._id}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTickets;