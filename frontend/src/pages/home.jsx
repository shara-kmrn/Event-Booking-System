import { useState, useEffect } from 'react';
import API from '../api/axios';
import EventCard from '../component/eventCard';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data } = await API.get('/events');
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (event) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await API.post('/bookings', {
        eventId: event._id,
        quantity: 1,
      });
      setMessage(`Successfully booked ticket for ${event.title}!`);
      fetchEvents(); // Remaining tickets count එක refresh කිරීමට
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
          Upcoming <span className="text-indigo-400">Events</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Book your seats securely with our real-time atomic ticketing engine.
        </p>
      </div>

      {message && (
        <div className="max-w-md mx-auto mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm p-3 rounded-lg text-center">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center text-slate-500 py-12">No events published yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event._id} event={event} onBook={handleBooking} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;