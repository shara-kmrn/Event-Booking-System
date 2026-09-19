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
  Shield,
  Trash2,
  Sparkles,
  Search,
  RefreshCw,
  TrendingUp,
  Activity,
  Ticket,
  PieChart,
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
  const [organizersList, setOrganizersList] = useState([]);
  const [payoutsList, setPayoutsList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
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
      } else if (tab === 'users') {
        const { data } = await API.get('/admin/users');
        setUsersList(data);
      } else if (tab === 'organizers') {
        const { data: orgData } = await API.get('/admin/organizers');
        const { data: payData } = await API.get('/admin/payouts');
        setOrganizersList(orgData);
        setPayoutsList(payData);
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

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await API.put(`/admin/users/${userId}/status`, { status: newStatus });
      setSuccess(`User account status updated to ${newStatus.toUpperCase()}`);
      fetchTabData(activeTab);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account status.');
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

  const handleApproveOrganizer = async (id) => {
    try {
      await API.put(`/admin/organizers/${id}/approve`);
      setSuccess('Organizer status set to APPROVED.');
      fetchTabData('organizers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve organizer.');
    }
  };

  const handleRejectOrganizer = async (id) => {
    try {
      await API.put(`/admin/organizers/${id}/reject`);
      setSuccess('Organizer status set to REJECTED.');
      fetchTabData('organizers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject organizer.');
    }
  };

  const handleProcessPayoutRequest = async (id) => {
    try {
      await API.put(`/admin/payouts/${id}/process`);
      setSuccess('Payout request marked as PROCESSED.');
      fetchTabData('organizers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process payout request.');
    }
  };

  const handleRejectPayoutRequest = async (id) => {
    try {
      await API.put(`/admin/payouts/${id}/reject`);
      setSuccess('Payout request REJECTED.');
      fetchTabData('organizers');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject payout request.');
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
    const reportData = usersList.length ? usersList : [];
    const headers = ['Name', 'Email', 'Role', 'Status', 'Subscription Plan', 'Created At'];
    const rows = reportData.map((u) => [
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
    link.setAttribute('download', `eventra_overview_report_${Date.now()}.csv`);
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
    if (userRoleFilter !== 'all') return matchesSearch && u.role === userRoleFilter;
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
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> System Overview
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> User Management
          </button>

          <button
            onClick={() => setActiveTab('organizers')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'organizers'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> SaaS Organizers
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'events'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <CalendarCheck className="w-4 h-4" /> Event Moderation
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" /> Categories & Venues
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Payments & Refunds
          </button>

          <button
            onClick={() => setActiveTab('complaints')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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
            <p className="text-xs text-slate-400 mt-1">
              Logged in as <span className="text-indigo-400 font-semibold">{user?.email}</span> ({user?.role})
            </p>
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
            <button onClick={() => setError('')} className="cursor-pointer">✕</button>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="cursor-pointer">✕</button>
          </div>
        )}

        {/* TAB 1: SYSTEM OVERVIEW WITH CHARTS, HEALTH METRICS & ACTIVITY FEED */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
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

            {/* Section 1: Pure React 19 Tailwind Revenue Trend Chart */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> Revenue & Ticket Sales Trend Chart
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Platform Fee (5%) & Gross Ticket Sales Performance Over Time
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-5 gap-3 items-end h-56 bg-slate-950/80 p-5 rounded-xl border border-slate-800/80">
                  {(stats?.trendData || [
                    { period: 'May 2026', grossSales: 12000, platformFee: 600 },
                    { period: 'Jun 2026', grossSales: 25000, platformFee: 1250 },
                    { period: 'Jul 2026', grossSales: 48000, platformFee: 2400 },
                    { period: 'Aug 2026', grossSales: 85000, platformFee: 4250 },
                    { period: 'Sep 2026', grossSales: 110000, platformFee: 5500 },
                  ]).map((item, idx) => {
                    const maxVal = 120000;
                    const salesHeight = Math.min(100, Math.max(15, (item.grossSales / maxVal) * 100));
                    const feeHeight = Math.min(100, Math.max(10, (item.platformFee / (maxVal * 0.05)) * 100));
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="text-[10px] text-indigo-300 font-bold opacity-0 group-hover:opacity-100 transition">
                          LKR {item.grossSales.toLocaleString()}
                        </div>
                        <div className="w-full flex items-end justify-center gap-1.5 h-full">
                          <div
                            className="w-1/2 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:from-indigo-500 group-hover:to-indigo-300"
                            style={{ height: `${salesHeight}%` }}
                            title={`Gross Sales: LKR ${item.grossSales}`}
                          />
                          <div
                            className="w-1/2 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 group-hover:from-emerald-500 group-hover:to-emerald-300"
                            style={{ height: `${feeHeight}%` }}
                            title={`Platform Fee 5%: LKR ${item.platformFee}`}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 font-semibold">{item.period}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center gap-6 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
                    <span className="text-slate-300">Gross Sales (LKR)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                    <span className="text-slate-300">Platform Fee 5% (LKR)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 & 3: Platform Health Metrics & Live Recent Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Platform Health & Inventory Metrics */}
              <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-purple-400" /> Platform Health & Inventory Metrics
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-xs block">Active Events Ratio</span>
                    <span className="text-xl font-extrabold text-emerald-400 mt-1 block">
                      {stats?.healthMetrics?.activeEvents || 0} Active
                    </span>
                    <span className="text-[11px] text-slate-500">Available tickets &gt; 0</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 text-xs block">Sold Out Events</span>
                    <span className="text-xl font-extrabold text-rose-400 mt-1 block">
                      {stats?.healthMetrics?.soldOutEvents || 0} Sold Out
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {stats?.healthMetrics?.occupancyRate || 0}% Occupancy rate
                    </span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 col-span-2">
                    <span className="text-slate-400 text-xs block">Average Ticket Price</span>
                    <span className="text-2xl font-black text-indigo-400 mt-1 block">
                      LKR {(stats?.healthMetrics?.averageTicketPrice || 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500">Mean ticket price across all platform events</span>
                  </div>
                </div>
              </div>

              {/* Recent System Activity Feed */}
              <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" /> Recent System Activity Feed
                </h3>

                <div className="space-y-3">
                  {stats?.recentActivity?.length > 0 ? (
                    stats.recentActivity.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs"
                      >
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                          {act.type === 'user' ? (
                            <Users className="w-3.5 h-3.5" />
                          ) : act.type === 'event' ? (
                            <CalendarCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-200 font-medium">{act.text}</p>
                          <span className="text-[10px] text-slate-500">
                            {new Date(act.time).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No recent system activity recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl w-full sm:w-auto overflow-x-auto">
                {['all', 'customer', 'organizer', 'superadmin'].map((roleKey) => (
                  <button
                    key={roleKey}
                    onClick={() => setUserRoleFilter(roleKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition cursor-pointer shrink-0 ${
                      userRoleFilter === roleKey
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {roleKey === 'all' ? 'All Roles' : roleKey}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Role Management</th>
                    <th className="p-4">Email Verification</th>
                    <th className="p-4">Account Status (Suspend / Ban)</th>
                    <th className="p-4">Subscription</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-slate-900/50 transition">
                        <td className="p-4 font-semibold text-white">
                          <div className="text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{u.email}</div>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-semibold cursor-pointer focus:outline-none focus:border-indigo-500"
                          >
                            <option value="customer">Customer</option>
                            <option value="organizer">Organizer</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        </td>
                        <td className="p-4">
                          {u.isVerified ? (
                            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              Verified
                            </span>
                          ) : (
                            <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.status || 'active'}
                              onChange={(e) => handleStatusChange(u._id, e.target.value)}
                              className={`bg-slate-950 border rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase cursor-pointer focus:outline-none ${
                                u.status === 'banned'
                                  ? 'text-rose-400 border-rose-500/40 bg-rose-500/10'
                                  : u.status === 'suspended'
                                  ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                                  : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                              }`}
                            >
                              <option value="active" className="bg-slate-950 text-emerald-400">
                                ACTIVE
                              </option>
                              <option value="suspended" className="bg-slate-950 text-amber-400">
                                SUSPENDED
                              </option>
                              <option value="banned" className="bg-slate-950 text-rose-400">
                                BANNED
                              </option>
                            </select>

                            {/* Quick Action buttons */}
                            {u.status === 'active' && (
                              <button
                                onClick={() => handleStatusChange(u._id, 'suspended')}
                                title="Suspend Account"
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-[10px] font-bold transition cursor-pointer"
                              >
                                Suspend
                              </button>
                            )}
                            {u.status !== 'banned' && (
                              <button
                                onClick={() => handleStatusChange(u._id, 'banned')}
                                title="Ban Account"
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-md text-[10px] font-bold transition cursor-pointer"
                              >
                                Ban
                              </button>
                            )}
                            {(u.status === 'suspended' || u.status === 'banned') && (
                              <button
                                onClick={() => handleStatusChange(u._id, 'active')}
                                title="Reactivate Account"
                                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-bold transition cursor-pointer"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {u.role === 'organizer' ? (
                            <select
                              value={u.subscriptionPlan || 'free'}
                              onChange={(e) => handlePlanChange(u._id, e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-purple-300 uppercase font-bold cursor-pointer"
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
                            title="Delete User"
                            className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-500">
                        No matching users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SAAS ORGANIZERS MANAGEMENT, VERIFICATION & PAYOUTS */}
        {activeTab === 'organizers' && (
          <div className="space-y-6">
            {/* 1. Organizers Verification & Ticket Sales Section */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-400" /> SaaS Organizers & Verification Status
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Approve or Reject organizer credentials, monitor subscription plans and total ticket sales.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-4">Organizer</th>
                      <th className="p-4">Verification Status</th>
                      <th className="p-4">Subscription Plan</th>
                      <th className="p-4">Total Tickets Sold</th>
                      <th className="p-4">Total Revenue</th>
                      <th className="p-4 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {organizersList.length > 0 ? (
                      organizersList.map((org) => (
                        <tr key={org._id} className="hover:bg-slate-900/50 transition">
                          <td className="p-4 font-semibold text-white">
                            <div className="text-sm">{org.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{org.email}</div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                org.organizerStatus === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : org.organizerStatus === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {org.organizerStatus || 'approved'}
                            </span>
                          </td>
                          <td className="p-4">
                            <select
                              value={org.subscriptionPlan || 'free'}
                              onChange={(e) => handlePlanChange(org._id, e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-purple-300 uppercase font-bold cursor-pointer"
                            >
                              <option value="free">FREE</option>
                              <option value="pro">PRO (SaaS)</option>
                            </select>
                          </td>
                          <td className="p-4 font-bold text-indigo-300">
                            <span className="bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                              {(org.totalTicketsSold || 0).toLocaleString()} Tickets
                            </span>
                          </td>
                          <td className="p-4 font-bold text-emerald-400">
                            LKR {(org.totalRevenue || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {org.organizerStatus !== 'approved' && (
                              <button
                                onClick={() => handleApproveOrganizer(org._id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-md shadow-emerald-600/20"
                              >
                                Approve
                              </button>
                            )}
                            {org.organizerStatus !== 'rejected' && (
                              <button
                                onClick={() => handleRejectOrganizer(org._id)}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-500">
                          No SaaS Organizers registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Payout Requests Details Section (Withdrawals) */}
            <div className="glass-panel border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-purple-400" /> Payout & Withdrawal Requests
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review and process revenue payout requests submitted by event organizers.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-4">Organizer</th>
                      <th className="p-4">Requested Amount</th>
                      <th className="p-4">Bank Details</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {payoutsList.length > 0 ? (
                      payoutsList.map((pay) => (
                        <tr key={pay._id} className="hover:bg-slate-900/50 transition">
                          <td className="p-4 font-semibold text-white">
                            <div>{pay.organizerId?.name || 'Organizer'}</div>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {pay.organizerId?.email || 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 font-black text-emerald-400 text-sm">
                            LKR {pay.amount.toLocaleString()}
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white">{pay.bankName}</div>
                            <div className="text-[11px] text-slate-400">
                              Acc: {pay.accountNumber} ({pay.accountHolder})
                            </div>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                pay.status === 'processed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : pay.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {pay.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {pay.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleProcessPayoutRequest(pay._id)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-md shadow-emerald-600/20"
                                >
                                  Process Payout
                                </button>
                                <button
                                  onClick={() => handleRejectPayoutRequest(pay._id)}
                                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-6 text-center text-slate-500">
                          No pending payout requests found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                    <button onClick={() => handleDeleteCategory(c._id)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
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
                    <button onClick={() => handleDeleteVenue(v._id)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
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
