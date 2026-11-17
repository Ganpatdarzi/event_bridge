import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Category, type Paginated, type VendorSummary } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import {
  Alert,
  buttonStyles,
  Card,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  Spinner,
} from '../components/ui.js';
import { VendorCard } from '../components/vendor-card.js';

interface Filters {
  search: string;
  city: string;
  category: string;
}

const emptyFilters: Filters = { search: '', city: '', category: '' };

export function VendorsPage() {
  const [form, setForm] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);

  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);

  const vendors = useApiQuery(() => {
    const query = new URLSearchParams();
    if (filters.search) query.set('search', filters.search);
    if (filters.city) query.set('city', filters.city);
    if (filters.category) query.set('category', filters.category);
    query.set('page', String(page));
    query.set('pageSize', '12');
    return api<Paginated<VendorSummary>>(`/vendors?${query.toString()}`, { auth: false });
  }, [filters.search, filters.city, filters.category, page]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(form);
  }

  function reset() {
    setForm(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  const pagination = vendors.data?.pagination;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Directory"
        title="Verified event vendors"
        description="Browse the businesses societies can request quotes from. Every listing is reviewed and approved by an administrator."
        actions={
          <Link to="/register" className={buttonStyles('primary', 'md')}>
            Join as a vendor
          </Link>
        }
      />

      <Card className="mt-8 p-4 sm:p-5">
        <form
          onSubmit={apply}
          className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"
        >
          <Field label="Search" htmlFor="vendor-search">
            <input
              id="vendor-search"
              className={inputClass}
              placeholder="Business name, city or keyword"
              value={form.search}
              onChange={(event) => setForm({ ...form, search: event.target.value })}
            />
          </Field>
          <Field label="City" htmlFor="vendor-city">
            <input
              id="vendor-city"
              className={inputClass}
              placeholder="e.g. Lahore"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </Field>
          <Field label="Category" htmlFor="vendor-category">
            <select
              id="vendor-category"
              className={inputClass}
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option value="">All categories</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <button type="submit" className={buttonStyles('primary', 'md')}>
              Apply
            </button>
            <button type="button" onClick={reset} className={buttonStyles('ghost', 'md')}>
              Reset
            </button>
          </div>
        </form>
      </Card>

      <div className="mt-8 flex items-center justify-between text-sm text-slate-500">
        <p>
          {vendors.loading
            ? 'Searching vendors…'
            : `${pagination?.total ?? 0} ${pagination?.total === 1 ? 'vendor' : 'vendors'} found`}
        </p>
        {pagination && pagination.totalPages > 1 && (
          <p>
            Page {pagination.page} of {pagination.totalPages}
          </p>
        )}
      </div>

      {vendors.error && (
        <div className="mt-4">
          <Alert tone="error">{vendors.error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.loading &&
          [0, 1, 2, 3, 4, 5].map((key) => (
            <div
              key={key}
              className="h-60 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
            />
          ))}

        {!vendors.loading &&
          vendors.data?.items.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)}
      </div>

      {!vendors.loading && !vendors.error && vendors.data?.items.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No vendors match those filters"
            description="Try a different city or category, or clear the filters to see the whole directory."
            action={
              <button type="button" onClick={reset} className={buttonStyles('secondary', 'sm')}>
                Clear filters
              </button>
            }
          />
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page <= 1 || vendors.loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            {vendors.loading && <Spinner className="h-3.5 w-3.5" />}
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page >= pagination.totalPages || vendors.loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
