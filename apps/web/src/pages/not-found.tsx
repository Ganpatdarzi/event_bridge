import { Link } from 'react-router-dom';
import { buttonStyles, Card } from '../components/ui.js';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 sm:px-6">
      <Card className="p-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/" className={buttonStyles('primary', 'md')}>
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
}
