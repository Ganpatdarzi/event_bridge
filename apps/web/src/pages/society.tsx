import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Category, type Paginated, type RequestListItem } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatBudget, formatDate, formatDateTime } from '../lib/format.js';
import {
  Alert,
  buttonStyles,
  Card,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  SectionHeading,
  Stat,
  StatusBadge,
} from '../components/ui.js';
import { AuthGate } from '../components/auth-gate.js';
import { RequestApplications } from '../components/request-applications.js';

export function SocietyPage() {
  return (
    <AuthGate role="society">
      <SocietyDashboard />
    </AuthGate>
  );
}

function SocietyDashboard() {
  const { user, profile } = useAuth();
  const requests = useApiQuery(() => api<Paginated<RequestListItem>>('/requests?pageSize=50'), []);
  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);
  const [showForm, setShowForm] = useState(false);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  const items = requests.data?.items ?? [];
  const active = items.filter((request) =>
    ['submitted', 'open', 'partially_quoted'].includes(request.status),
  ).length;
  const quoted = items.filter((request) => request.quotationCount > 0).length;
  const drafts = items.filter((request) => request.status === 'draft').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Society dashboard"
        title={`Welcome back, ${user?.name.split(' ')[0] ?? 'there'}`}
        description={`${profile?.name ?? 'Your society'} — publish one request and collect quotes from verified vendors.`}
        actions={
          <button
            type="button"
            className={buttonStyles('primary', 'md')}
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Close form' : 'New request'}
          </button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total requests"
          value={requests.loading ? '—' : items.length}
          hint="All time"
        />
        <Stat label="Active" value={requests.loading ? '—' : active} hint="Awaiting quotes" />
        <Stat
          label="Quoted"
          value={requests.loading ? '—' : quoted}
          hint="Have at least one quote"
        />
        <Stat label="Drafts" value={requests.loading ? '—' : drafts} hint="Not published yet" />
      </div>

      {showForm && (
        <div className="mt-8">
          <CreateRequestForm
            categories={categories.data ?? []}
            onCreated={() => {
              setShowForm(false);
              requests.reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <section className="mt-10">
        <SectionHeading
          title="Your requests"
          description="Each request is distributed to matching verified vendors. Expand a request to review the applications it received."
          actions={
            <Link to="/vendors" className={buttonStyles('ghost', 'sm')}>
              Browse vendors
            </Link>
          }
        />

        {requests.error && <Alert tone="error">{requests.error}</Alert>}

        {requests.loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
              />
            ))}
          </div>
        )}

        {!requests.loading && !requests.error && items.length === 0 && (
          <EmptyState
            title="No requests yet"
            description="Create your first request and we will route it to vendors in the category you choose."
            action={
              <button
                type="button"
                className={buttonStyles('primary', 'md')}
                onClick={() => setShowForm(true)}
              >
                Create request
              </button>
            }
          />
        )}

        <div className="space-y-3">
          {items.map((request) => (
            <Card key={request.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={request.status} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {request.reference}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-base font-semibold text-slate-900">
                    {request.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {request.category.name}
                    {request.event?.name ? ` · ${request.event.name}` : ''}
                    {request.event?.eventDate ? ` · ${formatDate(request.event.eventDate)}` : ''}
                  </p>
                  {request.event?.location && (
                    <p className="mt-0.5 text-xs text-slate-400">{request.event.location}</p>
                  )}
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatBudget(request.budgetMin, request.budgetMax)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.quotationCount} quotes · {request.invitationCount} invited
                  </p>
                  {request.responseDeadline && (
                    <p className="mt-1 text-xs text-slate-400">
                      Closes {formatDateTime(request.responseDeadline)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">
                  {request.quotationCount === 0
                    ? 'No applications yet'
                    : `${request.quotationCount} vendor ${
                        request.quotationCount === 1 ? 'application' : 'applications'
                      } received`}
                </p>
                {request.quotationCount > 0 && (
                  <button
                    type="button"
                    className={buttonStyles('secondary', 'sm')}
                    onClick={() =>
                      setOpenRequestId((current) => (current === request.id ? null : request.id))
                    }
                  >
                    {openRequestId === request.id ? 'Hide applications' : 'Review applications'}
                  </button>
                )}
              </div>

              {openRequestId === request.id && <RequestApplications requestId={request.id} />}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function CreateRequestForm({
  categories,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [attendance, setAttendance] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [quantity, setQuantity] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  async function save(submit: boolean) {
    setError(null);

    if (!categoryId) {
      setError('Choose a service category.');
      return;
    }

    setSaving(submit ? 'publish' : 'draft');
    try {
      await api('/requests', {
        method: 'POST',
        body: {
          event: {
            name: eventName.trim(),
            eventDate,
            location: location.trim(),
            ...(attendance.trim() ? { expectedAttendance: Number(attendance) } : {}),
          },
          categoryId,
          title: title.trim(),
          description: description.trim(),
          budgetMin: toNumberOrNull(budgetMin),
          budgetMax: toNumberOrNull(budgetMax),
          ...(quantity.trim() ? { quantity: Number(quantity) } : {}),
          responseDeadline: deadline ? new Date(deadline).toISOString() : null,
          submit,
        },
      });

      setTitle('');
      setCategoryId('');
      setEventName('');
      setEventDate('');
      setLocation('');
      setAttendance('');
      setBudgetMin('');
      setBudgetMax('');
      setQuantity('');
      setDeadline('');
      setDescription('');
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the request');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="p-6">
      <SectionHeading
        title="New service request"
        description="Provide the event details once. Vendors in the selected category will receive it."
      />

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
      >
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Request title" htmlFor="request-title" hint="At least 5 characters.">
            <input
              id="request-title"
              className={inputClass}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Catering for Global Fest 2026"
            />
          </Field>

          <Field label="Category" htmlFor="request-category">
            <select
              id="request-category"
              className={inputClass}
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Event name" htmlFor="event-name">
            <input
              id="event-name"
              className={inputClass}
              required
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              placeholder="Global Fest 2026"
            />
          </Field>
          <Field label="Event date" htmlFor="event-date">
            <input
              id="event-date"
              type="date"
              className={inputClass}
              required
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </Field>
          <Field label="Location" htmlFor="event-location">
            <input
              id="event-location"
              className={inputClass}
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Main Auditorium"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Expected attendance" htmlFor="event-attendance">
            <input
              id="event-attendance"
              type="number"
              min={1}
              className={inputClass}
              value={attendance}
              onChange={(event) => setAttendance(event.target.value)}
              placeholder="150"
            />
          </Field>
          <Field label="Budget min (PKR)" htmlFor="budget-min">
            <input
              id="budget-min"
              type="number"
              min={0}
              className={inputClass}
              value={budgetMin}
              onChange={(event) => setBudgetMin(event.target.value)}
              placeholder="70000"
            />
          </Field>
          <Field label="Budget max (PKR)" htmlFor="budget-max">
            <input
              id="budget-max"
              type="number"
              min={0}
              className={inputClass}
              value={budgetMax}
              onChange={(event) => setBudgetMax(event.target.value)}
              placeholder="95000"
            />
          </Field>
          <Field label="Quantity" htmlFor="request-quantity" hint="e.g. meals or units">
            <input
              id="request-quantity"
              type="number"
              min={1}
              className={inputClass}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="150"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quotation deadline"
            htmlFor="request-deadline"
            hint="Optional. When vendors should respond by."
          >
            <input
              id="request-deadline"
              type="datetime-local"
              className={inputClass}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Requirement description"
          htmlFor="request-description"
          hint="At least 20 characters. Include what is included and any constraints."
        >
          <textarea
            id="request-description"
            rows={4}
            className={inputClass}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Buffet for 150 guests, including vegetarian options, served between 7pm and 9pm."
          />
        </Field>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" className={buttonStyles('ghost', 'md')} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={buttonStyles('secondary', 'md')}
            disabled={saving !== null}
            onClick={() => void save(false)}
          >
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="submit"
            className={buttonStyles('primary', 'md')}
            disabled={saving !== null}
          >
            {saving === 'publish' ? 'Publishing…' : 'Publish request'}
          </button>
        </div>
      </form>
    </Card>
  );
}
