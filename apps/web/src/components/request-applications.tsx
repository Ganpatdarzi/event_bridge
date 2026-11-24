import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type BookingDetail,
  type BookingSummary,
  type QuotationComparison,
  type RequestQuotationsPage,
  type VendorAvailability,
} from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatDateTime, formatMoney, humanize } from '../lib/format.js';
import { Alert, Badge, buttonStyles, StatusBadge } from './ui.js';

function toDateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export interface HireTarget {
  quotationId: string;
  vendorId: string;
  vendorName: string;
}

export function HirePanel({
  target,
  booking,
  onBooked,
}: {
  target: HireTarget;
  booking: BookingSummary | null | undefined;
  onBooked?: () => void;
}) {
  const [startsAt, setStartsAt] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [endsAt, setEndsAt] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 3 * 60 * 60 * 1000)),
  );
  const [notes, setNotes] = useState('');
  const [availability, setAvailability] = useState<VendorAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeBooking = booking && booking.status !== 'cancelled' ? booking : null;

  async function checkAvailability() {
    setBusy(true);
    setError(null);
    setAvailability(null);
    try {
      const from = new Date(startsAt);
      const to = new Date(endsAt);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
        throw new Error('Choose a valid hire window first');
      }
      const result = await api<VendorAvailability>(
        `/bookings/availability/${target.vendorId}?from=${encodeURIComponent(
          from.toISOString(),
        )}&to=${encodeURIComponent(to.toISOString())}`,
      );
      setAvailability(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to check availability');
    } finally {
      setBusy(false);
    }
  }

  async function hire() {
    setBusy(true);
    setError(null);
    try {
      await api<BookingDetail>('/bookings', {
        method: 'POST',
        body: {
          quotationId: target.quotationId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });
      setAvailability(null);
      onBooked?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to hire this vendor');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!activeBooking) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${activeBooking.id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled by society' },
      });
      onBooked?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel this hire');
    } finally {
      setBusy(false);
    }
  }

  if (activeBooking) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Vendor hired
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">
              {formatDateTime(activeBooking.startsAt)} – {formatDateTime(activeBooking.endsAt)}
            </p>
            <p className="mt-0.5 text-xs text-emerald-800">
              {formatMoney(activeBooking.amount)} {activeBooking.currency} ·{' '}
              {humanize(activeBooking.status)}
            </p>
          </div>
          {activeBooking.status === 'confirmed' && (
            <button
              type="button"
              className={buttonStyles('secondary', 'sm')}
              disabled={busy}
              onClick={() => void cancel()}
            >
              {busy ? 'Updating…' : 'Cancel hire'}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-emerald-800">
          This time is reserved exclusively for your society. Mark the request as completed when the
          work is done.
        </p>
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-brand">Hire this vendor</p>
      <p className="mt-1 text-xs text-slate-600">
        Reserve {target.vendorName} for a specific window. Other societies cannot hire them while
        this hire is active.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">
          Start
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
              setAvailability(null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          End
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => {
              setEndsAt(event.target.value);
              setAvailability(null);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-semibold text-slate-700">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Delivery details, venue access, timing notes…"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonStyles('secondary', 'sm')}
          disabled={busy}
          onClick={() => void checkAvailability()}
        >
          {busy ? 'Checking…' : 'Check availability'}
        </button>
        <button
          type="button"
          className={buttonStyles('primary', 'sm')}
          disabled={busy || availability?.available === false}
          onClick={() => void hire()}
        >
          {busy ? 'Confirming…' : 'Confirm hire'}
        </button>
      </div>

      {availability && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            availability.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {availability.available ? (
            <p className="font-semibold">Available for this window.</p>
          ) : (
            <p className="font-semibold">
              Already booked for this window. Try another time.
              {availability.busyWindows.length > 0 && (
                <>
                  {' '}
                  Busy:{' '}
                  {availability.busyWindows
                    .map(
                      (window) =>
                        `${formatDateTime(window.startsAt)} – ${formatDateTime(window.endsAt)}`,
                    )
                    .join(', ')}
                </>
              )}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}

export function RequestApplications({
  requestId,
  canSelect = false,
  canBook = false,
  booking,
  onSelect,
  onBooked,
}: {
  requestId: string;
  canSelect?: boolean;
  canBook?: boolean;
  booking?: BookingSummary | null;
  onSelect?: () => void;
  onBooked?: () => void;
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

              {quote.status === 'selected' && (canBook || booking) && (
                <HirePanel
                  target={{
                    quotationId: quote.id,
                    vendorId: quote.vendor.id,
                    vendorName: quote.vendor.businessName,
                  }}
                  booking={booking}
                  onBooked={onBooked}
                />
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
                <Link
                  to={`/vendors/${quote.vendor.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  View profile
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
