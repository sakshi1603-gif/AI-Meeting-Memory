import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close the user menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // AuthUser shape isn't confirmed — fall back safely either way
  const displayName =
    (user as { name?: string; email?: string } | null)?.name ??
    (user as { name?: string; email?: string } | null)?.email ??
    'Account';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-logo">
          AI Meeting Memory
        </NavLink>

        <nav className="navbar-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}
          >
            Meetings
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) => `navbar-link${isActive ? ' navbar-link-active' : ''}`}
          >
            Search
          </NavLink>
        </nav>

        <div className="navbar-right">
          <NavLink to="/record" className="btn btn-primary navbar-record-btn">
            <span className="navbar-record-dot" />
            Record
          </NavLink>

          <div className="navbar-user" ref={menuRef}>
            <button
              className="navbar-avatar"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {initial}
            </button>

            {menuOpen && (
              <div className="navbar-menu">
                <div className="navbar-menu-name">{displayName}</div>
                <button className="navbar-menu-item" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
