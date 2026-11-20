import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  api,
  type Category,
  type MyQuotationListItem,
  type MyVendor,
  type Paginated,
  type VendorRequestListItem,
  type VendorReview,
} from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatBudget, formatDate, formatDateTime, formatMoney, humanize } from '../lib/format.js';
import {
  Alert,
  Badge,
  buttonStyles,
  Card,
  EmptyState,
  Field,
  inputClass,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  Stat,
  StatusBadge,
} from '../components/ui.js';
import { AuthGate } from '../components/auth-gate.js';
import { QuotationForm } from '../components/quotation-form.js';

export function VendorPage() {
  return (
    <AuthGate role="vendor">
      <VendorDashboard />
    </AuthGate>
  );
}

const emptyPage: Paginated<VendorRequestListItem> = {
  items: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

function VendorDashboard() {
  const { section } = useParams();
  const active = section ?? 'overview';
  const { user } = useAuth();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [portfolioNotice, setPortfolioNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [profileForm, setProfileForm] = useState({
    businessName: '',
    description: '',
    city: '',
    serviceArea: '',
    contactPerson: '',
    contactPhone: '',
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySaving, setCategorySaving] = useState(false);

  const profile = useApiQuery(() => api<MyVendor>('/vendors/me'), []);
  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);
  const reviews = useApiQuery(
    () =>
      profile.data
        ? api<VendorReview[]>(`/vendors/${profile.data.id}/reviews`)
        : Promise.resolve([]),
    [profile.data?.id],
  );
  const myQuotations = useApiQuery(
    () =>
      api<{ items: MyQuotationListItem[]; pagination: { total: number } }>(
        '/quotations/mine?pageSize=50',
      ),
    [],
  );
  const requestBoard = useApiQuery(async () => {
    if (profile.data?.verificationStatus !== 'verified') return emptyPage;
    return api<Paginated<VendorRequestListItem>>('/vendor/requests?pageSize=50');
  }, [profile.data?.verificationStatus]);

  const items = requestBoard.data?.items ?? [];
  const invited = items.filter((request) => request.distribution.status === 'invited').length;
  const quoted = items.filter((request) => request.hasQuoted).length;
  const status = profile.data?.verificationStatus;

  useEffect(() => {
    if (!profile.data) return;
    setProfileForm({
      businessName: profile.data.businessName,
      description: profile.data.description,
      city: profile.data.city,
      serviceArea: profile.data.serviceArea ?? '',
      contactPerson: profile.data.contactPerson ?? '',
      contactPhone: profile.data.contactPhone ?? '',
    });
    setSelectedCategories(profile.data.categories.map((c) => c.id));
  }, [profile.data]);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileNotice(null);
    try {
      await api('/vendors/me', {
        method: 'PATCH',
        body: {
          businessName: profileForm.businessName,
          description: profileForm.description,
          city: profileForm.city,
          serviceArea: profileForm.serviceArea || undefined,
          contactPerson: profileForm.contactPerson || undefined,
          contactPhone: profileForm.contactPhone || undefined,
        },
      });
      setProfileNotice({ tone: 'success', text: 'Profile updated.' });
      profile.reload();
    } catch (caught) {
      setProfileNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update profile',
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveCategories() {
    setCategorySaving(true);
    try {
      await api('/vendors/me', { method: 'PATCH', body: { categoryIds: selectedCategories } });
      profile.reload();
    } catch (caught) {
      setProfileNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update categories',
      });
    } finally {
      setCategorySaving(false);
    }
  }

  async function uploadPortfolio(file: File) {
    if (!file.type.startsWith('image/')) {
      setPortfolioNotice({ tone: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPortfolioNotice({ tone: 'error', text: 'Image must be under 2 MB.' });
      return;
    }
    setUploading(true);
    setPortfolioNotice(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api('/vendors/me/portfolio', {
          method: 'POST',
          body: { dataUrl: reader.result, caption: file.name },
        });
        setPortfolioNotice({ tone: 'success', text: 'Portfolio image added.' });
        profile.reload();
      } catch (caught) {
        setPortfolioNotice({
          tone: 'error',
          text: caught instanceof Error ? caught.message : 'Unable to upload image',
        });
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setPortfolioNotice({ tone: 'error', text: 'Unable to read the file.' });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function removePortfolio(imageId: string) {
    try {
      await api(`/vendors/me/portfolio/${imageId}`, { method: 'DELETE' });
      profile.reload();
    } catch (caught) {
      setPortfolioNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to remove image',
      });
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', to: '/vendor' },
    { id: 'profile', label: 'Profile', to: '/vendor/profile' },
    { id: 'requests', label: 'Requests', to: '/vendor/requests' },
    { id: 'quotations', label: 'Quotations', to: '/vendor/quotations' },
    { id: 'reviews', label: 'Reviews', to: '/vendor/reviews' },
    { id: 'settings', label: 'Settings', to: '/vendor/settings' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Vendor dashboard"
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Track your verification, manage your profile and categories, send quotations and review your performance."
        actions={status ? <StatusBadge status={status} /> : undefined}
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            className={buttonStyles(active === tab.id ? 'primary' : 'ghost', 'sm')}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {active === 'overview' && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Verification"
            value={status ? humanize(status) : '—'}
            hint="Admin-reviewed"
          />
          <Stat
            label="Open invitations"
            value={status === 'verified' && !requestBoard.loading ? invited : '—'}
            hint="New requests"
          />
          <Stat
            label="Quoted"
            value={status === 'verified' && !requestBoard.loading ? quoted : '—'}
            hint="Requests you replied to"
          />
          <Stat
            label="Categories"
            value={profile.data ? profile.data.categories.length : '—'}
            hint="Services you offer"
          />
        </div>
      )}

      {active === 'profile' && (
        <section id="profile" className="mt-10">
          <SectionHeading title="Business profile" description="How societies see your business." />
          {profile.loading && <LoadingBlock label="Loading profile…" />}
          {profile.error && <Alert tone="error">{profile.error}</Alert>}
          {profile.data && (
            <Card className="p-6">
              {!profileEditing ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {profile.data.businessName}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {profile.data.city}
                        {profile.data.serviceArea ? ` · ${profile.data.serviceArea}` : ''}
                      </p>
                    </div>
                    <Badge tone="brand">
                      {profile.data.rating.count > 0
                        ? `★ ${profile.data.rating.average?.toFixed(1) ?? '—'}`
                        : 'New'}
                    </Badge>
                  </div>

                  <p className="mt-4 text-sm text-slate-600">{profile.data.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {profile.data.categories.length === 0 && (
                      <span className="text-sm text-slate-500">No categories selected.</span>
                    )}
                    {profile.data.categories.map((category) => (
                      <Badge key={category.id} tone="slate">
                        {category.name}
                      </Badge>
                    ))}
                  </div>

                  <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Contact</dt>
                      <dd className="font-medium text-slate-800">
                        {profile.data.contactPerson ?? '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Phone</dt>
                      <dd className="font-medium text-slate-800">
                        {profile.data.contactPhone ?? '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Listed since</dt>
                      <dd className="font-medium text-slate-800">
                        {formatDate(profile.data.createdAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <button
                      type="button"
                      className={buttonStyles('secondary', 'sm')}
                      onClick={() => setProfileEditing(true)}
                    >
                      Edit profile
                    </button>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Portfolio
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(profile.data.portfolio ?? []).map((image) => (
                        <div key={image.id} className="group relative">
                          <img
                            src={image.dataUrl}
                            alt={image.caption ?? 'Portfolio image'}
                            className="h-24 w-full rounded-lg object-cover ring-1 ring-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => void removePortfolio(image.id)}
                            aria-label="Remove portfolio image"
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-rose-600 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadPortfolio(file);
                          event.target.value = '';
                        }}
                      />
                      {uploading ? 'Uploading…' : 'Add image'}
                    </label>
                    {portfolioNotice && (
                      <div className="mt-2">
                        <Alert tone={portfolioNotice.tone}>{portfolioNotice.text}</Alert>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveProfile();
                  }}
                >
                  <Field label="Business name" htmlFor="vendor-business">
                    <input
                      id="vendor-business"
                      className={inputClass}
                      value={profileForm.businessName}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, businessName: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Description" htmlFor="vendor-description">
                    <textarea
                      id="vendor-description"
                      rows={3}
                      className={inputClass}
                      value={profileForm.description}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, description: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="City" htmlFor="vendor-city">
                      <input
                        id="vendor-city"
                        className={inputClass}
                        value={profileForm.city}
                        onChange={(event) =>
                          setProfileForm({ ...profileForm, city: event.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field label="Service area" htmlFor="vendor-area">
                      <input
                        id="vendor-area"
                        className={inputClass}
                        value={profileForm.serviceArea}
                        onChange={(event) =>
                          setProfileForm({ ...profileForm, serviceArea: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Contact person" htmlFor="vendor-contact">
                      <input
                        id="vendor-contact"
                        className={inputClass}
                        value={profileForm.contactPerson}
                        onChange={(event) =>
                          setProfileForm({ ...profileForm, contactPerson: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Contact phone" htmlFor="vendor-phone">
                      <input
                        id="vendor-phone"
                        className={inputClass}
                        value={profileForm.contactPhone}
                        onChange={(event) =>
                          setProfileForm({ ...profileForm, contactPhone: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  {profileNotice && <Alert tone={profileNotice.tone}>{profileNotice.text}</Alert>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={buttonStyles('primary', 'sm')}
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving…' : 'Save profile'}
                    </button>
                    <button
                      type="button"
                      className={buttonStyles('ghost', 'sm')}
                      onClick={() => setProfileEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {profile.data && (
            <Card className="mt-4 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Service categories
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(categories.data ?? []).map((category) => {
                  const checked = selectedCategories.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300 bg-white text-slate-700'}`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() =>
                          setSelectedCategories((current) =>
                            checked
                              ? current.filter((id) => id !== category.id)
                              : [...current, category.id],
                          )
                        }
                      />
                      {category.name}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                disabled={categorySaving}
                onClick={() => void saveCategories()}
              >
                {categorySaving ? 'Saving…' : 'Save categories'}
              </button>
            </Card>
          )}
        </section>
      )}

      {active === 'requests' && (
        <section id="requests" className="mt-10">
          <SectionHeading
            title="Matched requests"
            description="Requests distributed to you based on your service categories."
          />

          {status !== 'verified' ? (
            <EmptyState
              title="Requests unlock after verification"
              description="Once an administrator approves your business, matching requests will appear here."
            />
          ) : (
            <>
              <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-800">
                <strong className="font-semibold">Apply with a quotation.</strong> Submit your price
                and inclusions; the society is notified instantly and can review every application.
                You can revise your quote until the request closes.
              </div>

              {requestBoard.loading && <LoadingBlock label="Loading matched requests…" />}
              {requestBoard.error && <Alert tone="error">{requestBoard.error}</Alert>}

              {!requestBoard.loading && items.length === 0 && !requestBoard.error && (
                <EmptyState
                  title="No matched requests yet"
                  description="New opportunities in your categories will show up here automatically."
                />
              )}

              <div className="space-y-3">
                {items.map((request) => (
                  <div key={request.id} className="space-y-3">
                    <Card className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={request.status} />
                        <Badge tone={request.hasQuoted ? 'violet' : 'sky'}>
                          {request.hasQuoted ? 'Quoted' : humanize(request.distribution.status)}
                        </Badge>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {request.reference}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-slate-900">
                        {request.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {request.society.name} · {request.category.name}
                        {request.event?.eventDate
                          ? ` · ${formatDate(request.event.eventDate)}`
                          : ''}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatBudget(request.budgetMin, request.budgetMax)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          {request.responseDeadline && (
                            <p className="text-xs text-slate-500">
                              Respond by {formatDateTime(request.responseDeadline)}
                            </p>
                          )}
                          <button
                            type="button"
                            className={buttonStyles(
                              request.hasQuoted ? 'secondary' : 'primary',
                              'sm',
                            )}
                            onClick={() =>
                              setActiveRequestId((current) =>
                                current === request.id ? null : request.id,
                              )
                            }
                          >
                            {activeRequestId === request.id
                              ? 'Close form'
                              : request.hasQuoted
                                ? 'Edit quotation'
                                : 'Apply with a quote'}
                          </button>
                        </div>
                      </div>
                    </Card>

                    {activeRequestId === request.id && (
                      <QuotationForm
                        requestId={request.id}
                        requestTitle={request.title}
                        hasQuoted={request.hasQuoted}
                        onClose={() => setActiveRequestId(null)}
                        onSaved={() => requestBoard.reload()}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {active === 'quotations' && (
        <section id="quotations" className="mt-10">
          <SectionHeading title="My quotations" description="Quotations you have submitted." />
          {myQuotations.loading && <LoadingBlock label="Loading quotations…" />}
          {myQuotations.error && <Alert tone="error">{myQuotations.error}</Alert>}
          {!myQuotations.loading &&
            !myQuotations.error &&
            (myQuotations.data?.items.length ?? 0) === 0 && (
              <EmptyState
                title="No quotations yet"
                description="Apply to a matched request to create your first quotation."
              />
            )}
          <div className="mt-4 space-y-3">
            {myQuotations.data?.items.map((quote) => (
              <Card key={quote.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{quote.request.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {quote.request.reference} · {quote.reference} ·{' '}
                      {formatMoney(quote.totalPrice)}
                    </p>
                  </div>
                  <Badge tone={quote.status === 'selected' ? 'emerald' : 'slate'}>
                    {humanize(quote.status)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {active === 'reviews' && (
        <section id="reviews" className="mt-10">
          <SectionHeading
            title="Your reviews"
            description="Feedback from societies you have worked with."
          />
          {reviews.loading && <LoadingBlock label="Loading reviews…" />}
          {reviews.error && <Alert tone="error">{reviews.error}</Alert>}
          {!reviews.loading && !reviews.error && (reviews.data?.length ?? 0) === 0 && (
            <EmptyState
              title="No reviews yet"
              description="Reviews appear here after a society completes an engagement."
            />
          )}
          <div className="mt-4 space-y-3">
            {reviews.data?.map((review) => (
              <Card key={review.id} className="p-4">
                <p className="text-sm font-semibold text-amber-600">
                  {'★'.repeat(review.rating)}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {review.society.name}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{review.comment ?? 'No comment.'}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(review.createdAt)}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {active === 'settings' && (
        <section id="settings" className="mt-10">
          <SectionHeading title="Settings" description="Account and notification preferences." />
          <Card className="p-6">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-800">{user?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800">{user?.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-800">Vendor</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Use the profile editor above to update your business details. Password changes are
              handled through the login flow.
            </p>
          </Card>
        </section>
      )}
    </div>
  );
}
