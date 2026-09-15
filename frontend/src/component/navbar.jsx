import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { Calendar, LogOut, LayoutDashboard, Ticket, Sparkles, Menu, X, ShieldCheck, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 shadow-lg shadow-black/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center group-hover:bg-opacity-80 transition">
              <Calendar className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
              Event<span className="gradient-text">ra</span>
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 block -mt-1">
              Atomic Ticketing
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link
            to="/"
            className={`transition duration-200 hover:text-white flex items-center gap-1.5 ${
              isActive('/') ? 'text-indigo-400 font-semibold' : ''
            }`}
          >
            Explore Events
          </Link>
          <a href="#features" className="transition duration-200 hover:text-white">
            Why Eventra
          </a>
          <a href="#organizers" className="transition duration-200 hover:text-white">
            For Organizers
          </a>
          <a href="#faq" className="transition duration-200 hover:text-white">
            FAQ
          </a>
        </div>

        {/* User Auth Section */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-full py-1.5 px-3 shadow-inner">
              {user.role === 'organizer' && (
                <Link
                  to="/organizer/dashboard"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition shadow-sm"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              )}

              {user.role === 'customer' && (
                <Link
                  to="/my-tickets"
                  className="flex items-center gap-1.5 text-xs font-semibold bg-purple-600/90 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full transition shadow-sm"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  My Tickets
                </Link>
              )}

              <div className="flex items-center gap-2 pl-1 pr-2 border-l border-slate-800">
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">
                  {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200 leading-none">
                    {user.name}
                  </span>
                  <span className="text-[9px] text-indigo-400 font-mono capitalize leading-tight">
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-rose-400 transition rounded-full hover:bg-rose-500/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="relative inline-flex items-center justify-center p-0.5 overflow-hidden text-sm font-semibold rounded-xl group bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 group-hover:from-indigo-500 group-hover:to-pink-500 hover:text-white text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 active:scale-95"
              >
                <span className="relative px-4 py-2 transition-all ease-in duration-75 bg-slate-950/20 rounded-[10px] group-hover:bg-opacity-0 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-300" />
                  Get Started
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-200 hover:text-indigo-400 font-medium border-b border-slate-800/50"
          >
            Explore Events
          </Link>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-200 hover:text-indigo-400 font-medium border-b border-slate-800/50"
          >
            Why Eventra
          </a>
          <a
            href="#organizers"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-200 hover:text-indigo-400 font-medium border-b border-slate-800/50"
          >
            For Organizers
          </a>

          {user ? (
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 py-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-indigo-400">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-xs text-indigo-400 font-mono capitalize">{user.role}</div>
                </div>
              </div>

              {user.role === 'organizer' && (
                <Link
                  to="/organizer/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold text-sm"
                >
                  <LayoutDashboard className="w-4 h-4" /> Organizer Dashboard
                </Link>
              )}

              {user.role === 'customer' && (
                <Link
                  to="/my-tickets"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full bg-purple-600 text-white py-2 rounded-lg font-semibold text-sm"
                >
                  <Ticket className="w-4 h-4" /> My Tickets
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full bg-rose-500/10 text-rose-400 border border-rose-500/30 py-2 rounded-lg font-semibold text-sm mt-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          ) : (
            <div className="pt-3 grid grid-cols-2 gap-3">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 bg-slate-800 text-slate-200 rounded-lg font-medium text-sm"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;