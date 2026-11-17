import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type HealthState =
  | { status: 'loading' }
  | { status: 'online'; uptimeSeconds: number }
  | { status: 'offline'; message: string };

export function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ data: { uptimeSeconds: number } }>;
      })
      .then((payload) => setHealth({ status: 'online', uptimeSeconds: payload.data.uptimeSeconds }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setHealth({ status: 'offline', message: 'API is not running yet' });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Event Bridge</p>
        <h1>One request. Multiple quotes. One place to compare.</h1>
        <p className="lede">
          A multi-vendor marketplace for university society event services. Societies publish a
          single request, verified vendors respond with structured quotations, and everyone compares
          the offers side by side.
        </p>
      </header>

      <section className="card" aria-live="polite">
        <h2>API status</h2>
        {health.status === 'loading' && <p>Checking the API…</p>}
        {health.status === 'online' && (
          <p className="ok">
            API is online · uptime {health.uptimeSeconds}s · <a href="/api/v1">endpoint index</a>
          </p>
        )}
        {health.status === 'offline' && (
          <p className="warn">
            {health.message}. Start it with <code>npm run dev:api</code>.
          </p>
        )}
      </section>

      <nav className="main-nav" aria-label="Primary">
        <Link className="nav-btn" to="/society">
          Society
        </Link>
        <Link className="nav-btn" to="/vendor">
          Vendor
        </Link>
        <Link className="nav-btn" to="/admin">
          Admin
        </Link>
        <a className="nav-btn" href="/api/v1">
          API
        </a>
      </nav>

      <section className="grid">
        <article className="card">
          <h2>Built so far</h2>
          <ul>
            <li>npm workspaces monorepo</li>
            <li>Shared enums, status machines and Zod schemas</li>
            <li>Full Neon/Postgres schema, migrations and seed data</li>
            <li>Register, login, refresh, logout and session endpoints</li>
            <li>Profiles, categories, admin review and request distribution</li>
          </ul>
        </article>

        <article className="card">
          <h2>Next up</h2>
          <ul>
            <li>Quotation submission and comparison</li>
            <li>Preferred / selected quotation recording</li>
            <li>Society, vendor and admin dashboards</li>
            <li>Notifications, reviews and portfolio uploads</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
