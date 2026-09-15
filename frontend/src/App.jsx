import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/authContext';
import Navbar from './component/navbar';
import ProtectedRoute from './component/protectedRoutes';
import OrganizerDashboard from './pages/organizerDashboard';
import Home from './pages/home';
import Login from './pages/login';
import Register from './pages/register';
import MyTickets from './pages/myTickets';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
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
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;