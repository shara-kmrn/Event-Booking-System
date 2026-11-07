import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/authContext';
import { ThemeProvider } from './context/themeContext';
import Navbar from './component/navbar';
import ProtectedRoute from './component/protectedRoutes';
import OrganizerDashboard from './pages/organizerDashboard';
import AdminDashboard from './pages/adminDashboard';
import Home from './pages/home';
import Login from './pages/login';
import Register from './pages/register';
import Profile from './pages/profile';
import Complaints from './pages/complaints';
import { Link } from 'react-router-dom';
import MyTickets from './pages/myTickets';

function AccountLinks() {
  const { user } = useAuth();
  return user && <nav aria-label="Account" className="max-w-7xl w-full mx-auto px-6 py-2 flex gap-5 text-sm">
    <Link to="/profile">My profile</Link>
    {user.role === 'customer' && <><Link to="/my-tickets">My bookings</Link><Link to="/complaints">Support & complaints</Link></>}
  </nav>;
}
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-body)' }}>
            <Navbar />
            <AccountLinks />
            <main className="flex-1">
              <Routes>
                <Route path="/profile" element={<ProtectedRoute allowedRoles={['customer','organizer','superadmin']}><Profile /></ProtectedRoute>} />
                <Route path="/complaints" element={<ProtectedRoute allowedRoles={['customer']}><Complaints /></ProtectedRoute>} />
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Customer Only Route */}
                <Route
                  path="/my-tickets"
                  element={
                    <ProtectedRoute allowedRoles={['customer']}>
                      <MyTickets />
                    </ProtectedRoute>
                  }
                />

                {/* Organizer Only Route */}
                <Route
                  path="/organizer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['organizer']}>
                      <OrganizerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Superadmin Only Route */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['superadmin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;