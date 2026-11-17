import { Link } from 'react-router-dom';
import { api, type Category } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { buttonStyles, Card, LoadingBlock, PageHeader } from '../components/ui.js';

export function CategoriesPage() {
  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Service categories"
        title="Everything an event needs"
        description="Requests are routed to vendors by category, so the right businesses see the right opportunities."
        actions={
          <Link to="/vendors" className={buttonStyles('secondary', 'sm')}>
            Browse all vendors
          </Link>
        }
      />

      {categories.loading && (
        <div className="mt-8">
          <LoadingBlock label="Loading categories…" />
        </div>
      )}

      {categories.error && (
        <div className="mt-8">
          <Card className="p-6 text-sm text-rose-600">{categories.error}</Card>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(categories.data ?? []).map((category) => (
          <Card key={category.id} className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
              {category.name.slice(0, 1)}
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">{category.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{category.slug}</p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">
              {category.description ?? 'Verified vendors in this category.'}
            </p>
            <div className="mt-4">
              <Link
                to={`/vendors?category=${encodeURIComponent(category.slug)}`}
                className={buttonStyles('ghost', 'sm')}
              >
                View vendors →
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {!categories.loading && (categories.data ?? []).length === 0 && (
        <Card className="mt-8 p-6 text-sm text-slate-500">No categories available yet.</Card>
      )}
    </div>
  );
}
