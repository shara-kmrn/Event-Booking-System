import { useState } from 'react';
import API from '../api/axios';
import { CheckCircle, XCircle, Scan } from 'lucide-react';

const TicketVerifier = () => {
  const [ticketToken, setTicketToken] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data } = await API.post('/bookings/verify', { ticketToken });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or already used ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
      <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <Scan className="w-5 h-5 text-indigo-400" />
        Gate Check-In / Ticket Verification
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        Enter the Ticket Token or scan string from the customer's QR code to verify entry.
      </p>

      <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          required
          placeholder="Paste ticket token or ID..."
          value={ticketToken}
          onChange={(e) => setTicketToken(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition cursor-pointer disabled:bg-slate-800"
        >
          {loading ? 'Verifying...' : 'Verify Entry'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-sm flex items-center gap-2">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold text-emerald-400 text-base">
            <CheckCircle className="w-5 h-5" />
            <span>Valid Ticket — Check-In Approved!</span>
          </div>
          <p className="text-xs text-slate-300">
            Event: <span className="text-white font-medium">{result.event?.title || 'Confirmed Event'}</span>
          </p>
          <p className="text-xs text-slate-300">
            Customer: <span className="text-white font-medium">{result.user?.name || 'Verified Attendee'}</span>
          </p>
          <p className="text-xs text-slate-300">
            Seats: <span className="text-white font-medium">{result.quantity || 1}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketVerifier;