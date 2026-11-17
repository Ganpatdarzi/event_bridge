import { api, type MyVendor, type Paginated, type VendorRequestListItem } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatBudget, formatDate, formatDateTime, humanize } from '../lib/format.js';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  Stat,
  StatusBadge,
} from '../components/ui.js';
import { AuthGate } from '../components/auth-gate.js';

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

  const profile = useApiQuery(() => api<MyVendor>('/vendors/me'), []);
  const requestBoard = useApiQuery(async () => {
    if (profile.data?.verificationStatus !== 'verified') return emptyPage;
    return api<Paginated<VendorRequestListItem>>('/vendor/requests?pageSize=50');
  }, [profile.data?.verificationStatus]);

  const items = requestBoard.data?.items ?? [];
  const invited = items.filter((request) => request.distribution.status === 'invited').length;
  const quoted = items.filter((request) => request.hasQuoted).length;
  const status = profile.data?.verificationStatus;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Vendor dashboard"
        title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}`}
        description="Track your verification, browse matched requests and keep your public profile current."
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
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Quotation submission is part of Stage 5 and is not enabled in this build. You can
                still review every request you have been invited to.
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
                  <Card key={request.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={request.status} />
                      <Badge tone={request.hasQuoted ? 'violet' : 'sky'}>
                        {request.hasQuoted ? 'Quoted' : humanize(request.distribution.status)}
                      </Badge>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {request.reference}
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-semibold text-slate-900">{request.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.society.name} · {request.category.name}
                      {request.event?.eventDate ? ` · ${formatDate(request.event.eventDate)}` : ''}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatBudget(request.budgetMin, request.budgetMax)}
                      </p>
                      {request.responseDeadline && (
                        <p className="text-xs text-slate-500">
                          Respond by {formatDateTime(request.responseDeadline)}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
