import type { VendorSummary } from '../lib/api.js';
import { Badge, Card } from './ui.js';

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

      <div className="mt-auto flex items-center gap-2 pt-5 text-xs font-semibold text-emerald-700">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
            clipRule="evenodd"
          />
        </svg>
        Verified vendor
      </div>
    </Card>
  );
}
