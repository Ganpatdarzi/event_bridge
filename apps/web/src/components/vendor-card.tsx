import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { VendorReview, VendorSummary } from '../lib/api.js';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { Badge, buttonStyles, Card } from './ui.js';

function Stars({ average, count }: { average: number | null; count: number }) {
  if (!count) return <span className="text-xs font-medium text-slate-400">New vendor</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
      <span aria-hidden="true">★</span>
      {average?.toFixed(1) ?? '—'}
      <span className="font-normal text-slate-400">({count})</span>
    </span>
  );
}

export function VendorCard({ vendor }: { vendor: VendorSummary }) {
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<VendorReview[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReviews() {
    if (reviews) {
      setShowReviews((value) => !value);
      return;
    }
    setLoading(true);
    try {
      const data = await api<VendorReview[]>(`/vendors/${vendor.id}/reviews`);
      setReviews(data);
      setShowReviews(true);
    } catch {
      setReviews([]);
      setShowReviews(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card as="article" className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-base font-bold text-brand">
          {vendor.businessName.slice(0, 1).toUpperCase()}
        </div>
        <Stars average={vendor.rating.average} count={vendor.rating.count} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900">{vendor.businessName}</h3>
      <p className="mt-0.5 text-sm text-slate-500">
        {vendor.city}
        {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ''}
      </p>

      <p className="mt-3 line-clamp-3 text-sm text-slate-600">{vendor.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {vendor.categories.slice(0, 3).map((category) => (
          <Badge key={category.id} tone="brand">
            {category.name}
          </Badge>
        ))}
        {vendor.categories.length > 3 && (
          <Badge tone="slate">+{vendor.categories.length - 3}</Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={buttonStyles('ghost', 'sm')}
          onClick={() => void loadReviews()}
          disabled={loading}
        >
          {loading ? 'Loading…' : showReviews ? 'Hide reviews' : 'Show reviews'}
        </button>
        <Link
          to={`/vendors/${vendor.id}`}
          className="text-xs font-semibold text-brand hover:underline"
        >
          View profile →
        </Link>
      </div>

      {showReviews && reviews && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {reviews.length === 0 && <p className="text-xs text-slate-500">No reviews yet.</p>}
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-amber-600">
                {'★'.repeat(review.rating)}
                <span className="ml-2 font-normal text-slate-500">{review.society.name}</span>
              </p>
              {review.comment && <p className="mt-1 text-xs text-slate-600">{review.comment}</p>}
              <p className="mt-1 text-xs text-slate-400">{formatDate(review.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
