import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
export function RecentBookings({ bookings = [], title = 'Recent bookings' }) {
  return <section className="ev-card p-5 rounded-2xl my-6 overflow-x-auto"><h2 className="font-bold text-heading mb-3">{title}</h2>
    {!bookings.length ? <p>No records yet.</p> : <table className="w-full text-left text-sm"><thead><tr><th>Reference</th><th>Event</th><th>Tickets</th><th>Payment</th><th>Booking</th></tr></thead>
      <tbody>{bookings.map((booking) => <tr key={booking._id} className="border-t border-border"><td className="py-3">{booking.bookingId}</td><td>{booking.eventId?.title || 'Event'}</td><td>{booking.ticketQuantity}</td><td>{booking.paymentStatus}</td><td>{booking.bookingStatus}</td></tr>)}</tbody></table>}
  </section>;
}
export function CheckInHistory({ refreshKey = 0 }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [page, setPage] = useState(1), [status, setStatus] = useState('used');
  useEffect(() => { let active = true;
    API.get('/tickets/history', { params: { page, status } }).then(({ data: next }) => { if (active) { setData(next); setError(''); } }).catch(() => { if (active) setError('Unable to load check-in history.'); });
    return () => { active = false; };
  }, [page, status, refreshKey]);
  return <section className="ev-card p-5 rounded-2xl my-6 overflow-x-auto"><h2 className="font-bold text-heading mb-3">Check-in records</h2>
    <select aria-label="Check-in status" className="ev-input p-2 rounded-lg" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="used">Checked in</option><option value="unused">Not checked in</option></select>
    {error ? <p role="alert">{error}</p> : !data ? <p>Loading?</p> : <>
      {!data.records.length ? <p className="my-4">No matching records.</p> : <table className="w-full text-left text-sm my-4"><thead><tr><th>Reference</th><th>Event</th><th>Attendees</th><th>Ticket status</th><th>Check-in time</th></tr></thead><tbody>
        {data.records.map((record) => <tr key={record._id} className="border-t border-border"><td className="py-3">{record.bookingId}</td><td>{record.eventId?.title}</td><td>{record.ticketQuantity}</td><td>{record.ticketStatus}</td><td>{record.checkedInAt ? new Date(record.checkedInAt).toLocaleString() : 'Not checked in'}</td></tr>)}
      </tbody></table>}
      <button disabled={page === 1} onClick={() => setPage(page - 1)} className="ev-btn-secondary p-2 rounded-lg">Previous</button>
      <span className="mx-3">Page {page}</span><button disabled={page * 24 >= data.total} onClick={() => setPage(page + 1)} className="ev-btn-secondary p-2 rounded-lg">Next</button>
    </>}
  </section>;
}
export function EventEditor({ event, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ title: event.title, description: event.description, category: event.category, bannerUrl: event.bannerUrl,
    locations: event.locations.map((location) => ({ ...location, ticketTiers: location.ticketTiers.map((tier) => ({ ...tier })) })) }));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  const locationChange = (index, key, value) => setForm((previous) => ({ ...previous, locations: previous.locations.map((location, i) => i === index ? { ...location, [key]: value } : location) }));
  const tierChange = (index, tierIndex, key, value) => setForm((previous) => ({ ...previous, locations: previous.locations.map((location, i) => i === index ? { ...location, ticketTiers: location.ticketTiers.map((tier, j) => j === tierIndex ? { ...tier, [key]: value } : tier) } : location) }));
  const submit = async (e) => {
    e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true);
    try { const payload = event.supportsLocationEditing === false ? { title: form.title, description: form.description, category: form.category, bannerUrl: form.bannerUrl } : form;
      await API.put('/events/' + event._id, payload); onSaved(); }
    catch (failure) { setError(failure.response?.data?.message || 'Unable to save event.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
    <h2 className="text-xl font-bold text-heading">Edit event</h2><p className="text-sm">Changes return the event for approval. Dates, venues, ticket names and prices are locked after booking activity. Capacity must cover sold and reserved tickets.</p>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {['title','description','category','bannerUrl'].map((key) => <label className="block" key={key}>{key === 'bannerUrl' ? 'Image URL' : key}<textarea className="ev-input p-2 w-full rounded-lg" required={key !== 'bannerUrl'} rows={key === 'description' ? 4 : 1} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
    {event.supportsLocationEditing === false && <p>Legacy event: text and image editing is available. Inventory and schedule changes require migration review.</p>}
    {event.supportsLocationEditing !== false && form.locations.map((location, i) => <fieldset key={location._id} className="border border-border p-3 rounded-xl space-y-3"><legend>Location {i + 1}</legend>
      {['name','address'].map((key) => <label className="block" key={key}>{key}<input className="ev-input p-2 w-full rounded-lg" value={location[key] || ''} onChange={(e) => locationChange(i, key, e.target.value)} /></label>)}
      {['startDateTime','endDateTime'].map((key) => <label className="block" key={key}>{key} (UTC)<input required type="datetime-local" className="ev-input p-2 w-full rounded-lg" value={new Date(location[key]).toISOString().slice(0,16)} onChange={(e) => { if (e.target.value) locationChange(i, key, new Date(e.target.value + 'Z').toISOString()); }} /></label>)}
      {location.ticketTiers.map((tier, j) => <div key={tier._id} className="grid grid-cols-3 gap-2">
        <label>Tier<input required className="ev-input p-2 w-full rounded-lg" value={tier.name} onChange={(e) => tierChange(i,j,'name',e.target.value)} /></label>
        <label>Price<input required type="number" min="0" step="0.01" className="ev-input p-2 w-full rounded-lg" value={tier.price} onChange={(e) => tierChange(i,j,'price',Number(e.target.value))} /></label>
        <label>Capacity<input required type="number" min={(tier.soldQuantity || 0) + (tier.reservedQuantity || 0)} className="ev-input p-2 w-full rounded-lg" value={tier.totalQuantity} onChange={(e) => tierChange(i,j,'totalQuantity',Number(e.target.value))} /></label>
      </div>)}
    </fieldset>)}
    <div className="flex gap-3"><button disabled={busy} className="ev-btn-primary p-3 rounded-xl">{busy ? 'Saving?' : 'Save for approval'}</button><button disabled={busy} type="button" onClick={onClose} className="ev-btn-secondary p-3 rounded-xl">Close</button></div>
  </form></div>;
}
