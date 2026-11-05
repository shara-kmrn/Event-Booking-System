import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { canDisplayTicket, isCurrentBooking, bookingStatusMessage, validCheckoutUrl } from '../api/bookingState.js';
import { ticketDocument } from '../api/ticketDocument.js';
import API from '../api/axios';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar, MapPin, Ticket as TicketIcon,
  ShieldCheck, Tag, History,
} from 'lucide-react';

const MyTickets = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [downloadMessage, setDownloadMessage] = useState('');

  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const [busyBooking, setBusyBooking] = useState('');
  const actionRef = useRef(false);
  const { search } = useLocation();

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let targetComplete = false;
    let timer;
    const params = new URLSearchParams(search);
    const target = params.get('booking');
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        let verificationError = '';
        if (target && !targetComplete) {
          try {
          let response;
          if (params.get('payment_cancelled') === '1') {
            try { response = await API.post(`/bookings/${encodeURIComponent(target)}/cancel`, {}); }
            catch (failure) {
              if (failure.response?.status !== 409) throw failure;
              response = await API.post(`/bookings/${encodeURIComponent(target)}/confirm`, {});
            }
          } else response = await API.post(`/bookings/${encodeURIComponent(target)}/confirm`, {});
          targetComplete = response.data.booking?.bookingStatus !== 'PENDING';
          } catch (failure) {
            verificationError = failure.response?.data?.message || 'Payment verification is unavailable. Your current booking status is shown below.';
            if ([403, 404].includes(failure.response?.status)) targetComplete = true;
          }
        }
        const { data } = await API.get('/bookings/my-bookings');
        if (active) {
          setBookings(data); setError(verificationError);
          if (!data.some((booking) => booking.bookingStatus === 'PENDING')) clearInterval(timer);
        }
      } catch (failure) {
        if (active) setError(failure.response?.data?.message || 'Unable to load booking status. Please refresh to try again.');
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };
    timer = setInterval(refresh, 5000);
    refresh();
    return () => { active = false; clearInterval(timer); };
  }, [search]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const performAction = async (booking, action) => {
    if (actionRef.current) return;
    if (action === 'cancel' && !window.confirm('Cancel this unpaid reservation and release its tickets?')) return;
    actionRef.current = true;
    setBusyBooking(booking._id);
    setError('');
    try {
      if (action === 'pay') {
        const { data } = await API.post('/payment/create-checkout-session', { bookingId: booking._id });
        if (validCheckoutUrl(data.url)) { window.location.assign(data.url); return; }
        if (!canDisplayTicket(data.booking)) throw new Error('Payment is not confirmed. Please check your booking status.');
      } else await API.post(`/bookings/${booking.bookingId}/cancel`, {});
      const { data } = await API.get('/bookings/my-bookings');
      setBookings(data);
    } catch (failure) {
      setError(failure.response?.data?.message || failure.message || 'Unable to update booking.');
    } finally { actionRef.current = false; setBusyBooking(''); }
  };
  const closed = (booking) => booking.eventId?.isCancelled || booking.eventId?.status === 'cancelled' || ['CANCELLED','FAILED','EXPIRED'].includes(booking.bookingStatus) || booking.paymentStatus === 'refunded';
  const upcomingBookings = bookings.filter((booking) => !closed(booking) && isCurrentBooking(booking, clock));
  const pastBookings = bookings.filter((booking) => !closed(booking) && !isCurrentBooking(booking, clock));
  const closedBookings = bookings.filter(closed);
  const displayedBookings = activeTab === 'all' ? bookings : activeTab === 'closed' ? closedBookings : activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-body)' }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {downloadMessage && <p role="status">{downloadMessage}</p>}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Digital Gate Pass Wallet</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-heading)' }}>
              <TicketIcon className="w-8 h-8" style={{ color: 'var(--accent-text)' }} />
              My Bookings & Digital Passes
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
              Present your QR token at the event entrance for rapid gate scanning and check-in.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {[
              { key: 'upcoming', label: `Upcoming (${upcomingBookings.length})`, icon: TicketIcon },
              { key: 'all', label: `All (${bookings.length})`, icon: History },
              { key: 'closed', label: `Cancelled & closed (${closedBookings.length})`, icon: History },
              { key: 'past', label: `Past Bookings (${pastBookings.length})`, icon: History },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-on-primary)' : 'var(--text-subtle)',
                }}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="ev-alert-error rounded-xl p-4 text-sm">{error}</div>}
        {/* Content */}
        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Fetching your digital gate passes...</p>
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="ev-card rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
              <TicketIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
              No bookings in this view
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              Your matching bookings will appear here.
            </p>
            <a href="/" className="inline-block px-6 py-3 font-bold rounded-xl text-xs transition ev-btn-primary" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
              Explore Upcoming Events
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayedBookings.map((booking) => {
              const event = booking.eventId || booking.event || {};
              const qrToken = booking.qrToken;
              const hasTicket = canDisplayTicket(booking);
              const bookingIdStr = booking.bookingId || booking._id;
              const isCheckedIn = booking.isCheckedIn || booking.ticketStatus === 'USED';
              const payStatus = (booking.paymentStatus || 'pending').toUpperCase();
              const ticketQty = booking.ticketQuantity || booking.quantity || 1;
              const totalAmount = booking.totalAmount || booking.totalPrice || 0;
              const ticketTier = booking.ticketType || 'General';
              const locationDisplay = booking.locationName || event.location || 'Main Venue';

              return (
                <div key={booking._id} className="ev-card rounded-2xl overflow-hidden flex flex-col justify-between">
                  {downloadMessage && <p role="status">{downloadMessage}</p>}
        {/* Header */}
                  <div className="p-5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                        {event.category || 'Event Pass'}
                      </span>
                      <h3 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-heading)' }}>{event.title || 'Event Details'}</h3>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-subtle)' }}>Booking ID: {bookingIdStr}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full" style={{
                        backgroundColor: payStatus === 'PAID' || payStatus === 'CONFIRMED' ? 'var(--success-bg)' : 'var(--error-bg)',
                        color: payStatus === 'PAID' || payStatus === 'CONFIRMED' ? 'var(--success-text)' : 'var(--error-text)',
                        border: payStatus === 'PAID' || payStatus === 'CONFIRMED' ? '1px solid var(--success-border)' : '1px solid var(--error-border)',
                      }}>
                        ✓ {payStatus}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full" style={{
                        backgroundColor: isCheckedIn ? 'var(--primary-muted)' : activeTab === 'past' ? 'var(--bg-card)' : 'var(--warning-bg)',
                        color: isCheckedIn ? 'var(--accent-text)' : activeTab === 'past' ? 'var(--text-subtle)' : 'var(--warning-text)',
                        border: isCheckedIn ? '1px solid var(--primary-border)' : activeTab === 'past' ? '1px solid var(--border)' : '1px solid var(--warning-border)',
                      }}>
                        {isCheckedIn ? 'Checked In (USED)' : !hasTicket ? booking.bookingStatus : activeTab === 'past' ? 'Event Ended' : 'Verified Group Pass'}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-5 flex-1">
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
                          <Calendar className="w-4 h-4" />
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--text-heading)' }}>
                          {event.date || event.startDateTime ? new Date(booking.locationStartDateTime || event.startDateTime || event.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Date TBA'} ({booking.locationStartDateTime ? new Date(booking.locationStartDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : event.startTime || '07:00 PM'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="truncate" style={{ color: 'var(--text-body)' }}>{locationDisplay}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)' }}>
                          <Tag className="w-4 h-4" />
                        </div>
                        <span style={{ color: 'var(--text-body)' }}>
                          Tier: <strong style={{ color: 'var(--text-heading)' }}>{ticketTier}</strong> • {ticketQty} Ticket(s) ({totalAmount} {(booking.currency || 'usd').toUpperCase()})
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl flex flex-col items-center justify-center gap-3 text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      {hasTicket && <>
                        <div className="bg-qr-paper p-3 rounded-xl" style={{ border: '2px solid var(--primary)' }}>
                          <QRCodeSVG id={'ticket-qr-' + booking._id} value={qrToken} size={140} level="H" />
                        </div>
                        <p className="text-xs font-mono font-bold break-all select-all" style={{ color: 'var(--accent-text)' }}>{qrToken}</p>
                      </>}
                      <p className="text-xs">{bookingStatusMessage(booking)}</p>
                      {booking.checkedInAt && <p className="text-xs">Checked in: {new Date(booking.checkedInAt).toLocaleString()}</p>}
                      {hasTicket && booking.ticketStatus === 'VALID' && <button disabled={!!busyBooking} className="ev-btn-secondary px-4 py-2 rounded-xl" onClick={async () => {
                        if (actionRef.current) return; actionRef.current = true; setBusyBooking(booking._id);
                        try {
                          const { data } = await API.get('/bookings/' + booking._id);
                          if (!canDisplayTicket(data) || data.ticketStatus !== 'VALID' || data.qrToken !== booking.qrToken || new Date(data.locationEndDateTime || data.eventId?.endDateTime) <= new Date()) throw new Error('Ticket is unavailable or has changed. Refresh your bookings.');
                          const qr = document.getElementById('ticket-qr-' + booking._id);
                          const documentText = ticketDocument(data, new XMLSerializer().serializeToString(qr));
                          const url = URL.createObjectURL(new Blob([documentText], { type: 'image/svg+xml' }));
                          const link = document.createElement('a'); link.href = url; link.download = data.bookingId + '.svg'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
                          setDownloadMessage('Ticket downloaded. Admission always requires live gate verification.');
                        } catch (failure) { setError(failure.response?.data?.message || failure.message || 'Unable to download ticket.'); }
                        finally { actionRef.current = false; setBusyBooking(''); }
                      }}>Download ticket</button>}
                      {booking.bookingStatus === 'PENDING' && <>
                        <p className="text-xs">Reserved until {new Date(booking.reservationExpiresAt).toLocaleString()}</p>
                        <div className="flex gap-3">
                          <button type="button" disabled={!!busyBooking} onClick={() => performAction(booking, 'pay')} className="ev-btn-primary px-4 py-2 rounded-xl text-xs">
                            {busyBooking === booking._id ? 'Please wait...' : 'Complete payment'}
                          </button>
                          <button type="button" disabled={!!busyBooking} onClick={() => performAction(booking, 'cancel')} className="ev-btn-secondary px-4 py-2 rounded-xl text-xs">Cancel reservation</button>
                        </div>
                      </>}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-subtle)' }}>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-text)' }} /> Backend-verified booking status
                    </span>
                    <span>Booked on {new Date(booking.createdAt || clock).toLocaleDateString()}</span>
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
