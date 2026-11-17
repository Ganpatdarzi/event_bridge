import { useState } from 'react';
import {
  api,
  type MyVendor,
  type Paginated,
  type VendorRequestListItem,
  type VendorReview,
} from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatBudget, formatDate, formatDateTime, humanize } from '../lib/format.js';
import {
  Alert,
  Badge,
  buttonStyles,
  Card,
  EmptyState,
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
  const { user } = useAuth();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [portfolioNotice, setPortfolioNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);

  const profile = useApiQuery(() => api<MyVendor>('/vendors/me'), []);
  const reviews = useApiQuery(
    () =>
      profile.data
        ? api<VendorReview[]>(`/vendors/${profile.data.id}/reviews`)
        : Promise.resolve([]),
    [profile.data?.id],
  );
  const requestBoard = useApiQuery(async () => {
    if (profile.data?.verificationStatus !== 'verified') return emptyPage;
    return api<Paginated<VendorRequestListItem>>('/vendor/requests?pageSize=50');
  }, [profile.data?.verificationStatus]);

  const items = requestBoard.data?.items ?? [];
  const invited = items.filter((request) => request.distribution.status === 'invited').length;
  const quoted = items.filter((request) => request.hasQuoted).length;
  const status = profile.data?.verificationStatus;

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Vendor dashboard"
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Track your verification, browse matched requests, send quotations and keep your public profile current."
        actions={status ? <StatusBadge status={status} /> : undefined}
      />

      {status === 'pending_review' && (
        <div className="mt-6">
          <Alert tone="info">
            <strong className="font-semibold">Your application is under review.</strong> An
            administrator will verify your business before requests and directory placement are
            enabled.
          </Alert>
        </div>
      )}

      {status === 'rejected' && (
        <div className="mt-6">
          <Alert tone="error">
            <strong className="font-semibold">Application rejected.</strong>{' '}
            {profile.data?.rejectionReason ?? 'Contact the platform administrator for details.'}
          </Alert>
        </div>
      )}

      {status === 'changes_requested' && (
        <div className="mt-6">
          <Alert tone="info">
            <strong className="font-semibold">Changes requested.</strong>{' '}
            {profile.data?.rejectionReason ?? 'Update your profile and resubmit for review.'}
          </Alert>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Verification" value={status ? humanize(status) : '—'} hint="Admin-reviewed" />
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <section>
          <SectionHeading title="Public profile" description="How societies see your business." />
          {profile.loading && <LoadingBlock label="Loading profile…" />}
          {profile.error && <Alert tone="error">{profile.error}</Alert>}
          {profile.data && (
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{profile.data.businessName}</h3>
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
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-semibold text-rose-600 opacity-0 transition-opacity group-hover:opacity-100"
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

              <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Contact</dt>
                  <dd className="font-medium text-slate-800">
                    {profile.data.contactPerson ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium text-slate-800">{profile.data.contactPhone ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Listed since</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDate(profile.data.createdAt)}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
        </section>

        <section>
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

        <section className="mt-8">
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
      </div>
    </div>
  );
}
