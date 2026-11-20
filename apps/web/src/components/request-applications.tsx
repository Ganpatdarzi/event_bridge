import { useState } from 'react';
import { api, type QuotationComparison, type RequestQuotationsPage } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatDateTime, formatMoney, humanize } from '../lib/format.js';
import { Alert, Badge, buttonStyles, StatusBadge } from './ui.js';

export function RequestApplications({
  requestId,
  canSelect = false,
  onSelect,
}: {
  requestId: string;
  canSelect?: boolean;
  onSelect?: () => void;
}) {
  const quotations = useApiQuery(
    () => api<RequestQuotationsPage>(`/requests/${requestId}/quotations?pageSize=50`),
    [requestId],
  );
  const comparison = useApiQuery(
    () => api<QuotationComparison>(`/requests/${requestId}/compare`),
    [requestId],
  );

  const items = quotations.data?.items ?? [];
  const comparisonItems = comparison.data?.items ?? [];
  const [compare, setCompare] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function select(quotationId: string) {
    setSelecting(quotationId);
    setNotice(null);
    try {
      await api(`/requests/${requestId}/quotations/${quotationId}/select`, { method: 'POST' });
      setNotice('Vendor selected. The request is now marked as selected.');
      quotations.reload();
      comparison.reload();
      onSelect?.();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Unable to select this vendor');
    } finally {
      setSelecting(null);
    }
  }

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

      {notice && (
        <div className="mt-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      {comparisonItems.length > 1 && (
        <div className="mt-3">
          <button
            type="button"
            className={buttonStyles('ghost', 'sm')}
            onClick={() => setCompare((value) => !value)}
          >
            {compare ? 'Hide comparison' : 'Compare side by side'}
          </button>
          {compare && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-right">Base</th>
                    <th className="px-3 py-2 text-right">Extras</th>
                    <th className="px-3 py-2 text-right">With extras</th>
                    <th className="px-3 py-2 text-left">Available</th>
                    <th className="px-3 py-2 text-left">Valid until</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonItems.map((quote) => (
                    <tr key={quote.quotationId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {quote.vendor.businessName}
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(quote.totalPrice)}</td>
                      <td className="px-3 py-2 text-right">
                        {quote.additionalCharges === null
                          ? '—'
                          : formatMoney(quote.additionalCharges)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatMoney(quote.totalWithExtras)}
                      </td>
                      <td className="px-3 py-2">
                        {quote.availableOnDate === null
                          ? '—'
                          : quote.availableOnDate
                            ? 'Yes'
                            : 'No'}
                      </td>
                      <td className="px-3 py-2">
                        {quote.validUntil ? formatDate(quote.validUntil) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={quote.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {comparison.data?.summary && (
                  <tfoot className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <td className="px-3 py-2 font-semibold" colSpan={3}>
                        {comparison.data.summary.count} comparable quotations
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {comparison.data.summary.lowestTotal === null
                          ? '—'
                          : `${formatMoney(comparison.data.summary.lowestTotal)} – ${formatMoney(
                              comparison.data.summary.highestTotal ?? 0,
                            )}`}
                      </td>
                      <td className="px-3 py-2" colSpan={3}>
                        Average {formatMoney(comparison.data.summary.averageTotal ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {comparison.error && (
        <div className="mt-3">
          <Alert tone="error">Comparison unavailable: {comparison.error}</Alert>
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
                  {canSelect &&
                    !['selected', 'not_selected', 'withdrawn'].includes(quote.status) && (
                      <button
                        type="button"
                        className={buttonStyles('primary', 'sm')}
                        disabled={selecting !== null}
                        onClick={() => void select(quote.id)}
                      >
                        {selecting === quote.id ? 'Selecting…' : 'Select this vendor'}
                      </button>
                    )}
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
                  className="min-w-0 break-all font-medium text-brand hover:underline"
                >
                  {quote.vendor.contactEmail}
                </a>
                {quote.vendor.contactPerson && <span>{quote.vendor.contactPerson}</span>}
                {quote.vendor.contactPhone && (
                  <a
                    href={`tel:${quote.vendor.contactPhone}`}
                    className="min-w-0 break-all font-medium text-brand hover:underline"
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
