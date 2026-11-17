import { useState } from 'react';
import {
  api,
  type AdminStats,
  type AdminVendor,
  type Category,
  type Paginated,
} from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, humanize } from '../lib/format.js';
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

export function AdminPage() {
  return (
    <AuthGate role="admin">
      <AdminDashboard />
    </AuthGate>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  const stats = useApiQuery(() => api<AdminStats>('/admin/stats'), []);
  const queue = useApiQuery(
    () => api<Paginated<AdminVendor>>('/admin/vendors?status=pending_review&pageSize=20'),
    [],
  );
  const categories = useApiQuery(() => api<Category[]>('/admin/categories'), []);

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function approve(vendor: AdminVendor) {
    setBusy(`approve-${vendor.id}`);
    setNotice(null);
    try {
      await api(`/admin/vendors/${vendor.id}/approve`, { method: 'POST', body: {} });
      setNotice({ tone: 'success', text: `${vendor.businessName} approved.` });
      queue.reload();
      stats.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to approve vendor',
      });
    } finally {
      setBusy(null);
    }
  }

  async function reject(vendor: AdminVendor) {
    if (reason.trim().length < 5) {
      setNotice({ tone: 'error', text: 'Enter a rejection reason of at least 5 characters.' });
      return;
    }

    setBusy(`reject-${vendor.id}`);
    setNotice(null);
    try {
      await api(`/admin/vendors/${vendor.id}/reject`, {
        method: 'POST',
        body: { reason: reason.trim() },
      });
      setNotice({ tone: 'success', text: `${vendor.businessName} rejected.` });
      setRejectingId(null);
      setReason('');
      queue.reload();
      stats.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to reject vendor',
      });
    } finally {
      setBusy(null);
    }
  }

  const vendorStats = stats.data?.vendors.byStatus ?? {};
  const requestStats = stats.data?.requests.byStatus ?? {};
  const pending = vendorStats.pending_review ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Admin dashboard"
        title={`Platform overview`}
        description={`Signed in as ${user?.name}. Review applications, manage categories and monitor activity.`}
        actions={
          pending > 0 ? (
            <Badge tone="amber">{pending} vendors awaiting review</Badge>
          ) : (
            <Badge tone="emerald">Review queue clear</Badge>
          )
        }
      />

      {notice && (
        <div className="mt-6">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Users"
          value={stats.loading ? '—' : (stats.data?.users.total ?? 0)}
          hint={`${stats.data?.users.byRole.society ?? 0} societies · ${stats.data?.users.byRole.vendor ?? 0} vendors`}
          accent
        />
        <Stat
          label="Vendors"
          value={stats.loading ? '—' : (stats.data?.vendors.total ?? 0)}
          hint={`${vendorStats.verified ?? 0} verified · ${pending} pending`}
        />
        <Stat
          label="Requests"
          value={stats.loading ? '—' : (stats.data?.requests.total ?? 0)}
          hint={`${requestStats.open ?? 0} open · ${requestStats.quoted ?? 0} quoted`}
        />
        <Stat
          label="Quotations"
          value={stats.loading ? '—' : (stats.data?.quotations.total ?? 0)}
          hint="Across all requests"
        />
      </div>

      <section className="mt-10">
        <SectionHeading
          title="Vendor review queue"
          description="Applications waiting for an approval decision."
          actions={
            <button
              type="button"
              className={buttonStyles('ghost', 'sm')}
              onClick={() => {
                queue.reload();
                setReason('');
                setRejectingId(null);
              }}
            >
              Refresh
            </button>
          }
        />

        {queue.loading && <LoadingBlock label="Loading review queue…" />}
        {queue.error && <Alert tone="error">{queue.error}</Alert>}

        {!queue.loading && !queue.error && queue.data?.items.length === 0 && (
          <EmptyState
            title="Nothing to review"
            description="New vendor applications will appear here as soon as they register."
          />
        )}

        <div className="space-y-4">
          {queue.data?.items.map((vendor) => (
            <Card key={vendor.id} className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {vendor.businessName}
                    </h3>
                    <StatusBadge status={vendor.verificationStatus} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {vendor.city}
                    {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ''} · applied{' '}
                    {formatDate(vendor.createdAt)}
                  </p>
                  <p className="mt-3 max-w-2xl text-sm text-slate-600">{vendor.description}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {vendor.categories.map((category) => (
                      <Badge key={category.id} tone="brand">
                        {category.name}
                      </Badge>
                    ))}
                    {vendor.categories.length === 0 && (
                      <span className="text-xs text-slate-400">No categories selected</span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    {vendor.contactPerson ?? 'No contact person'}
                    {vendor.user.email ? ` · ${vendor.user.email}` : ''}
                    {vendor.contactPhone ? ` · ${vendor.contactPhone}` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonStyles('primary', 'sm')}
                    disabled={busy !== null}
                    onClick={() => void approve(vendor)}
                  >
                    {busy === `approve-${vendor.id}` ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className={buttonStyles('danger', 'sm')}
                    disabled={busy !== null}
                    onClick={() => {
                      setRejectingId(rejectingId === vendor.id ? null : vendor.id);
                      setReason('');
                      setNotice(null);
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {rejectingId === vendor.id && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <label
                    htmlFor={`reason-${vendor.id}`}
                    className="text-sm font-medium text-rose-900"
                  >
                    Rejection reason (visible to the vendor)
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id={`reason-${vendor.id}`}
                      className="block w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="At least 5 characters"
                    />
                    <button
                      type="button"
                      className={buttonStyles('danger', 'sm')}
                      disabled={busy !== null}
                      onClick={() => void reject(vendor)}
                    >
                      {busy === `reject-${vendor.id}` ? 'Rejecting…' : 'Confirm reject'}
                    </button>
                    <button
                      type="button"
                      className={buttonStyles('secondary', 'sm')}
                      onClick={() => {
                        setRejectingId(null);
                        setReason('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Service categories"
          description="Categories drive vendor matching and request routing."
        />

        {categories.loading && <LoadingBlock label="Loading categories…" />}
        {categories.error && <Alert tone="error">{categories.error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.data?.map((category) => (
            <Card key={category.id} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{category.name}</h3>
                <Badge tone={category.isActive === false ? 'slate' : 'emerald'}>
                  {category.isActive === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">{category.slug}</p>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {category.description ?? 'No description.'}
              </p>
              <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  <span className="font-semibold text-slate-900">{category.requestCount ?? 0}</span>{' '}
                  requests
                </span>
                <span>
                  <span className="font-semibold text-slate-900">{category.vendorCount ?? 0}</span>{' '}
                  vendors
                </span>
              </div>
            </Card>
          ))}
        </div>

        {!categories.loading && (categories.data ?? []).length === 0 && (
          <EmptyState title="No categories yet" description="Seed the database to load defaults." />
        )}
      </section>

      <section className="mt-10">
        <SectionHeading title="Status breakdown" description="Live counts from the platform." />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Requests by status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(requestStats).length === 0 && (
                <span className="text-sm text-slate-500">No request activity yet.</span>
              )}
              {Object.entries(requestStats).map(([status, count]) => (
                <Badge key={status} tone="slate">
                  {humanize(status)}: <span className="font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Vendors by status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(vendorStats).length === 0 && (
                <span className="text-sm text-slate-500">No vendor activity yet.</span>
              )}
              {Object.entries(vendorStats).map(([status, count]) => (
                <Badge key={status} tone="slate">
                  {humanize(status)}: <span className="font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
