import { Link, Route, Routes } from 'react-router-dom';
import { App } from '../App.js';

interface RolePageProps {
  title: string;
  description: string;
}

function RolePage({ title, description }: RolePageProps) {
  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Event Bridge</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
        <p>
          <Link className="nav-btn" to="/">
            ← Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route
        path="/society"
        element={
          <RolePage
            title="Society dashboard"
            description="Create service requests, compare vendor quotations and record a selection."
          />
        }
      />
      <Route
        path="/vendor"
        element={
          <RolePage
            title="Vendor dashboard"
            description="Browse eligible requests, submit structured quotations and manage your portfolio."
          />
        }
      />
      <Route
        path="/admin"
        element={
          <RolePage
            title="Admin dashboard"
            description="Review vendor applications, manage categories and administer accounts."
          />
        }
      />
      <Route
        path="*"
        element={
          <RolePage title="Page not found" description="The page you requested does not exist." />
        }
      />
    </Routes>
  );
}
