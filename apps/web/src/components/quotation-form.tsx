import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, type Quotation, type VendorRequestListItem } from '../lib/api.js';
import { formatBudget, formatDate, formatDateTime } from '../lib/format.js';
import { useApiQuery } from '../lib/use-api.js';
import { Alert, Badge, buttonStyles, Card, Field, inputClass, LoadingBlock } from './ui.js';

interface QuotationFormState {
  totalPrice: string;
  description: string;
  inclusions: string;
  exclusions: string;
  additionalCharges: string;
  availableOnDate: boolean;
  validUntil: string;
  notes: string;
}

const emptyForm: QuotationFormState = {
  totalPrice: '',
  description: '',
  inclusions: '',
  exclusions: '',
  additionalCharges: '',
  availableOnDate: true,
  validUntil: '',
  notes: '',
};

export function QuotationForm({
  request,
  hasQuoted,
  onClose,
  onSaved,
}: {
  request: VendorRequestListItem;
  hasQuoted: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const requestId = request.id;
  const requestTitle = request.title;
  const existing = useApiQuery(
    () => api<Quotation | null>(`/requests/${requestId}/quotations/mine`),
    [requestId],
  );

  const [form, setForm] = useState<QuotationFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const quote = existing.data;
    if (!quote) return;

    setForm({
      totalPrice: String(quote.totalPrice),
      description: quote.description,
      inclusions: quote.inclusions ?? '',
      exclusions: quote.exclusions ?? '',
      additionalCharges: quote.additionalCharges === null ? '' : String(quote.additionalCharges),
      availableOnDate: quote.availableOnDate ?? true,
      validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : '',
      notes: quote.notes ?? '',
    });
  }, [existing.data]);

  const editing = Boolean(existing.data) || hasQuoted;

  function update<K extends keyof QuotationFormState>(key: K, value: QuotationFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const totalPrice = Number(form.totalPrice);
    if (!form.totalPrice.trim() || !Number.isFinite(totalPrice) || totalPrice < 0) {
      setError('Enter a valid total price.');
      return;
    }

    if (form.description.trim().length < 10) {
      setError('Describe what your quotation covers in at least 10 characters.');
      return;
    }

    setSaving(true);
    try {
      await api(`/requests/${requestId}/quotations`, {
        method: 'POST',
        body: {
          totalPrice,
          description: form.description.trim(),
          inclusions: form.inclusions.trim() || null,
          exclusions: form.exclusions.trim() || null,
          additionalCharges: form.additionalCharges.trim() ? Number(form.additionalCharges) : null,
          availableOnDate: form.availableOnDate,
          validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
          notes: form.notes.trim() || null,
        },
      });

      setSuccess(true);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your quotation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
            {editing ? 'Update quotation' : 'New quotation'}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {editing ? 'Revise your application' : 'Apply with a quotation'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            For “{requestTitle}”. The society sees your price, inclusions and contact details, and
            receives a notification as soon as you submit.
          </p>
        </div>
        <button type="button" className={buttonStyles('ghost', 'sm')} onClick={onClose}>
          Close
        </button>
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Society’s request brief — read this before pricing
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">{request.category.name}</Badge>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {request.reference}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {request.event?.name ?? request.title}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <BriefDetail label="Event date" value={formatDate(request.event?.eventDate ?? null)} />
            <BriefDetail label="Location" value={request.event?.location || 'Not specified'} />
            <BriefDetail
              label="Expected attendance"
              value={
                request.event?.expectedAttendance
                  ? request.event.expectedAttendance.toLocaleString()
                  : 'Not specified'
              }
            />
            <BriefDetail
              label="Quantity needed"
              value={request.quantity ? request.quantity.toLocaleString() : 'Not specified'}
            />
            <BriefDetail
              label="Budget"
              value={formatBudget(request.budgetMin, request.budgetMax)}
            />
            <BriefDetail
              label="Respond by"
              value={request.responseDeadline ? formatDateTime(request.responseDeadline) : '—'}
            />
          </dl>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              What the society asked for
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{request.description}</p>
          </div>
          <p className="text-xs text-slate-500">
            Submitted by {request.society.name} · {request.society.institution}
          </p>
        </div>
      </details>

      {existing.loading ? (
        <div className="mt-5">
          <LoadingBlock label="Loading your quotation…" />
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {existing.error && <Alert tone="error">{existing.error}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          {success && (
            <Alert tone="success">
              Quotation saved. The society has been notified and can review your application.
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total price (PKR)" htmlFor={`quote-price-${requestId}`}>
              <input
                id={`quote-price-${requestId}`}
                type="number"
                min={0}
                step="0.01"
                required
                className={inputClass}
                value={form.totalPrice}
                onChange={(event) => update('totalPrice', event.target.value)}
                placeholder="87500"
              />
            </Field>
            <Field
              label="Additional charges (PKR)"
              htmlFor={`quote-extra-${requestId}`}
              hint="Optional. Transport, setup or other extras."
            >
              <input
                id={`quote-extra-${requestId}`}
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.additionalCharges}
                onChange={(event) => update('additionalCharges', event.target.value)}
                placeholder="2500"
              />
            </Field>
          </div>

          <Field
            label="What your quotation covers"
            htmlFor={`quote-description-${requestId}`}
            hint="At least 10 characters. Be specific about the service and quantity."
          >
            <textarea
              id={`quote-description-${requestId}`}
              rows={3}
              required
              className={inputClass}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Dinner buffet for 250 guests with service staff, crockery and soft drinks."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Inclusions"
              htmlFor={`quote-inclusions-${requestId}`}
              hint="Optional. List what is included."
            >
              <textarea
                id={`quote-inclusions-${requestId}`}
                rows={3}
                className={inputClass}
                value={form.inclusions}
                onChange={(event) => update('inclusions', event.target.value)}
                placeholder="Main course, dessert, serving staff"
              />
            </Field>
            <Field
              label="Exclusions"
              htmlFor={`quote-exclusions-${requestId}`}
              hint="Optional. List anything not covered."
            >
              <textarea
                id={`quote-exclusions-${requestId}`}
                rows={3}
                className={inputClass}
                value={form.exclusions}
                onChange={(event) => update('exclusions', event.target.value)}
                placeholder="Live cooking stations, decorations"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quotation valid until"
              htmlFor={`quote-valid-${requestId}`}
              hint="Optional. Leave blank if the price has no expiry."
            >
              <input
                id={`quote-valid-${requestId}`}
                type="date"
                className={inputClass}
                value={form.validUntil}
                onChange={(event) => update('validUntil', event.target.value)}
              />
            </Field>

            <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                checked={form.availableOnDate}
                onChange={(event) => update('availableOnDate', event.target.checked)}
              />
              Available on the event date
            </label>
          </div>

          <Field
            label="Notes for the society"
            htmlFor={`quote-notes-${requestId}`}
            hint="Optional. Add setup times or anything the society should know."
          >
            <textarea
              id={`quote-notes-${requestId}`}
              rows={2}
              className={inputClass}
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              placeholder="Setup can start two hours before the event."
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" className={buttonStyles('ghost', 'md')} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={buttonStyles('primary', 'md')} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update quotation' : 'Submit quotation'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function BriefDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  );
}
