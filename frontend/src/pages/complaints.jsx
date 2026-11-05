import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
export default function Complaints() {
  const [items, setItems] = useState([]), [subject, setSubject] = useState(''), [description, setDescription] = useState('');
  const [message, setMessage] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { let active = true; API.get('/bookings/complaints').then(({ data }) => { if (active) setItems(data); }).catch(() => { if (active) setMessage('Unable to load complaints.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const submit = async (event) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true);
    try { const { data } = await API.post('/bookings/complaints', { subject, description }); setItems([data, ...items]); setSubject(''); setDescription(''); setMessage('Complaint submitted.'); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to submit complaint.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="max-w-3xl mx-auto p-6 space-y-6"><h1 className="text-2xl text-heading font-bold">Support & Complaints</h1>
    {message && <p role="status">{message}</p>}
    <form onSubmit={submit} className="ev-card p-5 rounded-2xl space-y-3">
      <label className="block">Subject<input className="ev-input w-full p-3 rounded-xl" required minLength={3} maxLength={150} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
      <label className="block">Description<textarea className="ev-input w-full p-3 rounded-xl" required minLength={10} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <button disabled={busy} className="ev-btn-primary p-3 rounded-xl">{busy ? 'Submitting?' : 'Submit complaint'}</button>
    </form>
    {loading ? <p>Loading complaints?</p> : !items.length ? <p>No complaints submitted.</p> : items.map((item) => <article key={item._id} className="ev-card p-5 rounded-xl space-y-2">
      <h2 className="font-bold text-heading">{item.subject} ? {item.status}</h2><p className="whitespace-pre-wrap">{item.message}</p>
      {item.response && <p className="border-t border-border pt-3 whitespace-pre-wrap">Support response: {item.response}</p>}
    </article>)}
  </section>;
}
