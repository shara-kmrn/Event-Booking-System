import { useEffect, useRef, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/authContext';
export default function Profile() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { let active = true; API.get('/auth/profile').then(({ data }) => { if (active) setProfile(data); }).catch(() => { if (active) setMessage('Unable to load profile.'); }); return () => { active = false; }; }, []);
  const save = async (event) => {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try {
      const data = await updateProfile(Object.fromEntries(['name','firstName','lastName','contactNumber'].map((key) => [key, profile[key] || ''])));
      setProfile(data); setMessage('Profile updated.');
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to update profile.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="max-w-xl mx-auto p-6 my-8 ev-card rounded-2xl"><h1 className="text-2xl font-bold text-heading">My Profile</h1>
    {message && <p role="status" className="my-4">{message}</p>}
    {!profile ? <p>Loading profile?</p> : <form onSubmit={save} className="space-y-4 mt-4">
      <p>{profile.email} ? {profile.role}</p>
      {['name','firstName','lastName','contactNumber'].map((key) => <label key={key} className="block">{({ name:'Display name', firstName:'First name', lastName:'Last name', contactNumber:'Contact number' })[key]}
        <input className="ev-input block w-full p-3 rounded-xl" required={key === 'name'} maxLength={key === 'contactNumber' ? 32 : 100} value={profile[key] || ''} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}
      <button disabled={busy} className="ev-btn-primary p-3 rounded-xl">{busy ? 'Saving?' : 'Save profile'}</button>
    </form>}
  </section>;
}
