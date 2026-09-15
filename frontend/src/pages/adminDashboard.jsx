import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/authContext';
import {
  Users,
  Building2,
  CalendarCheck,
  CreditCard,
  Tag,
  MapPin,
  MessageSquareWarning,
  Download,
  CheckCircle2,
  XCircle,
  Shield,
  Trash2,
  Sparkles,
  Search,
  RefreshCw,
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [eventsList, setEventsList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [venues, setVenues] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // Form states
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newVenue, setNewVenue] = useState({ name: '', address: '', capacity: '' });

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const fetchTabData = async (tab) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'overview') {
        const { data } = await API.get('/analytics/admin');
        setStats(data);
      } else if (tab === 'users' || tab === 'organizers') {
        const { data } = await API.get('/admin/users');
        setUsersList(data);
      } else if (tab === 'events') {
        const { data } = await API.get('/admin/events');
        setEventsList(data);
      } else if (tab === 'categories') {
        const { data: catData } = await API.get('/admin/categories');
        const { data: venData } = await API.get('/admin/venues');
        setCategories(catData);
        setVenues(venData);
      } else if (tab === 'payments') {
        const { data } = await API.get('/admin/transactions');
        setTransactions(data);
      } else if (tab === 'complaints') {
        const { data } = await API.get('/admin/complaints');
        setComplaints(data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleRoleChange = async (userId, newRole) => {
    try {
      await API.put(`/admin/users/${userId}/role`, { role: newRole });
      setSuccess(`User role updated to ${newRole}`);
      fetchTabData('users');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role.');
    }
  };

  const handlePlanChange = async (userId, newPlan) => {
    try {
      await API.put(`/admin/organizers/${userId}/plan`, { subscriptionPlan: newPlan });
      setSuccess(`Organizer plan updated to ${newPlan.toUpperCase()}`);
      fetchTabData('organizers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update plan.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await API.delete(`/admin/users/${userId}`);
      setSuccess('User deleted successfully.');
      fetchTabData(activeTab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const handleApproveEvent = async (eventId) => {
    try {
      await API.put(`/admin/events/${eventId}/approve`);
      setSuccess('Event approved successfully.');
      fetchTabData('events');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve event.');
    }
  };

  const handleRejectEvent = async (eventId) => {
    try {
      await API.put(`/admin/events/${eventId}/reject`);
      setSuccess('Event rejected.');
      fetchTabData('events');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject event.');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/categories', newCategory);
      setSuccess('Category added successfully.');
      setNewCategory({ name: '', description: '' });
      fetchTabData('categories');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add category.');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await API.delete(`/admin/categories/${id}`);
      setSuccess('Category deleted.');
      fetchTabData('categories');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete category.');
    }
  };

  const handleAddVenue = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/venues', newVenue);
      setSuccess('Venue added successfully.');
      setNewVenue({ name: '', address: '', capacity: '' });
      fetchTabData('categories');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add venue.');
    }
  };

  const handleDeleteVenue = async (id) => {
    try {
      await API.delete(`/admin/venues/${id}`);
      setSuccess('Venue deleted.');
      fetchTabData('categories');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete venue.');
    }
  };

  const handleProcessRefund = async (id) => {
    try {
      await API.put(`/admin/transactions/${id}/refund`);
      setSuccess('Refund processed successfully.');
      fetchTabData('payments');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process refund.');
    }
  };

  const handleResolveComplaint = async (id) => {
    try {
      await API.put(`/admin/complaints/${id}/resolve`);
      setSuccess('Complaint marked as resolved.');
      fetchTabData('complaints');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve complaint.');
    }
  };

  // Export CSV Report
  const exportSystemReportCSV = () => {
    if (!usersList.length) return;
    const headers = ['Name', 'Email', 'Role', 'Status', 'Subscription Plan', 'Created At'];
    const rows = usersList.map((u) => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.role}"`,
      `"${u.isVerified ? 'Verified' : 'Unverified'}"`,
      `"${u.subscriptionPlan || 'free'}"`,
      `"${new Date(u.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `eventra_users_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter users by search & tab
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    if (activeTab === 'organizers') return matchesSearch && u.role === 'organizer';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col md:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 border-r border-slate-800/80 p-5 space-y-2 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Superadmin</h2>
            <p className="text-[11px] text-slate-400 font-medium">Control Center</p>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> System Overview
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> User Management
          </button>

          <button
            onClick={() => setActiveTab('organizers')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'organizers'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> SaaS Organizers
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'events'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <CalendarCheck className="w-4 h-4" /> Event Moderation
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'categories'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" /> Categories & Venues
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'payments'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Payments & Refunds
          </button>

          <button
            onClick={() => setActiveTab('complaints')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'complaints'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <MessageSquareWarning className="w-4 h-4" /> Complaints & Issues
          </button>
        </nav>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-x-hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h1 className="text-2xl font-black text-white capitalize flex items-center gap-2">
              {activeTab} Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">Logged in as <span className="text-indigo-400 font-semibold">{user?.email}</span></p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTabData(activeTab)}
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportSystemReportCSV}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase">Total Platform Users</p>
                <h3 className="text-2xl font-black text-white mt-1">{stats?.overview?.totalUsers || 0}</h3>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase">SaaS Event Organizers</p>
                <h3 className="text-2xl font-black text-indigo-400 mt-1">{stats?.overview?.totalOrganizers || 0}</h3>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase">Total Published Events</p>
                <h3 className="text-2xl font-black text-purple-400 mt-1">{stats?.overview?.totalEvents || 0}</h3>
              </div>

              <div className="glass-panel border border-slate-800 rounded-2xl p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase">Platform Fees Earned (5%)</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">
                  LKR {(stats?.financials?.totalPlatformEarnings || 0).toLocaleString()}
                </h3>
              </div>
            </div>

            <div className="glass-panel border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white mb-4">Financial Volume Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 text-xs block">Gross Transaction Volume</span>
                  <span className="text-xl font-bold text-white mt-1 block">
                    LKR {(stats?.financials?.totalGrossVolume || 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 text-xs block">Total Tickets Issued</span>
                  <span className="text-xl font-bold text-indigo-400 mt-1 block">
                    {(stats?.financials?.totalTicketsIssued || 0).toLocaleString()} Tickets
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2 & 3: USER & ORGANIZER MANAGEMENT */}
        {(activeTab === 'users' || activeTab === 'organizers') && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Subscription</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-900/50 transition">
                      <td className="p-4 font-semibold text-white">
                        <div>{u.name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300"
                        >
                          <option value="customer">Customer</option>
                          <option value="organizer">Organizer</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </td>
                      <td className="p-4">
                        {u.isVerified ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full text-[10px] font-bold">
                            Verified
                          </span>
                        ) : (
                          <span className="text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full text-[10px] font-bold">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {u.role === 'organizer' ? (
                          <select
                            value={u.subscriptionPlan || 'free'}
                            onChange={(e) => handlePlanChange(u._id, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-purple-300 uppercase font-bold"
                          >
                            <option value="free">FREE</option>
                            <option value="pro">PRO (SaaS)</option>
                          </select>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: EVENT MODERATION */}
        {activeTab === 'events' && (
          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400">
                <tr>
                  <th className="p-4">Event Title</th>
                  <th className="p-4">Organizer</th>
                  <th className="p-4">Date & Location</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Approval Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {eventsList.map((evt) => (
                  <tr key={evt._id} className="hover:bg-slate-900/50">
                    <td className="p-4 font-bold text-white">{evt.title}</td>
                    <td className="p-4 text-slate-400">{evt.tenantId?.name || 'N/A'}</td>
                    <td className="p-4">
                      <div>{new Date(evt.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{evt.location}</div>
                    </td>
                    <td className="p-4 font-semibold text-emerald-400">LKR {evt.ticketPrice}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          evt.approvalStatus === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : evt.approvalStatus === 'rejected'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {evt.approvalStatus || 'approved'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleApproveEvent(evt._id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectEvent(evt._id)}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold cursor-pointer"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: CATEGORIES & VENUES */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categories */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" /> Manage Categories
              </h3>
              <form onSubmit={handleAddCategory} className="space-y-3">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Music, Tech)"
                  required
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white">
                  Add Category
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {categories.map((c) => (
                  <div key={c._id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                    <span className="font-semibold text-white">{c.name}</span>
                    <button onClick={() => handleDeleteCategory(c._id)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Venues */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" /> Manage Venues
              </h3>
              <form onSubmit={handleAddVenue} className="space-y-3">
                <input
                  type="text"
                  placeholder="Venue Name (e.g. Nelum Pokuna)"
                  required
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Address / City"
                  required
                  value={newVenue.address}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <button type="submit" className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white">
                  Add Venue
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {venues.map((v) => (
                  <div key={v._id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                    <div>
                      <div className="font-semibold text-white">{v.name}</div>
                      <div className="text-[10px] text-slate-500">{v.address}</div>
                    </div>
                    <button onClick={() => handleDeleteVenue(v._id)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENTS & REFUNDS */}
        {activeTab === 'payments' && (
          <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400">
                <tr>
                  <th className="p-4">Booking Ref</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Event</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Refund Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-900/50">
                    <td className="p-4 font-mono font-bold text-indigo-300">{tx.bookingReference || tx._id.slice(-6)}</td>
                    <td className="p-4 text-white">{tx.userId?.name || 'Customer'}</td>
                    <td className="p-4 text-slate-400">{tx.eventId?.title || 'Event'}</td>
                    <td className="p-4 font-bold text-emerald-400">LKR {tx.totalAmount}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          tx.paymentStatus === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : tx.paymentStatus === 'refunded'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {tx.paymentStatus === 'paid' && (
                        <button
                          onClick={() => handleProcessRefund(tx._id)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold cursor-pointer"
                        >
                          Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: COMPLAINTS */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map((c) => (
              <div key={c._id} className="glass-panel border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{c.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{c.message}</p>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Submitted by {c.user?.name} ({c.user?.email}) on {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                {c.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolveComplaint(c._id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
