import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { Calendar, LogOut, LayoutDashboard, Ticket } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-indigo-400">
          <Calendar className="w-6 h-6" />
          <span>EventHub</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {user.role === 'organizer' && (
                <Link
                  to="/organizer/dashboard"
                  className="flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              )}

              {user.role === 'customer' && (
                <Link
                  to="/my-tickets"
                  className="flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
                >
                  <Ticket className="w-4 h-4" />
                  My Tickets
                </Link>
              )}

              <span className="text-sm text-slate-400">
                {user.name} <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded uppercase">{user.role}</span>
              </span>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 ml-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-slate-300 hover:text-white">
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;