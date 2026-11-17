import { api, type RequestQuotationsPage } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatDateTime, formatMoney, humanize } from '../lib/format.js';
import { Alert, Badge, LoadingBlock, StatusBadge } from './ui.js';

export function RequestApplications({ requestId }: { requestId: string }) {
  const quotations = useApiQuery(
    () => api<RequestQuotationsPage>(`/requests/${requestId}/quotations?pageSize=50`),
    [requestId],
  );

  const items = quotations.data?.items ?? [];

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Vendor applications
        </p>
        {quotations.data && (
          <p className="text-xs text-slate-500">
            {items.length} {items.length === 1 ? 'quotation' : 'quotations'} received
          </p>
        )}
      </div>

      {quotations.loading && (
        <div className="mt-3">
          <LoadingBlock label="Loading applications…" />
        </div>
      )}

      {quotations.error && (
        <div className="mt-3">
          <Alert tone="error">{quotations.error}</Alert>
        </div>
      )}

      {!quotations.loading && !quotations.error && items.length === 0 && (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No applications yet. Invited vendors appear here as soon as they submit a quotation.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {items.map((quote) => {
          const extras = quote.additionalCharges;
          const totalWithExtras = quote.totalPrice + (extras ?? 0);

          return (
            <article
              key={quote.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{quote.vendor.businessName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {quote.vendor.city}
                    {quote.vendor.serviceArea ? ` · ${quote.vendor.serviceArea}` : ''} ·{' '}
                    {quote.reference}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">
                    {formatMoney(quote.totalPrice)}
                  </p>
                  {extras !== null && extras > 0 && (
                    <p className="text-xs text-slate-500">
                      + {formatMoney(extras)} extras · {formatMoney(totalWithExtras)} total
                    </p>
                  )}
                  <div className="mt-1 flex justify-end">
                    <StatusBadge status={quote.status} />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-700">{quote.description}</p>

              {(quote.inclusions || quote.exclusions) && (
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {quote.inclusions && (
                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <dt className="font-semibold text-slate-700">Included</dt>
                      <dd className="mt-1 whitespace-pre-line text-slate-600">
                        {quote.inclusions}
                      </dd>
                    </div>
                  )}
                  {quote.exclusions && (
                    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <dt className="font-semibold text-slate-700">Not included</dt>
                      <dd className="mt-1 whitespace-pre-line text-slate-600">
                        {quote.exclusions}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {quote.notes && (
                <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                  <span className="font-semibold text-slate-700">Note:</span> {quote.notes}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Submitted {formatDateTime(quote.submittedAt)}</span>
                {quote.availableOnDate !== null && (
                  <Badge tone={quote.availableOnDate ? 'emerald' : 'amber'}>
                    {quote.availableOnDate
                      ? 'Available on event date'
                      : 'Not available on event date'}
                  </Badge>
                )}
                {quote.validUntil && <span>Valid until {formatDate(quote.validUntil)}</span>}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Contact:</span>
                <a
                  href={`mailto:${quote.vendor.contactEmail}`}
                  className="font-medium text-brand hover:underline"
                >
                  {quote.vendor.contactEmail}
                </a>
                {quote.vendor.contactPerson && <span>{quote.vendor.contactPerson}</span>}
                {quote.vendor.contactPhone && (
                  <a
                    href={`tel:${quote.vendor.contactPhone}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {quote.vendor.contactPhone}
                  </a>
                )}
                <span className="text-slate-400">· {humanize(quote.status)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
