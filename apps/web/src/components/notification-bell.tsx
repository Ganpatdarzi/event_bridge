import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type NotificationItem, type NotificationsPage } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { formatDateTime, humanize } from '../lib/format.js';
import { dashboardPath } from '../lib/roles.js';
import { cx, Spinner } from './ui.js';

const PAGE_SIZE = 8;
const POLL_MS = 30_000;

/** Older notification links pointed at a route that never existed. */
function safeLink(link: string | null, role: string | undefined): string {
  if (!link) return dashboardPath(role);
  if (link.startsWith('/vendor/requests')) return '/vendor';
  return link.startsWith('/') ? link : dashboardPath(role);
}

/** Keep proxy/restart noise out of the UI. */
function friendlyError(caught: unknown): string {
  const unreachable =
    'The API is not reachable right now. It may be restarting — try again in a moment.';

  if (caught instanceof ApiError) {
    if (caught.status === 502 || caught.status === 503 || caught.status === 504) {
      return unreachable;
    }
    return caught.message;
  }

  if (caught instanceof TypeError) return unreachable;
  if (caught instanceof Error && caught.message) return caught.message;
  return 'Unable to load notifications';
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const data = await api<NotificationsPage>(`/notifications?pageSize=${PAGE_SIZE}`);
      if (!mounted.current) return;
      setItems(data.items);
      setUnread(data.unreadCount);
      setError(null);
    } catch (caught) {
      if (!mounted.current) return;
      setError(friendlyError(caught));
    }
  }, [user]);

  useEffect(() => {
    mounted.current = true;

    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }

    setLoading(true);
    void load().finally(() => {
      if (mounted.current) setLoading(false);
    });

    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [user, load]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!user) return null;

  async function refresh() {
    setLoading(true);
    await load();
    if (mounted.current) setLoading(false);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await api(`/notifications/${item.id}/read`, { method: 'POST' });
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
          ),
        );
        setUnread((count) => Math.max(0, count - 1));
      } catch {
        // A read-receipt failure should not stop the user from opening the link.
      }
    }

    setOpen(false);
    navigate(safeLink(item.link, user?.role));
  }

  async function markAllRead() {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      const now = new Date().toISOString();
      setItems((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt ?? now })));
      setUnread(0);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  }

  const summary = error
    ? 'Couldn’t refresh'
    : unread > 0
      ? `${unread} unread`
      : loading
        ? 'Checking for updates…'
        : 'You are all caught up';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void toggleOpen()}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.7 21a2 2 0 0 1-3.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:mt-2 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">{summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!error && unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                <Spinner className="h-4 w-4 text-brand" />
                Loading notifications…
              </div>
            )}

            {!loading && error && (
              <div className="px-4 py-5">
                <p className="text-sm font-semibold text-slate-900">Couldn’t load notifications</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-3 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
            )}

            {!loading &&
              !error &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={cx(
                    'flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50',
                    !item.readAt && 'bg-teal-50/50',
                  )}
                >
                  <span
                    className={cx(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      item.readAt ? 'bg-slate-300' : 'bg-brand',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    {item.body && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                        {item.body}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-slate-400">
                      {formatDateTime(item.createdAt)} · {humanize(item.type)}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
