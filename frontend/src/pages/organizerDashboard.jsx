import { useState, useEffect } from 'react';
import API from '../api/axios';
import {
  PlusCircle,
  DollarSign,
  Users,
  Calendar,
  X,
  Clock,
  MapPin,
  Tag,
  ImageIcon,
  Trash2,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import TicketVerifier from '../component/ticketVerifier';

const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, totalTicketsSold: 0 });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State matching exact screenshot & prompt requirements
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Music & Concerts',
    bannerUrl: '',
    schedules: [
      {
        location: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '07:00 PM',
        endTime: '11:00 PM',
      },
    ],
    ticketTypes: [
      {
        name: 'General',
        price: 20,
        quantity: 100,
        expiryDate: '',
      },
    ],
  });

  useEffect(() => {
    fetchOrganizerData();
  }, []);

  const fetchOrganizerData = async () => {
    try {
      const [eventsRes, analyticsRes] = await Promise.all([
        API.get('/events/organizer'),
        API.get('/analytics/organizer'),
      ]);
      setEvents(eventsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  // Image Upload Handler (Base64 file reader)
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, bannerUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Multi-Location Schedule Handlers
  const handleAddSchedule = () => {
    setFormData((prev) => ({
      ...prev,
      schedules: [
        ...prev.schedules,
        {
          location: '',
          date: new Date().toISOString().split('T')[0],
          startTime: '07:00 PM',
          endTime: '11:00 PM',
        },
      ],
    }));
  };

  const handleRemoveSchedule = (index) => {
    if (formData.schedules.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      schedules: prev.schedules.filter((_, i) => i !== index),
    }));
  };

  const handleScheduleChange = (index, field, value) => {
    setFormData((prev) => {
      const newSchedules = [...prev.schedules];
      newSchedules[index][field] = value;
      return { ...prev, schedules: newSchedules };
    });
  };

  // Multi-Tier Ticket Handlers
  const handleAddTier = (presetName = '') => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: [
        ...prev.ticketTypes,
        {
          name: presetName || `Tier ${prev.ticketTypes.length + 1}`,
          price: presetName === 'Early Bird' ? 15 : presetName === 'VIP' ? 50 : 25,
          quantity: presetName === 'Early Bird' ? 50 : 100,
          expiryDate: presetName === 'Early Bird' ? new Date().toISOString().split('T')[0] : '',
        },
      ],
    }));
  };

  const handleRemoveTier = (index) => {
    if (formData.ticketTypes.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((_, i) => i !== index),
    }));
  };

  const handleTierChange = (index, field, value) => {
    setFormData((prev) => {
      const newTiers = [...prev.ticketTypes];
      newTiers[index][field] = value;
      return { ...prev, ticketTypes: newTiers };
    });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Financial & capacity calculations
      const totalCap = formData.ticketTypes.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
      const minPrice = Math.min(...formData.ticketTypes.map((t) => Number(t.price || 0)));
      const primarySched = formData.schedules[0];

      await API.post('/events', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        bannerUrl: formData.bannerUrl,
        location: primarySched.location,
        date: primarySched.date,
        startTime: primarySched.startTime,
        endTime: primarySched.endTime,
        schedules: formData.schedules,
        ticketPrice: minPrice,
        totalCapacity: totalCap,
        totalTickets: totalCap,
        ticketTypes: formData.ticketTypes.map((t) => ({
          name: t.name,
          price: Number(t.price),
          quantity: Number(t.quantity),
          expiryDate: t.expiryDate || null,
        })),
      });

      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        category: 'Music & Concerts',
        bannerUrl: '',
        schedules: [
          {
            location: '',
            date: new Date().toISOString().split('T')[0],
            startTime: '07:00 PM',
            endTime: '11:00 PM',
          },
        ],
        ticketTypes: [
          {
            name: 'General',
            price: 20,
            quantity: 100,
            expiryDate: '',
          },
        ],
      });
      fetchOrganizerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-slate-100">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Organizer Dashboard</h1>
          <p className="text-slate-400 text-sm">Manage events, track sales, and monitor net revenue.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Net Earnings (After 5% Cut)</p>
            <p className="text-2xl font-black text-white">${analytics.totalRevenue || 0} USD</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Tickets Sold</p>
            <p className="text-2xl font-black text-white">{analytics.totalTicketsSold || 0} Seats</p>
          </div>
        </div>
      </div>

      {/* Gate Ticket Verifier */}
      <TicketVerifier />

      {/* Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-white flex justify-between items-center">
          <span>Your Published Events</span>
          <span className="text-xs text-slate-400">{events.length} Active Events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Title</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Date & Venue</th>
                <th className="px-4 py-3.5">Price</th>
                <th className="px-4 py-3.5">Remaining</th>
                <th className="px-4 py-3.5">Total Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    No events created yet. Click "Create Event" to get started!
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt._id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3.5 font-bold text-white">{evt.title}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                        {evt.category || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div>{new Date(evt.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{evt.location}</div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-400">${evt.ticketPrice}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-200">{evt.availableTickets}</td>
                    <td className="px-4 py-3.5 text-slate-400">{evt.totalCapacity || evt.totalTickets}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== CREATE NEW EVENT MODAL (MATCHING SCREENSHOT) ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-hidden animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl relative flex flex-col overflow-hidden">
            
            {/* Modal Header (Pinned at Top) */}
            <div className="p-6 border-b border-slate-800/80 bg-[#0b0f19] shrink-0 flex justify-between items-start z-10">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Create New Event</h2>
                <p className="text-xs text-slate-400 mt-1">Fill in the details below to set up your event.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body (Scrollable Container) */}
            <form onSubmit={handleCreateEvent} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-slate-100">
              
              {/* TITLE * */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  TITLE <span className="text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Music Festival 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                />
              </div>

              {/* DESCRIPTION * */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  DESCRIPTION <span className="text-indigo-400">*</span>
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Write a brief overview of your event..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition leading-relaxed"
                />
              </div>

              {/* CATEGORY & COVER IMAGE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* CATEGORY */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> CATEGORY
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Music & Concerts">Music & Concerts</option>
                    <option value="Conference">Conference</option>
                    <option value="Concert">Concert</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Tech & IT">Tech & IT</option>
                    <option value="Sports & Fitness">Sports & Fitness</option>
                    <option value="Arts & Theatre">Arts & Theatre</option>
                    <option value="Parties & Entertainment">Parties & Entertainment</option>
                    <option value="Business & Networking">Business & Networking</option>
                    <option value="Expos & Exhibitions">Expos & Exhibitions</option>
                    <option value="Seminars & Webinars">Seminars & Webinars</option>
                    <option value="Food & Drink">Food & Drink</option>
                  </select>
                </div>

                {/* COVER IMAGE */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> COVER IMAGE (IMAGE ONLY)
                  </label>
                  
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer hover:border-slate-700 transition">
                      <span className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition">
                        Choose File
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {formData.bannerUrl ? 'Image Selected' : 'No file chosen'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="text"
                      placeholder="Or paste Image URL (https://...)"
                      value={formData.bannerUrl}
                      onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                </div>

              </div>

              {/* ==================== MULTI-LOCATION & SCHEDULE SECTION ==================== */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/90 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-400" /> Locations & Tour Schedules
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSchedule}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Location Schedule
                  </button>
                </div>

                {formData.schedules.map((sched, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3 relative">
                    {formData.schedules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSchedule(idx)}
                        className="absolute top-3 right-3 text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                        LOCATION <span className="text-indigo-400">*</span> {formData.schedules.length > 1 ? `#${idx + 1}` : ''}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nelum Pokuna Theatre, Colombo"
                        value={sched.location}
                        onChange={(e) => handleScheduleChange(idx, 'location', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          DATE <span className="text-indigo-400 text-[9px]">(TODAY OR FUTURE)</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={sched.date}
                          onChange={(e) => handleScheduleChange(idx, 'date', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          START TIME <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="07:00 PM"
                          value={sched.startTime}
                          onChange={(e) => handleScheduleChange(idx, 'startTime', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          END TIME <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="11:00 PM"
                          value={sched.endTime}
                          onChange={(e) => handleScheduleChange(idx, 'endTime', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ==================== MULTI-TIER TICKETS & EARLY BIRD AUTO-EXPIRY ==================== */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/90 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" /> TICKET TYPES & PRICING
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddTier('Early Bird')}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg cursor-pointer"
                    >
                      + Early Bird Tier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTier('')}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      + Add Tier
                    </button>
                  </div>
                </div>

                {formData.ticketTypes.map((tier, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-3 relative">
                    {formData.ticketTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(idx)}
                        className="absolute top-3 right-3 text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          TIER NAME <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Early Bird / General / VIP"
                          value={tier.name}
                          onChange={(e) => handleTierChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          PRICE ($ USD) <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="25"
                          value={tier.price}
                          onChange={(e) => handleTierChange(idx, 'price', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                          TOTAL SEATS <span className="text-indigo-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="100"
                          value={tier.quantity}
                          onChange={(e) => handleTierChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* EARLY BIRD CUTOFF / EXPIRY DATE */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-400 uppercase mb-1 flex items-center justify-between">
                        <span>EARLY BIRD EXPIRATION DATE (OPTIONAL)</span>
                        <span className="text-[10px] text-slate-400 font-normal lowercase">
                          (Auto-expires ticket after this date)
                        </span>
                      </label>
                      <input
                        type="date"
                        value={tier.expiryDate}
                        onChange={(e) => handleTierChange(idx, 'expiryDate', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              </div>

              {/* ACTION BUTTONS (Pinned at Bottom) */}
              <div className="p-4 sm:px-8 border-t border-slate-800/80 bg-[#0b0f19] shrink-0 flex justify-end gap-3 z-10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? 'Publishing Event...' : 'Publish Event'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerDashboard;