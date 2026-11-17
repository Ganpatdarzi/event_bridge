/**
 * Small typed client for the Event Bridge API.
 *
 * The API always answers with either `{ data }` on success or
 * `{ error: { code, message, details? } }` on failure. Authentication uses a
 * short-lived access token (kept here) plus an httpOnly refresh cookie, so a
 * 401 transparently triggers one refresh-and-retry cycle.
 */

const API_BASE = '/api/v1';
const TOKEN_KEY = 'eb_access';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set to false for anonymous endpoints (login, register, directory). */
  auth?: boolean;
}

let accessToken: string | null = null;

try {
  accessToken = localStorage.getItem(TOKEN_KEY);
} catch {
  // Storage can be unavailable (private mode); fall back to memory only.
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const { body, auth = true, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (body !== undefined) finalHeaders.set('content-type', 'application/json');
  if (auth && accessToken) finalHeaders.set('authorization', `Bearer ${accessToken}`);

  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange the refresh cookie for a new access token. Resolves false on failure. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        setAccessToken(null);
        return false;
      }

      const payload = (await readJson(response)) as { data?: { accessToken?: string } } | null;
      const token = payload?.data?.accessToken;
      setAccessToken(token ?? null);
      return Boolean(token);
    })()
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawFetch(path, options);

  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await rawFetch(path, options);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }

  return (payload as { data: T } | null)?.data as T;
}

/* ------------------------------------------------------------------ */
/* Shared response types                                              */
/* ------------------------------------------------------------------ */

export type UserRole = 'society' | 'vendor' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface SessionProfile {
  type: 'society' | 'vendor';
  id: string;
  name: string;
  institution?: string;
  verificationStatus?: string;
}

export interface Session {
  user: PublicUser;
  profile: SessionProfile | null;
}

export interface LoginResult extends Session {
  accessToken: string;
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const result = await api<LoginResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function registerRequest(body: unknown): Promise<PublicUser> {
  const result = await api<{ user: PublicUser }>('/auth/register', {
    method: 'POST',
    body,
    auth: false,
  });
  return result.user;
}

export async function refreshSession(): Promise<Session | null> {
  const refreshed = await refreshAccessToken();
  if (!refreshed) return null;
  return api<Session>('/auth/me');
}

export async function logoutRequest(): Promise<void> {
  try {
    await api<void>('/auth/logout', { method: 'POST', auth: false });
  } finally {
    setAccessToken(null);
  }
}

/* ------------------------------------------------------------------ */
/* Domain types used by the screens                                   */
/* ------------------------------------------------------------------ */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive?: boolean;
  requestCount?: number;
  vendorCount?: number;
}

export interface VendorCategory {
  id: string;
  name: string;
  slug: string;
}

export interface VendorRating {
  average: number | null;
  count: number;
}

export interface VendorSummary {
  id: string;
  businessName: string;
  description: string;
  city: string;
  serviceArea: string | null;
  verifiedAt: string | null;
  categories: VendorCategory[];
  rating: VendorRating;
}

export interface MyVendor extends VendorSummary {
  contactPerson: string | null;
  contactPhone: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  portfolio: PortfolioImage[];
}

export interface PortfolioImage {
  id: string;
  dataUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface RequestListItem {
  id: string;
  reference: string;
  title: string;
  status: string;
  category: VendorCategory;
  event: {
    id: string;
    name: string;
    eventDate: string;
    location: string;
    expectedAttendance: number | null;
  } | null;
  society: { id: string; name: string; institution: string };
  budgetMin: number | null;
  budgetMax: number | null;
  responseDeadline: string | null;
  invitationCount: number;
  quotationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRequestListItem extends RequestListItem {
  distribution: {
    status: 'invited' | 'viewed' | 'responded' | 'declined';
    viewedAt: string | null;
    notifiedAt: string | null;
  };
  hasQuoted: boolean;
}

export interface QuotationVendorSummary {
  id: string;
  businessName: string;
  city: string;
  serviceArea: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string;
}

export interface Quotation {
  id: string;
  reference: string;
  requestId: string;
  vendor: QuotationVendorSummary;
  totalPrice: number;
  currency: string;
  description: string;
  inclusions: string | null;
  exclusions: string | null;
  additionalCharges: number | null;
  availableOnDate: boolean | null;
  validUntil: string | null;
  notes: string | null;
  status: string;
  submittedAt: string;
  updatedAt: string;
}

export interface RequestQuotationsPage extends Paginated<Quotation> {
  requestId: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: NotificationItem[];
  unreadCount: number;
  pagination: PaginationMeta;
}

export interface AdminStats {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  vendors: { total: number; byStatus: Record<string, number> };
  requests: { total: number; byStatus: Record<string, number> };
  categories: { total: number; active: number };
  quotations: { total: number };
}

export interface VendorReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  society: { name: string };
  request: { reference: string; title: string };
}

export interface AdminVendor {
  id: string;
  businessName: string;
  description: string;
  city: string;
  serviceArea: string | null;
  verificationStatus: string;
  rejectionReason: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  createdAt: string;
  categories: VendorCategory[];
  user: { id: string; name: string; email: string; status: string };
}
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  society: { id: string; name: string } | null;
  vendor: { id: string; businessName: string; verificationStatus: string } | null;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  society: { id: string; name: string };
  vendor: { id: string; businessName: string };
  request: { id: string; reference: string; title: string };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface SystemSetting {
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}
