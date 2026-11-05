import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useTheme } from '../context/themeContext';
import {
  Calendar, LogOut, LayoutDashboard, Ticket,
  Menu, X, ShieldCheck, User, Shield, Sun, Moon
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    <nav className="sticky top-0 z-50 ev-navbar" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between gap-4">

        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Calendar className="w-5 h-5" style={{ color: 'var(--text-on-primary)' }} />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--text-heading)' }}>
              Event<span style={{ color: 'var(--accent-text)' }}>ra</span>
            </span>
            <span className="text-[9px] uppercase font-bold tracking-widest block -mt-0.5" style={{ color: 'var(--text-subtle)' }}>
              Live Ticketing
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center gap-7 text-sm font-medium" style={{ color: 'var(--text-body)' }}>
          <Link
            to="/"
            className="transition-colors duration-150 hover:text-accent font-medium"
            style={{ color: isActive('/') ? 'var(--accent-text)' : 'var(--text-body)', fontWeight: isActive('/') ? '600' : '500' }}
          >
            Explore Events
          </Link>
          <a href="#features" className="transition-colors duration-150 hover:text-accent" style={{ color: 'var(--text-body)' }}>
            Why Eventra
          </a>
          <a href="#organizers" className="transition-colors duration-150 hover:text-accent" style={{ color: 'var(--text-body)' }}>
            For Organizers
          </a>
          <a href="#faq" className="transition-colors duration-150 hover:text-accent" style={{ color: 'var(--text-body)' }}>
            FAQ
          </a>
        </div>

        {/* Right section */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-pressed={theme === 'light'}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
              : <Moon className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
            }
          </button>

          {user ? (
            <div
              className="flex items-center gap-2 rounded-xl py-1.5 px-2.5"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              {user.role === 'superadmin' && (
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin Panel
                </Link>
              )}

              {user.role === 'organizer' && (
                <Link
                  to="/organizer/dashboard"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              )}

              {user.role === 'customer' && (
                <Link
                  to="/my-tickets"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  My Tickets
                </Link>
              )}

              <div
                className="flex items-center gap-2 pl-2 pr-1 border-l"
                style={{ borderColor: 'var(--border)' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold leading-none" style={{ color: 'var(--text-heading)' }}>
                    {user.name}
                  </span>
                  <span className="text-[9px] font-mono capitalize leading-tight" style={{ color: 'var(--accent-text)' }}>
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-lg transition cursor-pointer"
                style={{ color: 'var(--text-subtle)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--error-bg)'; e.currentTarget.style.color = 'var(--error-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-subtle)'; }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm font-semibold px-3 py-2 rounded-lg transition"
                style={{ color: 'var(--text-body)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-heading)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-body)'}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="ev-btn-primary text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              >
                <ShieldCheck className="w-4 h-4" />
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-pressed={theme === 'light'}
            className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
              : <Moon className="w-4 h-4" style={{ color: 'var(--text-subtle)' }} />
            }
          </button>
          <button
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg cursor-pointer"
            style={{ color: 'var(--text-body)' }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden ev-animate-in px-4 pt-3 pb-6 space-y-2" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium border-b transition" style={{ color: 'var(--text-body)', borderColor: 'var(--border)' }}>
            Explore Events
          </Link>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium border-b transition" style={{ color: 'var(--text-body)', borderColor: 'var(--border)' }}>
            Why Eventra
          </a>
          <a href="#organizers" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium border-b transition" style={{ color: 'var(--text-body)', borderColor: 'var(--border)' }}>
            For Organizers
          </a>

          {user ? (
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 py-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'var(--primary-muted)', color: 'var(--accent-text)', border: '1px solid var(--primary-border)' }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{user.name}</div>
                  <div className="text-xs font-mono capitalize" style={{ color: 'var(--accent-text)' }}>{user.role}</div>
                </div>
              </div>

              {user.role === 'superadmin' && (
                <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                  <Shield className="w-4 h-4" /> Admin Control Panel
                </Link>
              )}
              {user.role === 'organizer' && (
                <Link to="/organizer/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                  <LayoutDashboard className="w-4 h-4" /> Organizer Dashboard
                </Link>
              )}
              {user.role === 'customer' && (
                <Link to="/my-tickets" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                  <Ticket className="w-4 h-4" /> My Tickets
                </Link>
              )}
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm mt-2 cursor-pointer" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}>
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          ) : (
            <div className="pt-3 grid grid-cols-2 gap-3">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-center py-2.5 rounded-xl font-medium text-sm ev-btn-secondary" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-body)', border: '1px solid var(--border)' }}>
                Sign In
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="text-center py-2.5 rounded-xl font-semibold text-sm" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
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
