import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type PublicVendorDetail,
  type VendorAvailability,
  type VendorReview,
} from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import {
  Alert,
  Badge,
  buttonStyles,
  Card,
  LoadingBlock,
  PageHeader,
  SectionHeading,
} from '../components/ui.js';
import { VendorHireOptions } from '../components/vendor-hire-options.js';

function toDateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function VendorProfilePage() {
  const { vendorId = '' } = useParams();
  const { user } = useAuth();

  const profile = useApiQuery(() => api<PublicVendorDetail>(`/vendors/${vendorId}`), [vendorId]);
  const reviews = useApiQuery(
    () => api<VendorReview[]>(`/vendors/${vendorId}/reviews`),
    [vendorId],
  );

  const [startsAt, setStartsAt] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [endsAt, setEndsAt] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 3 * 60 * 60 * 1000)),
  );
  const [availability, setAvailability] = useState<VendorAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkAvailability() {
    setChecking(true);
    setError(null);
    setAvailability(null);
    try {
      const from = new Date(startsAt);
      const to = new Date(endsAt);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        throw new Error('Choose a valid time window first');
      }
      const result = await api<VendorAvailability>(
        `/bookings/availability/${vendorId}?from=${encodeURIComponent(
          from.toISOString(),
        )}&to=${encodeURIComponent(to.toISOString())}`,
      );
      setAvailability(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to check availability');
    } finally {
      setChecking(false);
    }
  }

  if (profile.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <LoadingBlock label="Loading vendor profile" />
      </div>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Alert tone="error">{profile.error ?? 'Vendor profile unavailable'}</Alert>
        <Link to="/vendors" className="mt-4 inline-block text-sm font-semibold text-brand">
          ← Back to vendors
        </Link>
      </div>
    );
  }

  const vendor = profile.data;
  const reviewItems = reviews.data ?? [];
  const dashboardLink =
    user?.role === 'vendor'
      ? { to: '/vendor/requests', label: 'Go to my requests' }
      : user?.role === 'admin'
        ? { to: '/admin', label: 'Go to admin dashboard' }
        : { to: '/society/requests', label: 'Go to my requests' };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/vendors" className="text-sm font-semibold text-brand hover:underline">
        ← Back to vendors
      </Link>

      <PageHeader
        eyebrow="Vendor profile"
        title={vendor.businessName}
        description={`${vendor.city}${vendor.serviceArea ? ` · ${vendor.serviceArea}` : ''}`}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              {vendor.categories.map((category) => (
                <Badge key={category.id} tone="brand">
                  {category.name}
                </Badge>
              ))}
              <Badge tone={vendor.rating.count ? 'amber' : 'slate'}>
                {vendor.rating.count
                  ? `★ ${vendor.rating.average?.toFixed(1) ?? '—'} (${vendor.rating.count})`
                  : 'New vendor'}
              </Badge>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {vendor.description}
            </p>
          </Card>

          {user?.role === 'society' && (
            <VendorHireOptions vendorId={vendor.id} vendorName={vendor.businessName} />
          )}

          <section>
            <SectionHeading title="Portfolio" description="Recent work shared by this vendor" />
            {vendor.portfolio.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                This vendor has not added portfolio images yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {vendor.portfolio.map((image) => (
                  <figure
                    key={image.id}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img
                      src={image.dataUrl}
                      alt={image.caption ?? vendor.businessName}
                      className="h-48 w-full object-cover"
                    />
                    {image.caption && (
                      <figcaption className="bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading title="Reviews" description="From completed engagements only" />
            {reviews.loading ? (
              <LoadingBlock label="Loading reviews" />
            ) : reviewItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No reviews yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {reviewItems.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-amber-600">
                        {'★'.repeat(review.rating)}
                        <span className="ml-2 font-normal text-slate-600">
                          {review.society.name}
                        </span>
                      </p>
                      <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-sm text-slate-700">{review.comment}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                      {review.request.reference} · {review.request.title}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Check availability
            </h2>
            {user?.role === 'society' ? (
              <>
                <p className="mt-2 text-xs text-slate-600">
                  Pick a window to see whether this vendor is already hired for that time.
                </p>
                <label className="mt-4 block text-xs font-semibold text-slate-700">
                  From
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) => {
                      setStartsAt(event.target.value);
                      setAvailability(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                  />
                </label>
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  To
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(event) => {
                      setEndsAt(event.target.value);
                      setAvailability(null);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                  />
                </label>
                <button
                  type="button"
                  className={`${buttonStyles('primary', 'sm')} mt-4 w-full`}
                  disabled={checking}
                  onClick={() => void checkAvailability()}
                >
                  {checking ? 'Checking…' : 'Check availability'}
                </button>

                {availability && (
                  <div
                    className={`mt-4 rounded-lg px-3 py-2 text-xs ${
                      availability.available
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p className="font-semibold">
                      {availability.available ? 'Available for this window' : 'Already booked'}
                    </p>
                    {!availability.available &&
                      availability.busyWindows.map((window) => (
                        <p key={window.id} className="mt-1">
                          {formatDateTime(window.startsAt)} – {formatDateTime(window.endsAt)}
                        </p>
                      ))}
                  </div>
                )}
                {error && (
                  <div className="mt-4">
                    <Alert tone="error">{error}</Alert>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                Sign in as a society to check live hire availability and reserve this vendor.
              </p>
            )}
            <div className="mt-4 space-y-2">
              {user?.role === 'society' && (
                <Link
                  to="/society/create"
                  className={`${buttonStyles('primary', 'sm')} w-full text-center`}
                >
                  Create a request
                </Link>
              )}
              <Link
                to={dashboardLink.to}
                className={`${buttonStyles('secondary', 'sm')} w-full text-center`}
              >
                {dashboardLink.label}
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Contact</h2>
            {vendor.contactPerson && (
              <p className="mt-3 text-sm text-slate-700">{vendor.contactPerson}</p>
            )}
            {vendor.contactPhone && (
              <a href={`tel:${vendor.contactPhone}`} className="mt-1 block text-sm text-brand">
                {vendor.contactPhone}
              </a>
            )}
            {!vendor.contactPerson && !vendor.contactPhone && (
              <p className="mt-3 text-xs text-slate-500">
                Contact details are shared after selection.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
