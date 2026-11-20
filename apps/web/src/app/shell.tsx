import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.js';
import { initials } from '../lib/format.js';
import { dashboardPath } from '../lib/roles.js';
import { Badge, buttonStyles, cx } from '../components/ui.js';
import { NotificationBell } from '../components/notification-bell.js';

export function Logo({ className }: { className?: string }) {
  return (
    <img src="/logo.png" alt="Event Bridge logo" className={className ?? 'h-9 w-9'} role="img" />
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'block rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: NavItem[] = user
    ? [
        { to: dashboardPath(user.role), label: 'Dashboard', end: true },
        ...(user.role === 'vendor'
          ? [
              { to: '/vendor/profile', label: 'Profile' },
              { to: '/vendor/requests', label: 'Requests' },
              { to: '/vendor/quotations', label: 'Quotations' },
              { to: '/vendor/reviews', label: 'Reviews' },
              { to: '/vendor/settings', label: 'Settings' },
            ]
          : []),
        { to: '/vendors', label: 'Vendors' },
      ]
    : [
        { to: '/', label: 'Home', end: true },
        { to: '/about', label: 'About' },
        { to: '/how-it-works', label: 'How it works' },
        { to: '/categories', label: 'Categories' },
        { to: '/vendors', label: 'Vendors' },
        { to: '/contact', label: 'Contact' },
      ];

  useEffect(() => {
    setMobileNavOpen(false);
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, location.hash]);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <Logo className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="hidden truncate text-base font-bold tracking-tight text-slate-900 sm:inline sm:text-lg">
              Event Bridge
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                {mobileNavOpen ? (
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>

            {loading ? (
              <div className="h-9 w-16 animate-pulse rounded-full bg-slate-100 sm:w-24" />
            ) : user ? (
              <>
                <NotificationBell />
                <Link
                  to={dashboardPath(user.role)}
                  className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50 sm:flex"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {initials(user.name)}
                  </span>
                  <span className="pr-1 text-sm font-medium text-slate-700">
                    {user.name.split(' ')[0]}
                  </span>
                  <Badge tone="slate" className="capitalize">
                    {user.role}
                  </Badge>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={buttonStyles('ghost', 'sm')}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <span className="hidden sm:inline-flex">
                  <Link to="/login" className={buttonStyles('ghost', 'sm')}>
                    Log in
                  </Link>
                </span>
                <Link to="/register" className={buttonStyles('primary', 'sm')}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>

        {mobileNavOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-slate-200 bg-white md:hidden"
          >
            <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={mobileNavLinkClass}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
              {!user && (
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 sm:hidden">
                  <Link
                    to="/login"
                    onClick={() => setMobileNavOpen(false)}
                    className={`${buttonStyles('secondary', 'sm')} flex-1`}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileNavOpen(false)}
                    className={`${buttonStyles('primary', 'sm')} flex-1`}
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-base font-bold text-slate-900">Event Bridge</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              One request. Multiple quotes. One place to compare. Built for university societies and
              the vendors who serve them.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Marketplace</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/vendors" className="text-slate-600 hover:text-brand">
                  Vendor directory
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-slate-600 hover:text-brand">
                  Become a vendor
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-slate-600 hover:text-brand">
                  Register a society
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Account</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/login" className="text-slate-600 hover:text-brand">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/society" className="text-slate-600 hover:text-brand">
                  Society dashboard
                </Link>
              </li>
              <li>
                <Link to="/admin" className="text-slate-600 hover:text-brand">
                  Admin dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>Event Bridge — academic project. Not licensed for commercial use.</p>
            <p>Built with React, Express and PostgreSQL.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
