import { useState, useEffect } from 'react';
import API from '../api/axios';
import { PlusCircle, DollarSign, Users, Calendar, Trash2, Plus, Upload, Clock, Mail, Phone, Tag, Image as ImageIcon, AlertCircle } from 'lucide-react';
import TicketVerifier from '../component/ticketVerifier';

const CATEGORIES = [
  'Music & Concerts',
  'Exhibitions & Fairs',
  'Conference & Workshops',
  'Theaters',
  'Sports',
  'Health & Fitness',
  'Travel & Adventure',
  'Food & Drink',
  'Others',
];

const OrganizerDashboard = () => {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, totalTicketsSold: 0 });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Today's date string for input min attribute (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Music & Concerts',
    bannerUrl: '',
    date: todayStr,
    location: '',
    startTime: '19:00',
    endTime: '23:00',
    contactEmail: '',
    contactPhone: '',
    ticketTypes: [
      { name: 'VIP', price: 50, quantity: 100 },
      { name: 'Regular', price: 25, quantity: 800 },
      { name: 'Early Bird', price: 20, quantity: 200 },
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
      // Analytics API returns { summary: { totalRevenue, totalTicketsSold, ... }, eventBreakdown }
      const analyticsData = analyticsRes.data?.summary || analyticsRes.data || {};
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  const handleAddTicketType = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: [...prev.ticketTypes, { name: '', price: '', quantity: '' }],
    }));
  };

  const handleRemoveTicketType = (index) => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((_, i) => i !== index),
    }));
  };

  const handleTicketTypeChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.ticketTypes];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, ticketTypes: updated };
    });
  };

  const resetForm = () => {
    setFormError('');
    setFormData({
      title: '',
      description: '',
      category: 'Music & Concerts',
      bannerUrl: '',
      date: todayStr,
      location: '',
      startTime: '19:00',
      endTime: '23:00',
      contactEmail: '',
      contactPhone: '',
      ticketTypes: [
        { name: 'VIP', price: 50, quantity: 100 },
        { name: 'Regular', price: 25, quantity: 800 },
        { name: 'Early Bird', price: 20, quantity: 200 },
      ],
    });
  };

  // Image Upload Handler with strict validation (Images only, reject PDF, DOCX, etc., max 5MB)
  const handleImageFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check MIME type - must be image
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
      setFormError('Only image files (JPEG, PNG, WEBP, GIF) can be uploaded. PDF, DOCX, and other file formats are strictly not allowed.');
      e.target.value = ''; // Reset file input
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size is too large. Please upload an image smaller than 5MB.');
      e.target.value = '';
      return;
    }

    setFormError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, bannerUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  // Validations: Email, Sri Lanka Phone Number, Future Date, Time, Fields
  const validateForm = () => {
    setFormError('');

    // Required fields check
    if (!formData.title.trim() || !formData.description.trim() || !formData.date || !formData.location.trim()) {
      setFormError('Please fill in all required fields (Title, Description, Date, Location).');
      return false;
    }

    // Date validation: Must be today or future date
    if (formData.date < todayStr) {
      setFormError('Event date cannot be in the past. Please select today or a future date.');
      return false;
    }

    // Time validation
    if (!formData.startTime || !formData.endTime) {
      setFormError('Please specify both Start Time and End Time for the event.');
      return false;
    }

    // Email format validation
    if (formData.contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contactEmail.trim())) {
        setFormError('Please enter a valid email address (e.g. name@example.com).');
        return false;
      }
    }

    // Phone Number validation (10 digits starting with 0 OR +94 followed by 9 digits)
    if (formData.contactPhone.trim()) {
      const cleanPhone = formData.contactPhone.trim().replace(/[\s-]/g, '');
      const phoneRegex = /^(?:0\d{9}|\+94\d{9})$/;
      if (!phoneRegex.test(cleanPhone)) {
        setFormError('Please enter a valid phone number: 10 digits starting with 0 (e.g., 0771234567) or +94 followed by 9 digits (e.g., +94771234567).');
        return false;
      }
    }

    // Ticket Types validation
    for (const tier of formData.ticketTypes) {
      if (!tier.name.trim() || tier.price === '' || tier.quantity === '') {
        setFormError('Please make sure all ticket tiers have a name, price, and quantity.');
        return false;
      }
      if (Number(tier.price) < 0 || Number(tier.quantity) < 1) {
        setFormError('Ticket price cannot be negative and quantity must be at least 1.');
        return false;
      }
    }

    return true;
  };

  const handleCreateEvent = async (status = 'published') => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        status,
        ticketTypes: formData.ticketTypes.map((t) => ({
          name: t.name.trim() || 'General',
          price: Number(t.price || 0),
          quantity: Number(t.quantity || 0),
        })),
      };

      await API.post('/events', payload);
      setShowModal(false);
      resetForm();
      fetchOrganizerData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Organizer Dashboard</h1>
          <p className="text-slate-400 text-sm">Manage events, track sales, and monitor net revenue.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-lg shadow-indigo-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Net Earnings (After 5% Cut)</p>
            <p className="text-2xl font-bold text-white">${analytics.totalRevenue || 0}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Tickets Sold</p>
            <p className="text-2xl font-bold text-white">{analytics.totalTicketsSold || 0}</p>
          </div>
        </div>
      </div>

      {/* Gate Ticket Verifier */}
      <TicketVerifier />

      {/* Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-8">
        <div className="p-4 border-b border-slate-800 font-semibold text-white flex justify-between items-center">
          <span>Your Events</span>
          <span className="text-xs text-slate-400 font-normal">{events.length} Events Total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Starting Price</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Total Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    No events created yet. Click <strong>Create Event</strong> to get started!
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt._id} className="hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-3">
                      {evt.bannerUrl && (
                        <img
                          src={evt.bannerUrl}
                          alt=""
                          className="w-9 h-9 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                      )}
                      <div>
                        <div>{evt.title}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{evt.location}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-950 border border-slate-800 text-indigo-300 text-xs px-2.5 py-1 rounded-full font-medium">
                        {evt.category || 'General'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{new Date(evt.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{evt.startTime || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {evt.status === 'draft' || !evt.isPublished ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                          Draft
                        </span>
                      ) : (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                          Published
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold">${evt.ticketPrice}</td>
                    <td className="px-4 py-3">{evt.availableTickets}</td>
                    <td className="px-4 py-3 font-semibold text-white">{evt.totalCapacity || evt.totalTickets || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Create New Event</h2>
                <p className="text-xs text-slate-400">Fill in the details below to set up your event.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Validation Error Banner */}
            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="flex-1">{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description *</label>
                <textarea
                  required
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category & Cover Image (File Upload & URL) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Cover Image (Image Only)
                  </label>
                  
                  {/* File Upload Input */}
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif, image/jpg"
                      onChange={handleImageFileUpload}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-1"
                    />
                    
                    {/* Fallback Image URL Input */}
                    <input
                      type="url"
                      value={formData.bannerUrl}
                      onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Image Preview if image selected */}
              {formData.bannerUrl && (
                <div className="relative h-32 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={formData.bannerUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <span className="bg-slate-950/90 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      ✓ Image Verified
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, bannerUrl: '' }))}
                      className="bg-rose-950/90 text-[10px] font-bold text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md hover:bg-rose-900 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {/* Date & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Start Time & End Time Validation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Ticket Types Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                  <label className="text-xs font-bold text-slate-200 uppercase">Ticket Types & Pricing</label>
                  <button
                    type="button"
                    onClick={handleAddTicketType}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formData.ticketTypes.map((tier, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => handleTicketTypeChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          value={tier.price}
                          onChange={(e) => handleTicketTypeChange(idx, 'price', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-semibold focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="1"
                          value={tier.quantity}
                          onChange={(e) => handleTicketTypeChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {formData.ticketTypes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTicketType(idx)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" /> Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" /> Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleCreateEvent('draft')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleCreateEvent('published')}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerDashboard;