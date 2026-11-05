import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckInHistory, RecentBookings } from '../component/phase3Panels';
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
} from 'lucide-react';

const requestAdminTab = async (tab) => {
  if (tab === 'overview') return { stats: (await API.get('/analytics/admin')).data };
  if (tab === 'users' || tab === 'organizers') return { users: (await API.get('/admin/users')).data };
  if (tab === 'events') return { events: (await API.get('/admin/events')).data };
  if (tab === 'payments') return { transactions: (await API.get('/admin/transactions')).data };
  if (tab === 'complaints') return { complaints: (await API.get('/admin/complaints')).data };
  if (tab === 'categories') {
    const [categories, venues] = await Promise.all([API.get('/admin/categories'), API.get('/admin/venues')]);
    return { categories: categories.data, venues: venues.data };
  }
  return {};
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const mutationLock = useRef(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(''), [statusFilter, setStatusFilter] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [eventsList, setEventsList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [venues, setVenues] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // Form states
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newVenue, setNewVenue] = useState({ name: '', address: '', capacity: '' });

  const applyTabData = useCallback((data) => {
    if (data.stats) setStats(data.stats);
    if (data.users) setUsersList(data.users);
    if (data.events) setEventsList(data.events);
    if (data.categories) setCategories(data.categories);
    if (data.venues) setVenues(data.venues);
    if (data.transactions) setTransactions(data.transactions);
    if (data.complaints) setComplaints(data.complaints);
  }, []);
  const fetchTabData = async (tab) => {
    setLoading(true); setError('');
    try { applyTabData(await requestAdminTab(tab)); }
    catch (failure) { setError(failure.response?.data?.message || 'Failed to load dashboard data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    requestAdminTab(activeTab).then((data) => {
      if (active) { applyTabData(data); setError(''); }
    }).catch((failure) => {
      if (active) setError(failure.response?.data?.message || 'Failed to load dashboard data.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeTab, applyTabData]);
  const switchTab = (tab) => {
    if (tab !== activeTab) { setLoading(true); setError(''); setActiveTab(tab); }
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

  const handleDeleteUser = async (userId, accountStatus) => {
    if (!window.confirm('Change this user?s account access? Existing sessions will be revoked.')) return;
    try {
      await API.put(`/admin/users/${userId}/status`, { accountStatus: accountStatus === 'suspended' ? 'active' : 'suspended' });
      setSuccess('Account access updated.');
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
    const reason = window.prompt('Rejection reason (minimum 5 characters):'); if (!reason) return;
    try {
      await API.put(`/admin/events/${eventId}/reject`, { reason });
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
    if (!window.confirm('Delete this category?')) return;
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
    if (!window.confirm('Delete this venue?')) return;
    try {
      await API.delete(`/admin/venues/${id}`);
      setSuccess('Venue deleted.');
      fetchTabData('categories');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete venue.');
    }
  };

  const handleProcessRefund = async (id) => {
    if (!window.confirm('Request a verified Stripe refund for this booking?')) return;
    try {
      const { data } = await API.put(`/admin/transactions/${id}/refund`);
      setSuccess(data.message);
      fetchTabData('payments');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process refund.');
    }
  };

  const handleResolveComplaint = async (id, status = 'resolved') => {
    const response = window.prompt('Response to the customer:'); if (!response) return;
    try {
      await API.put(`/admin/complaints/${id}/resolve`, { response, status });
      setSuccess('Complaint updated.');
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
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && (u.accountStatus || 'active') !== statusFilter) return false;
    if (activeTab === 'organizers') return matchesSearch && u.role === 'organizer';
    return matchesSearch;
  });

  const guardedAction = async (action) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setActionBusy(true);
    try { await action(); } finally { mutationLock.current = false; setActionBusy(false); }
  };
  return (
    <div className="min-h-screen bg-main text-heading flex flex-col md:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-5 space-y-2 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary p-0.5">
            <div className="w-full h-full bg-card rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-accent" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-black text-heading tracking-tight">Superadmin</h2>
            <p className="text-[11px] text-body font-medium">Control Center</p>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => switchTab('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <Sparkles className="w-4 h-4" /> System Overview
          </button>

          <button
            onClick={() => switchTab('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <Users className="w-4 h-4" /> User Management
          </button>

          <button
            onClick={() => switchTab('organizers')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'organizers'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <Building2 className="w-4 h-4" /> SaaS Organizers
          </button>

          <button
            onClick={() => switchTab('events')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'events'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <CalendarCheck className="w-4 h-4" /> Event Moderation
          </button>

          <button
            onClick={() => switchTab('categories')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'categories'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <Tag className="w-4 h-4" /> Categories & Venues
          </button>

          <button
            onClick={() => switchTab('payments')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'payments'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Payments & Refunds
          </button>

          <button
            onClick={() => switchTab('complaints')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'complaints'
                ? 'bg-primary-soft text-accent border border-primary-border'
                : 'text-body hover:bg-card hover:text-heading'
            }`}
          >
            <MessageSquareWarning className="w-4 h-4" /> Complaints & Issues
          </button>
        </nav>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-x-hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-black text-heading capitalize flex items-center gap-2">
              {activeTab} Dashboard
            </h1>
            <p className="text-xs text-body mt-1">Logged in as <span className="text-accent font-semibold">{user?.email}</span></p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTabData(activeTab)}
              className="p-2.5 bg-card border border-border rounded-xl text-body hover:text-heading transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportSystemReportCSV}
              className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV Report</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-error-soft border border-error-border text-danger text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {success && (
          <div className="bg-primary-soft border border-primary-border text-accent text-xs p-3.5 rounded-xl flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel border border-border rounded-2xl p-5">
                <p className="text-xs text-body font-semibold uppercase">Total Platform Users</p>
                <h3 className="text-2xl font-black text-heading mt-1">{stats?.overview?.totalUsers || 0}</h3>
              </div>

              <div className="glass-panel border border-border rounded-2xl p-5">
                <p className="text-xs text-body font-semibold uppercase">SaaS Event Organizers</p>
                <h3 className="text-2xl font-black text-accent mt-1">{stats?.overview?.totalOrganizers || 0}</h3>
              </div>

              <div className="glass-panel border border-border rounded-2xl p-5">
                <p className="text-xs text-body font-semibold uppercase">Total Published Events</p>
                <h3 className="text-2xl font-black text-accent mt-1">{stats?.overview?.totalEvents || 0}</h3>
              </div>

              <div className="glass-panel border border-border rounded-2xl p-5">
                <p className="text-xs text-body font-semibold uppercase">Platform Fees Earned (5%)</p>
                <h3 className="text-2xl font-black text-accent mt-1">
                  USD {(stats?.financials?.totalPlatformEarnings || 0).toLocaleString()}
                </h3>
              </div>
            </div>

            <div className="glass-panel border border-border rounded-2xl p-6">
              <h3 className="text-base font-bold text-heading mb-4">Financial Volume Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-card p-4 rounded-xl border border-border">
                  <span className="text-body text-xs block">Gross Transaction Volume</span>
                  <span className="text-xl font-bold text-heading mt-1 block">
                    USD {(stats?.financials?.totalGrossVolume || 0).toLocaleString()}
                  </span>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border">
                  <span className="text-body text-xs block">Total Tickets Issued</span>
                  <span className="text-xl font-bold text-accent mt-1 block">
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
              <Search className="w-4 h-4 text-subtle absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-heading focus:outline-none focus:border-primary-border"
              />
            </div>

            <div className="glass-panel border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-body">
                <thead className="bg-card uppercase text-[10px] font-bold text-body tracking-wider">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Subscription</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-card transition">
                      <td className="p-4 font-semibold text-heading">
                        <div>{u.name}</div>
                        <div className="text-[11px] text-body font-normal">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          disabled={actionBusy || u.role === 'superadmin'} onChange={(e) => guardedAction(() => handleRoleChange(u._id, e.target.value))}
                          className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-accent"
                        >
                          <option value="customer">Customer</option>
                          <option value="organizer">Organizer</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <span className="block text-xs mb-1">{u.accountStatus || 'active'}</span>
                        {u.isVerified ? (
                          <span className="text-accent bg-primary-soft px-2 py-1 rounded-full text-[10px] font-bold">
                            Verified
                          </span>
                        ) : (
                          <span className="text-warning bg-warning-soft px-2 py-1 rounded-full text-[10px] font-bold">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {u.role === 'organizer' ? (
                          <select
                            value={u.subscriptionPlan || 'free'}
                            disabled={actionBusy} onChange={(e) => guardedAction(() => handlePlanChange(u._id, e.target.value))}
                            className="bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-accent uppercase font-bold"
                          >
                            <option value="free">FREE</option>
                            <option value="pro">PRO (SaaS)</option>
                          </select>
                        ) : (
                          <span className="text-subtle">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          disabled={actionBusy || u.role === 'superadmin'} title={u.accountStatus === 'suspended' ? 'Reactivate account' : 'Suspend account'} onClick={() => guardedAction(() => handleDeleteUser(u._id, u.accountStatus))}
                          className="p-1.5 bg-error-soft text-danger hover:bg-error-soft rounded-lg transition cursor-pointer"
                        >
                          {u.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}
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
          <div className="glass-panel border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-body">
              <thead className="bg-card uppercase text-[10px] font-bold text-body">
                <tr>
                  <th className="p-4">Event Title</th>
                  <th className="p-4">Organizer</th>
                  <th className="p-4">Date & Location</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Approval Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventsList.map((evt) => (
                  <tr key={evt._id} className="hover:bg-card">
                    <td className="p-4 font-bold text-heading">{evt.title}</td>
                    <td className="p-4 text-body">{evt.tenantId?.name || 'N/A'}</td>
                    <td className="p-4">
                      <div>{new Date(evt.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-subtle">{evt.location}</div>
                    </td>
                    <td className="p-4 font-semibold text-accent">USD {evt.ticketPrice}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          evt.approvalStatus === 'approved'
                            ? 'bg-primary-soft text-accent'
                            : evt.approvalStatus === 'rejected'
                            ? 'bg-error-soft text-danger'
                            : 'bg-warning-soft text-warning'
                        }`}
                      >
                        {evt.approvalStatus || 'pending'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        disabled={actionBusy} onClick={() => guardedAction(() => handleApproveEvent(evt._id))}
                        className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-on-primary rounded-lg font-bold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionBusy} onClick={() => guardedAction(() => handleRejectEvent(evt._id))}
                        className="px-2.5 py-1 bg-danger hover:bg-danger-hover text-on-danger rounded-lg font-bold cursor-pointer"
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
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent" /> Manage Categories
              </h3>
              <form onSubmit={(event) => { event.preventDefault(); guardedAction(() => handleAddCategory(event)); }} className="space-y-3">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Music, Tech)"
                  required
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-heading"
                />
                <button type="submit" className="w-full py-2 bg-primary hover:bg-primary-hover rounded-xl text-xs font-bold text-on-primary">
                  Add Category
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {categories.map((c) => (
                  <div key={c._id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl text-xs">
                    <span className="font-semibold text-heading">{c.name}</span>
                    <button disabled={actionBusy} onClick={() => guardedAction(() => handleDeleteCategory(c._id))} className="text-danger hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Venues */}
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-heading flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent" /> Manage Venues
              </h3>
              <form onSubmit={(event) => { event.preventDefault(); guardedAction(() => handleAddVenue(event)); }} className="space-y-3">
                <input
                  type="text"
                  placeholder="Venue Name (e.g. Nelum Pokuna)"
                  required
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-heading"
                />
                <input
                  type="text"
                  placeholder="Address / City"
                  required
                  value={newVenue.address}
                  onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-heading"
                />
                <button type="submit" className="w-full py-2 bg-primary hover:bg-primary-hover rounded-xl text-xs font-bold text-on-primary">
                  Add Venue
                </button>
              </form>

              <div className="space-y-2 pt-2">
                {venues.map((v) => (
                  <div key={v._id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl text-xs">
                    <div>
                      <div className="font-semibold text-heading">{v.name}</div>
                      <div className="text-[10px] text-subtle">{v.address}</div>
                    </div>
                    <button disabled={actionBusy} onClick={() => guardedAction(() => handleDeleteVenue(v._id))} className="text-danger hover:text-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && stats && <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-6">
            {[['Customers',stats.overview.totalCustomers],['Pending approvals',stats.overview.pendingEvents],['Approved events',stats.overview.approvedEvents],['Rejected events',stats.overview.rejectedEvents],['Verified transactions',stats.financials.totalVerifiedTransactions]].map(([label,value]) => <div key={label} className="ev-card p-4 rounded-xl"><p>{label}</p><strong className="text-2xl">{value}</strong></div>)}
          </div><RecentBookings bookings={stats.recentTransactions} title="Recent verified transactions" /><CheckInHistory />
        </>}
        {['users','organizers'].includes(activeTab) && <div className="flex gap-3 my-4">
          <select aria-label="Filter role" className="ev-input p-2 rounded-lg" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option>{['customer','organizer','superadmin'].map((role) => <option key={role}>{role}</option>)}</select>
          <select aria-label="Filter account status" className="ev-input p-2 rounded-lg" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All account statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
          <button className="ev-btn-secondary p-2 rounded-lg" onClick={async () => {
            try { const { data } = await API.get('/admin/users', { params: { search: userSearch || undefined, role: roleFilter || undefined, status: statusFilter || undefined } }); setUsersList(data); }
            catch (failure) { setError(failure.response?.data?.message || 'Unable to search users.'); }
          }}>Search server</button>
        </div>}
        {!loading && ((activeTab === 'payments' && !transactions.length) || (activeTab === 'complaints' && !complaints.length) || (activeTab === 'events' && !eventsList.length) || (['users','organizers'].includes(activeTab) && !filteredUsers.length)) && <p className="my-6">No records found in this view.</p>}
        {/* TAB 6: PAYMENTS & REFUNDS */}
        {activeTab === 'payments' && (
          <div className="glass-panel border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs text-body">
              <thead className="bg-card uppercase text-[10px] font-bold text-body">
                <tr>
                  <th className="p-4">Booking Ref</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Event</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Refund Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-card">
                    <td className="p-4 font-mono font-bold text-accent">{tx.bookingId || tx._id.slice(-6)}</td>
                    <td className="p-4 text-heading">{tx.customer?.name || 'Customer'}</td>
                    <td className="p-4 text-body">{tx.eventId?.title || 'Event'}</td>
                    <td className="p-4 font-bold text-accent">USD {tx.totalAmount}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          tx.paymentStatus === 'paid'
                            ? 'bg-primary-soft text-accent'
                            : tx.paymentStatus === 'refunded'
                            ? 'bg-error-soft text-danger'
                            : 'bg-warning-soft text-warning'
                        }`}
                      >
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {tx.paymentStatus === 'paid' && tx.paymentVerifiedAt && tx.ticketStatus === 'VALID' && !tx.isCheckedIn && !tx.refundRequested && (
                        <button
                          disabled={actionBusy} onClick={() => guardedAction(() => handleProcessRefund(tx._id))}
                          className="px-2.5 py-1 bg-danger hover:bg-danger-hover text-on-danger rounded-lg font-bold cursor-pointer"
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

        {activeTab === 'events' && eventsList.filter((event) => event.status !== 'cancelled' && new Date(event.endDateTime) > new Date()).map((event) => <div key={event._id} className="flex gap-3 p-3"><span>{event.title}</span><button disabled={actionBusy} className="text-danger" onClick={async () => {
          const reason = window.prompt('Event suspension/cancellation reason:'); if (!reason || !window.confirm('Cancel this event and stop bookings?')) return;
          setActionBusy(true);
          try { await API.post('/admin/events/' + event._id + '/cancel', { reason }); await fetchTabData('events'); }
          catch (failure) { setError(failure.response?.data?.message || 'Unable to cancel event.'); }
          finally { setActionBusy(false); }
        }}>Suspend / cancel event</button></div>)}
        {/* TAB 7: COMPLAINTS */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            {complaints.map((c) => (
              <div key={c._id} className="glass-panel border border-border rounded-2xl p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-heading text-sm">{c.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === 'resolved' ? 'bg-primary-soft text-accent' : 'bg-error-soft text-danger'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-body leading-relaxed">{c.message}</p>
                  {c.response && <p className="text-xs text-accent mt-2">Response: {c.response}</p>}
                  <p className="text-[11px] text-subtle mt-2">
                    Submitted by {c.user?.name} ({c.user?.email}) on {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                {(
                  <button
                    disabled={actionBusy} onClick={() => guardedAction(() => handleResolveComplaint(c._id, c.status === 'resolved' ? 'open' : 'resolved'))}
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded-xl text-xs font-bold cursor-pointer"
                  >
                    {c.status === 'resolved' ? 'Reopen & respond' : 'Respond & resolve'}
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
