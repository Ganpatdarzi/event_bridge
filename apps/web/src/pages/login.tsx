import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { dashboardPath } from '../lib/roles.js';
import { Alert, buttonStyles, Field, inputClass } from '../components/ui.js';
import { Logo } from '../app/shell.js';

const demoAccounts = [
  { label: 'Society', email: 'society@eventbridge.test', password: 'Society123!' },
  { label: 'Vendor', email: 'vendor@eventbridge.test', password: 'Vendor123!' },
  { label: 'Admin', email: 'admin@eventbridge.test', password: 'Admin123!' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(dashboardPath(user.role), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-16">
      <div className="order-2 overflow-hidden rounded-3xl bg-slate-900 p-8 text-white sm:p-10 lg:order-1">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-bold">Event Bridge</span>
        </div>
        <h1 className="mt-10 text-3xl font-bold leading-tight">Welcome back to the marketplace</h1>
        <p className="mt-3 text-slate-300">
          Sign in to manage requests, respond to opportunities, or review vendor applications.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-slate-300">
          <Check>One request reaches every relevant vendor</Check>
          <Check>Compare structured quotations, not screenshots</Check>
          <Check>Role-based dashboards for societies, vendors and admins</Check>
        </ul>
      </div>

      <div className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:order-2">
        <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="Email" htmlFor="login-email">
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <button
            type="submit"
            className={`${buttonStyles('primary', 'md')} w-full`}
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Seeded demo accounts
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.label}
                type="button"
                className={buttonStyles('secondary', 'sm')}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError(null);
                }}
              >
                Use {account.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            These accounts only exist after running the seed script.
          </p>
        </div>
      </div>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        viewBox="0 0 20 20"
        className="mt-0.5 h-4 w-4 shrink-0 text-teal-400"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
          clipRule="evenodd"
        />
      </svg>
      {children}
    </li>
  );
}
