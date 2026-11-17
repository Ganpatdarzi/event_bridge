import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { initials } from '../lib/format.js';
import { Badge, buttonStyles, cx } from '../components/ui.js';

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className ?? 'h-9 w-9'}
      role="img"
      aria-label="Event Bridge logo"
    >
      <rect width="40" height="40" rx="12" fill="#0f766e" />
      <path
        d="M8 26c0-6 5-11 12-11s12 5 12 11"
        fill="none"
        stroke="#99f6e4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M8 26h24" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="14" cy="26" r="2.2" fill="#ffffff" />
      <circle cx="26" cy="26" r="2.2" fill="#ffffff" />
    </svg>
  );
}

function dashboardPath(role: string | undefined): string {
  if (role === 'vendor') return '/vendor';
  if (role === 'admin') return '/admin';
  return '/society';
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-bold tracking-tight text-slate-900">Event Bridge</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/vendors" className={navLinkClass}>
              Discover vendors
            </NavLink>
            <a
              href="/#how-it-works"
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
            ) : user ? (
              <>
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
                <Link to="/login" className={buttonStyles('ghost', 'sm')}>
                  Log in
                </Link>
                <Link to="/register" className={buttonStyles('primary', 'sm')}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
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
