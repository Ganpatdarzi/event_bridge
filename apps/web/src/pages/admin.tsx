import { useState } from 'react';
import {
  api,
  type AdminReview,
  type AdminStats,
  type AdminUser,
  type AdminVendor,
  type AuditLogEntry,
  type Category,
  type Paginated,
  type RequestListItem,
  type SystemSetting,
  type VendorCategory,
} from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatDateTime, humanize } from '../lib/format.js';
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
import { RequestApplications } from '../components/request-applications.js';

export function AdminPage() {
  return (
    <AuthGate role="admin">
      <AdminDashboard />
    </AuthGate>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'categories', label: 'Categories' },
  { id: 'requests', label: 'Requests' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');
  const stats = useApiQuery(() => api<AdminStats>('/admin/stats'), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Admin dashboard"
        title="Platform overview"
        description={`Signed in as ${user?.name}. Manage every part of the platform from one place.`}
        actions={
          stats.data ? (
            <Badge tone="slate">
              {stats.data.users.total} users · {stats.data.vendors.total} vendors ·{' '}
              {stats.data.requests.total} requests
            </Badge>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={buttonStyles(tab === item.id ? 'primary' : 'ghost', 'sm')}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'overview' && <OverviewSection stats={stats} />}
        {tab === 'users' && <UsersSection />}
        {tab === 'vendors' && <VendorsSection />}
        {tab === 'categories' && <CategoriesSection />}
        {tab === 'requests' && <RequestsSection />}
        {tab === 'reviews' && <ReviewsSection />}
        {tab === 'activity' && <ActivitySection />}
        {tab === 'settings' && <SettingsSection />}
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function OverviewSection({ stats }: { stats: ReturnType<typeof useApiQuery<AdminStats>> }) {
  const vendorStats = stats.data?.vendors.byStatus ?? {};
  const requestStats = stats.data?.requests.byStatus ?? {};
  const pending = vendorStats.pending_review ?? 0;

  return (
    <>
      {stats.error && <Alert tone="error">{stats.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </>
  );
}

/* ---------------- Users ---------------- */

function UsersSection() {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState({ role: '', status: '', search: '' });
  const [page, setPage] = useState(1);

  const query = useApiQuery(
    () =>
      api<Paginated<AdminUser>>(
        `/admin/users?${new URLSearchParams({
          ...(committed.role ? { role: committed.role } : {}),
          ...(committed.status ? { status: committed.status } : {}),
          ...(committed.search ? { search: committed.search } : {}),
          page: String(page),
          pageSize: '20',
        }).toString()}`,
      ),
    [committed, page],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function changeStatus(user: AdminUser, action: 'suspend' | 'reactivate' | 'deactivate') {
    setBusy(`${action}-${user.id}`);
    setNotice(null);
    try {
      await api(`/admin/users/${user.id}/${action}`, { method: 'POST', body: {} });
      setNotice({ tone: 'success', text: `${user.name} ${action}d.` });
      query.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update user',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Registered users"
        description="View and manage every account on the platform."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap gap-3">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="society">Society</option>
            <option value="vendor">Vendor</option>
            <option value="admin">Admin</option>
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <input
            className={inputClass}
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={buttonStyles('primary', 'sm')}
            onClick={() => {
              setCommitted({ role, status, search });
              setPage(1);
            }}
          >
            Apply
          </button>
        </div>
      </Card>

      {query.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading users…" />
        </div>
      )}
      {query.error && (
        <div className="mt-4">
          <Alert tone="error">{query.error}</Alert>
        </div>
      )}

      {!query.loading && !query.error && (query.data?.items.length ?? 0) === 0 && (
        <div className="mt-4">
          <EmptyState title="No users" description="No accounts match the current filters." />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {query.data?.items.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="slate">{humanize(user.role)}</Badge>
                  <Badge tone={user.status === 'active' ? 'emerald' : 'amber'}>
                    {humanize(user.status)}
                  </Badge>
                  {user.vendor && <Badge tone="brand">{user.vendor.businessName}</Badge>}
                  {user.society && <Badge tone="brand">{user.society.name}</Badge>}
                </div>
                <p className="mt-2 text-xs text-slate-400">Joined {formatDate(user.createdAt)}</p>
              </div>
              {user.role !== 'admin' && (
                <div className="flex flex-wrap gap-2">
                  {user.status !== 'active' && (
                    <button
                      type="button"
                      className={buttonStyles('primary', 'sm')}
                      disabled={busy !== null}
                      onClick={() => void changeStatus(user, 'reactivate')}
                    >
                      {busy === `reactivate-${user.id}` ? '…' : 'Reactivate'}
                    </button>
                  )}
                  {user.status === 'active' && (
                    <button
                      type="button"
                      className={buttonStyles('secondary', 'sm')}
                      disabled={busy !== null}
                      onClick={() => void changeStatus(user, 'suspend')}
                    >
                      {busy === `suspend-${user.id}` ? '…' : 'Suspend'}
                    </button>
                  )}
                  {user.status !== 'deactivated' && (
                    <button
                      type="button"
                      className={buttonStyles('danger', 'sm')}
                      disabled={busy !== null}
                      onClick={() => void changeStatus(user, 'deactivate')}
                    >
                      {busy === `deactivate-${user.id}` ? '…' : 'Deactivate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {query.data.pagination.totalPages}
          </span>
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Vendors ---------------- */

function VendorsSection() {
  const [status, setStatus] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState({ status: 'pending_review', search: '' });
  const [page, setPage] = useState(1);

  const query = useApiQuery(
    () =>
      api<Paginated<AdminVendor>>(
        `/admin/vendors?${new URLSearchParams({
          ...(committed.status ? { status: committed.status } : {}),
          ...(committed.search ? { search: committed.search } : {}),
          page: String(page),
          pageSize: '20',
        }).toString()}`,
      ),
    [committed, page],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function review(vendor: AdminVendor, action: string, r?: string) {
    setBusy(`${action}-${vendor.id}`);
    setNotice(null);
    try {
      await api(`/admin/vendors/${vendor.id}/${action}`, {
        method: 'POST',
        body: r ? { reason: r } : {},
      });
      setNotice({ tone: 'success', text: `${vendor.businessName} updated.` });
      setRejectingId(null);
      setReason('');
      query.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update vendor',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Vendor management"
        description="Review applications and manage vendor status."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap gap-3">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending_review">Pending review</option>
            <option value="verified">Verified</option>
            <option value="changes_requested">Changes requested</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <input
            className={inputClass}
            placeholder="Search business or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={buttonStyles('primary', 'sm')}
            onClick={() => {
              setCommitted({ status, search });
              setPage(1);
            }}
          >
            Apply
          </button>
        </div>
      </Card>

      {query.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading vendors…" />
        </div>
      )}
      {query.error && (
        <div className="mt-4">
          <Alert tone="error">{query.error}</Alert>
        </div>
      )}

      {!query.loading && !query.error && (query.data?.items.length ?? 0) === 0 && (
        <div className="mt-4">
          <EmptyState title="No vendors" description="No vendors match the current filters." />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {query.data?.items.map((vendor) => (
          <Card key={vendor.id} className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{vendor.businessName}</h3>
                  <StatusBadge status={vendor.verificationStatus as never} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {vendor.city}
                  {vendor.serviceArea ? ` · ${vendor.serviceArea}` : ''} · {vendor.user.email}
                </p>
                <p className="mt-2 text-sm text-slate-600">{vendor.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vendor.categories.map((c: VendorCategory) => (
                    <Badge key={c.id} tone="brand">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonStyles('primary', 'sm')}
                  disabled={busy !== null}
                  onClick={() => void review(vendor, 'approve')}
                >
                  {busy === `approve-${vendor.id}` ? '…' : 'Approve'}
                </button>
                <button
                  type="button"
                  className={buttonStyles('secondary', 'sm')}
                  disabled={busy !== null}
                  onClick={() =>
                    void review(vendor, 'request_changes', 'Please update your profile.')
                  }
                >
                  {busy === `request_changes-${vendor.id}` ? '…' : 'Request changes'}
                </button>
                <button
                  type="button"
                  className={buttonStyles('secondary', 'sm')}
                  disabled={busy !== null}
                  onClick={() => void review(vendor, 'suspend')}
                >
                  {busy === `suspend-${vendor.id}` ? '…' : 'Suspend'}
                </button>
                <button
                  type="button"
                  className={buttonStyles('ghost', 'sm')}
                  disabled={busy !== null}
                  onClick={() => void review(vendor, 'restore')}
                >
                  {busy === `restore-${vendor.id}` ? '…' : 'Restore'}
                </button>
                <button
                  type="button"
                  className={buttonStyles('danger', 'sm')}
                  disabled={busy !== null}
                  onClick={() => {
                    setRejectingId(rejectingId === vendor.id ? null : vendor.id);
                    setReason('');
                  }}
                >
                  Reject
                </button>
              </div>
            </div>

            {rejectingId === vendor.id && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="block w-full rounded-xl border border-rose-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Rejection reason (min 5 chars)"
                  />
                  <button
                    type="button"
                    className={buttonStyles('danger', 'sm')}
                    disabled={busy !== null}
                    onClick={() => void review(vendor, 'reject', reason)}
                  >
                    {busy === `reject-${vendor.id}` ? '…' : 'Confirm'}
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
  );
}

/* ---------------- Categories ---------------- */

function CategoriesSection() {
  const categories = useApiQuery(() => api<Category[]>('/admin/categories'), []);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [busy, setBusy] = useState(false);

  async function createCategory() {
    if (!form.name.trim() || !form.slug.trim()) {
      setNotice({ tone: 'error', text: 'Name and slug are required.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api('/categories', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
        },
      });
      setNotice({ tone: 'success', text: 'Category created.' });
      setForm({ name: '', slug: '', description: '' });
      categories.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to create category',
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(category: Category) {
    try {
      await api(`/categories/${category.id}/status`, {
        method: 'PATCH',
        body: { isActive: !(category.isActive !== false) },
      });
      categories.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update category',
      });
    }
  }

  return (
    <section>
      <SectionHeading
        title="Categories"
        description="Create, update and activate service categories."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Name" htmlFor="cat-name">
            <input
              id="cat-name"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug" htmlFor="cat-slug">
            <input
              id="cat-slug"
              className={inputClass}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="cat-desc">
            <input
              id="cat-desc"
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className={buttonStyles('primary', 'sm')}
              disabled={busy}
              onClick={() => void createCategory()}
            >
              {busy ? '…' : 'Create'}
            </button>
          </div>
        </div>
      </Card>

      {categories.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading categories…" />
        </div>
      )}
      {categories.error && (
        <div className="mt-4">
          <Alert tone="error">{categories.error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.data?.map((category) => (
          <Card key={category.id} className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{category.name}</h3>
              <Badge tone={category.isActive === false ? 'slate' : 'emerald'}>
                {category.isActive === false ? 'Inactive' : 'Active'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{category.slug}</p>
            <p className="mt-2 text-sm text-slate-600">
              {category.description ?? 'No description.'}
            </p>
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                className={buttonStyles('secondary', 'sm')}
                onClick={() => void toggleStatus(category)}
              >
                {category.isActive === false ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Requests ---------------- */

function RequestsSection() {
  const [status, setStatus] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useApiQuery(
    () =>
      api<Paginated<RequestListItem>>(
        `/requests?${new URLSearchParams({
          ...(committed ? { status: committed } : {}),
          page: String(page),
          pageSize: '20',
        }).toString()}`,
      ),
    [committed, page],
  );

  return (
    <section>
      <SectionHeading
        title="Quotation requests"
        description="Monitor every request and its applications."
      />
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap gap-3">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="open">Open</option>
            <option value="partially_quoted">Partially quoted</option>
            <option value="quoted">Quoted</option>
            <option value="selected">Selected</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="button"
            className={buttonStyles('primary', 'sm')}
            onClick={() => {
              setCommitted(status);
              setPage(1);
            }}
          >
            Apply
          </button>
        </div>
      </Card>

      {query.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading requests…" />
        </div>
      )}
      {query.error && (
        <div className="mt-4">
          <Alert tone="error">{query.error}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {query.data?.items.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={request.status as never} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {request.reference}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{request.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {request.society.name} · {request.category.name}
                  {request.event?.eventDate ? ` · ${formatDate(request.event.eventDate)}` : ''}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {request.quotationCount} quotation{request.quotationCount === 1 ? '' : 's'}{' '}
                  received
                </p>
              </div>
              {request.quotationCount > 0 && (
                <button
                  type="button"
                  className={buttonStyles('secondary', 'sm')}
                  onClick={() => setExpanded(expanded === request.id ? null : request.id)}
                >
                  {expanded === request.id ? 'Hide applications' : 'Review applications'}
                </button>
              )}
            </div>
            {expanded === request.id && <RequestApplications requestId={request.id} />}
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Reviews ---------------- */

function ReviewsSection() {
  const [hidden, setHidden] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);

  const query = useApiQuery(
    () =>
      api<Paginated<AdminReview>>(
        `/admin/reviews?${new URLSearchParams({
          ...(committed ? { hidden: committed } : {}),
          page: String(page),
          pageSize: '20',
        }).toString()}`,
      ),
    [committed, page],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function moderate(review: AdminReview, action: 'hide' | 'unhide') {
    setBusy(`${action}-${review.id}`);
    setNotice(null);
    try {
      await api(`/admin/reviews/${review.id}/${action}`, { method: 'POST', body: {} });
      setNotice({ tone: 'success', text: `Review ${action}d.` });
      query.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update review',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Review moderation"
        description="Hide or restore reviews left for vendors."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap gap-3">
          <select className={inputClass} value={hidden} onChange={(e) => setHidden(e.target.value)}>
            <option value="">All reviews</option>
            <option value="false">Visible</option>
            <option value="true">Hidden</option>
          </select>
          <button
            type="button"
            className={buttonStyles('primary', 'sm')}
            onClick={() => {
              setCommitted(hidden);
              setPage(1);
            }}
          >
            Apply
          </button>
        </div>
      </Card>

      {query.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading reviews…" />
        </div>
      )}
      {query.error && (
        <div className="mt-4">
          <Alert tone="error">{query.error}</Alert>
        </div>
      )}

      {!query.loading && !query.error && (query.data?.items.length ?? 0) === 0 && (
        <div className="mt-4">
          <EmptyState title="No reviews" description="No reviews match the current filter." />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {query.data?.items.map((review) => (
          <Card key={review.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="amber">{'★'.repeat(review.rating)}</Badge>
                  {review.isHidden && <Badge tone="slate">Hidden</Badge>}
                </div>
                <p className="mt-2 text-sm text-slate-700">{review.comment ?? 'No comment.'}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {review.society.name} → {review.vendor.businessName} · {review.request.reference}
                </p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(review.createdAt)}</p>
              </div>
              <button
                type="button"
                className={buttonStyles(review.isHidden ? 'primary' : 'danger', 'sm')}
                disabled={busy !== null}
                onClick={() => void moderate(review, review.isHidden ? 'unhide' : 'hide')}
              >
                {busy === `${review.isHidden ? 'unhide' : 'hide'}-${review.id}`
                  ? '…'
                  : review.isHidden
                    ? 'Unhide'
                    : 'Hide'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Activity ---------------- */

function ActivitySection() {
  const [page, setPage] = useState(1);
  const query = useApiQuery(
    () => api<Paginated<AuditLogEntry>>(`/admin/audit-logs?page=${page}&pageSize=25`),
    [page],
  );

  return (
    <section>
      <SectionHeading
        title="Platform activity"
        description="Every administrative and quotation action recorded in the audit log."
      />
      {query.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading activity…" />
        </div>
      )}
      {query.error && (
        <div className="mt-4">
          <Alert tone="error">{query.error}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {query.data?.items.map((entry) => (
          <Card key={entry.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{humanize(entry.action)}</p>
                <p className="text-xs text-slate-500">
                  {entry.targetType}
                  {entry.targetId ? ` · ${entry.targetId}` : ''}
                </p>
                {entry.actor && (
                  <p className="mt-1 text-xs text-slate-400">
                    by {entry.actor.name} ({entry.actor.email})
                  </p>
                )}
              </div>
              <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
            </div>
          </Card>
        ))}
      </div>

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {query.data.pagination.totalPages}
          </span>
          <button
            type="button"
            className={buttonStyles('secondary', 'sm')}
            disabled={page >= query.data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------------- Settings ---------------- */

function SettingsSection() {
  const settings = useApiQuery(() => api<SystemSetting[]>('/admin/settings'), []);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  async function saveNew() {
    if (!key.trim() || !value.trim()) {
      setNotice({ tone: 'error', text: 'Key and value are required.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await api(`/admin/settings/${encodeURIComponent(key.trim())}`, {
        method: 'PUT',
        body: { value: value.trim() },
      });
      setNotice({ tone: 'success', text: 'Setting saved.' });
      setKey('');
      setValue('');
      settings.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to save setting',
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(k: string) {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/admin/settings/${encodeURIComponent(k)}`, {
        method: 'PUT',
        body: { value: editValue },
      });
      setNotice({ tone: 'success', text: 'Setting updated.' });
      setEditing(null);
      settings.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to update setting',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="System settings"
        description="Manage platform-wide configuration values."
      />
      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Key" htmlFor="setting-key">
            <input
              id="setting-key"
              className={inputClass}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="maintenance_mode"
            />
          </Field>
          <Field label="Value" htmlFor="setting-value">
            <input
              id="setting-value"
              className={inputClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="false"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className={buttonStyles('primary', 'sm')}
              disabled={busy}
              onClick={() => void saveNew()}
            >
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </div>
      </Card>

      {settings.loading && (
        <div className="mt-4">
          <LoadingBlock label="Loading settings…" />
        </div>
      )}
      {settings.error && (
        <div className="mt-4">
          <Alert tone="error">{settings.error}</Alert>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {settings.data?.map((setting) => (
          <Card key={setting.key} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{setting.key}</p>
                {editing === setting.key ? (
                  <input
                    className={`${inputClass} mt-2`}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-600">{setting.value}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Updated {formatDateTime(setting.updatedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {editing === setting.key ? (
                  <>
                    <button
                      type="button"
                      className={buttonStyles('primary', 'sm')}
                      disabled={busy}
                      onClick={() => void saveEdit(setting.key)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={buttonStyles('ghost', 'sm')}
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={buttonStyles('secondary', 'sm')}
                    onClick={() => {
                      setEditing(setting.key);
                      setEditValue(setting.value);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
