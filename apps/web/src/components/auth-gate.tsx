import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { buttonStyles, Card, Spinner } from './ui.js';

const dashboardForRole: Record<string, string> = {
  society: '/society',
  vendor: '/vendor',
  admin: '/admin',
};

export function AuthGate({ role, children }: { role: string; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-20 text-sm text-slate-500 sm:px-6">
        <Spinner className="h-5 w-5 text-brand" />
        Restoring your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-600">
            This dashboard is only available to signed-in {role} accounts.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/login" className={buttonStyles('primary', 'md')}>
              Sign in
            </Link>
            <Link to="/register" className={buttonStyles('secondary', 'md')}>
              Create account
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (user.role !== role) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">Wrong dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            You are signed in as a <span className="font-semibold">{user.role}</span> account.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to={dashboardForRole[user.role] ?? '/'} className={buttonStyles('primary', 'md')}>
              Go to your dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
