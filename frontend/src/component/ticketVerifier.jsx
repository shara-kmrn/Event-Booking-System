import { useState, useRef } from 'react';
import API from '../api/axios';
import { CheckCircle, XCircle, Scan } from 'lucide-react';

const TicketVerifier = ({ events = [], onCheckedIn }) => {
  const [eventId, setEventId] = useState('');
  const [ticketToken, setTicketToken] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const handleVerify = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await API.post('/bookings/verify-ticket', { eventId, ticketToken: ticketToken.trim() });
      setResult(data); onCheckedIn?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to verify ticket. Please try again.');
    } finally { submitting.current = false; setLoading(false); }
  };
  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      <h2 className="text-lg font-bold text-heading mb-2 flex items-center gap-2"><Scan className="w-5 h-5 text-accent" />Gate Check-In / Ticket Verification</h2>
      <p className="text-xs text-body mb-4">Select the event, then enter the QR token. One group pass admits all booked attendees together and can be used once.</p>
      <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
        <select aria-label="Event for check-in" required value={eventId}
          onChange={(e) => { setEventId(e.target.value); setResult(null); setError(''); }}
          className="bg-card border border-border rounded-lg px-4 py-2.5 text-heading text-sm">
          <option value="">Choose event</option>
          {events.map((event) => <option key={event._id} value={event._id}>{event.title}</option>)}
        </select>
        <input type="text" required aria-label="Ticket token" placeholder="Paste ticket QR token..."
          value={ticketToken} onChange={(e) => setTicketToken(e.target.value)}
          className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-heading text-sm" />
        <button type="submit" disabled={loading || !eventId}
          className="bg-primary hover:bg-primary-hover text-on-primary font-medium px-5 py-2.5 rounded-lg text-sm disabled:opacity-50">
          {loading ? 'Verifying...' : 'Verify Entry'}
        </button>
      </form>
      {error && <div role="alert" className="mt-4 p-3 bg-error-soft border border-error-border text-danger rounded-lg text-sm flex items-center gap-2"><XCircle className="w-5 h-5 shrink-0" />{error}</div>}
      {result && <div className="mt-4 p-4 bg-primary-soft border border-primary-border text-accent rounded-lg text-sm space-y-1">
        <div className="flex items-center gap-2 font-bold"><CheckCircle className="w-5 h-5" />Group check-in approved</div>
        <p>Event: {result.event?.title}</p><p>Customer: {result.attendee}</p><p>Attendees admitted: {result.quantity}</p>
      </div>}
    </div>
  );
};
export default TicketVerifier;
