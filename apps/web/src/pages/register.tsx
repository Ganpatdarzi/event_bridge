import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { api, ApiError, type Category } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { Alert, buttonStyles, Field, inputClass } from '../components/ui.js';
import { Logo } from '../app/shell.js';
import { dashboardPath } from '../lib/roles.js';

type Role = 'society' | 'vendor';

interface AccountInput {
  name: string;
  email: string;
  password: string;
}

interface SocietyInput {
  societyName: string;
  institution: string;
  contactPerson: string;
  contactPhone: string;
  description: string;
}

interface VendorInput {
  businessName: string;
  description: string;
  city: string;
  serviceArea: string;
  contactPerson: string;
  contactPhone: string;
}

const PASSWORD_ISSUE =
  'Password must be at least 8 characters, with at least one letter and one number.';

/** Mirror the API rules so common input mistakes never become a silent submit. */
function registrationIssues(
  role: Role,
  account: AccountInput,
  society: SocietyInput,
  vendor: VendorInput,
): string[] {
  const issues: string[] = [];

  if (account.name.trim().length < 2) issues.push('Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(account.email)) {
    issues.push('Enter a valid email address.');
  }
  if (
    account.password.length < 8 ||
    account.password.length > 128 ||
    !/[A-Za-z]/.test(account.password) ||
    !/[0-9]/.test(account.password)
  ) {
    issues.push(PASSWORD_ISSUE);
  }

  if (role === 'society') {
    if (society.societyName.trim().length < 2) issues.push('Enter the society name.');
    if (society.institution.trim().length < 2) issues.push('Enter the institution.');
    if (society.contactPerson.trim().length < 2) issues.push('Enter a contact person.');
  } else {
    if (vendor.businessName.trim().length < 2) issues.push('Enter the business name.');
    if (vendor.description.trim().length < 20) {
      issues.push('Describe your business in at least 20 characters.');
    }
    if (vendor.city.trim().length < 2) issues.push('Enter the city.');
  }

  const phone = role === 'society' ? society.contactPhone : vendor.contactPhone;
  if (phone.trim() && phone.trim().length < 7) {
    issues.push('Enter a contact phone with at least 7 characters.');
  }

  return issues;
}

/** Surface the API's field-level validation details instead of a blank form. */
function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    const details = error.details as Array<{ path?: string; message?: string }>;
    const messages = details
      .map((detail) => {
        const message = detail.message ?? 'Invalid value';
        return detail.path ? `${detail.path}: ${message}` : message;
      })
      .filter((message) => message.length > 0);
    if (messages.length > 0) return `Please check: ${messages.join('; ')}`;
  }

  return error instanceof Error ? error.message : 'Unable to create the account';
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);

  const [role, setRole] = useState<Role>('society');
  const [account, setAccount] = useState({ name: '', email: '', password: '' });
  const [society, setSociety] = useState({
    societyName: '',
    institution: '',
    contactPerson: '',
    contactPhone: '',
    description: '',
  });
  const [vendor, setVendor] = useState({
    businessName: '',
    description: '',
    city: '',
    serviceArea: '',
    contactPerson: '',
    contactPhone: '',
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleCategory(id: string) {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const base = {
      name: account.name.trim(),
      email: account.email.trim(),
      password: account.password,
    };

    const body =
      role === 'society'
        ? {
            role,
            ...base,
            society: {
              societyName: society.societyName.trim(),
              institution: society.institution.trim(),
              contactPerson: society.contactPerson.trim(),
              ...(society.contactPhone.trim() ? { contactPhone: society.contactPhone.trim() } : {}),
              ...(society.description.trim() ? { description: society.description.trim() } : {}),
            },
          }
        : {
            role,
            ...base,
            vendor: {
              businessName: vendor.businessName.trim(),
              description: vendor.description.trim(),
              city: vendor.city.trim(),
              ...(vendor.serviceArea.trim() ? { serviceArea: vendor.serviceArea.trim() } : {}),
              ...(vendor.contactPerson.trim()
                ? { contactPerson: vendor.contactPerson.trim() }
                : {}),
              ...(vendor.contactPhone.trim() ? { contactPhone: vendor.contactPhone.trim() } : {}),
              ...(categoryIds.length ? { categoryIds } : {}),
            },
          };

    const issues = registrationIssues(role, base, society, vendor);
    if (issues.length > 0) {
      setError(issues.join(' '));
      setSubmitting(false);
      return;
    }

    try {
      const user = await register(body, base.email, base.password);
      navigate(dashboardPath(user.role), { replace: true });
    } catch (caught) {
      setError(registrationErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.85fr_1.4fr] lg:py-16">
      <aside className="order-2 h-fit overflow-hidden rounded-3xl bg-slate-900 p-8 text-white lg:order-1 lg:sticky lg:top-24">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-bold">Event Bridge</span>
        </div>

        <h1 className="mt-10 text-3xl font-bold leading-tight">
          {role === 'society' ? 'Find the right vendors, faster' : 'Get discovered by societies'}
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          {role === 'society'
            ? 'Publish one request and receive structured quotations from verified vendors in the category you need.'
            : 'Join the directory, receive matching requests and send quotations from one dashboard.'}
        </p>

        <ul className="mt-8 space-y-3 text-sm text-slate-300">
          {role === 'society' ? (
            <>
              <Check>Free to register and publish requests</Check>
              <Check>Compare quotes side by side</Check>
              <Check>Only verified vendors can respond</Check>
            </>
          ) : (
            <>
              <Check>Requests matched to your categories</Check>
              <Check>Admin-reviewed verification badge</Check>
              <Check>One place to manage every opportunity</Check>
            </>
          )}
        </ul>

        <p className="mt-8 border-t border-white/10 pt-5 text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-teal-300 hover:underline">
            Sign in
          </Link>
        </p>
      </aside>

      <div className="order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
            <p className="mt-1 text-sm text-slate-500">Choose how you will use Event Bridge.</p>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(['society', 'vendor'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                  role === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
                aria-pressed={role === option}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="register-name">
              <input
                id="register-name"
                required
                className={inputClass}
                value={account.name}
                onChange={(event) => setAccount({ ...account, name: event.target.value })}
                placeholder="Ayesha Khan"
              />
            </Field>
            <Field label="Email" htmlFor="register-email">
              <input
                id="register-email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                value={account.email}
                onChange={(event) => setAccount({ ...account, email: event.target.value })}
                placeholder="you@university.edu"
              />
            </Field>
          </div>

          <Field
            label="Password"
            htmlFor="register-password"
            hint="At least 8 characters, with at least one letter and one number."
          >
            <input
              id="register-password"
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={account.password}
              onChange={(event) => setAccount({ ...account, password: event.target.value })}
              placeholder="••••••••"
            />
          </Field>

          {role === 'society' ? (
            <div className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-5">
              <p className="text-sm font-semibold text-slate-900">Society profile</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Society name" htmlFor="society-name">
                  <input
                    id="society-name"
                    required
                    className={inputClass}
                    value={society.societyName}
                    onChange={(event) =>
                      setSociety({ ...society, societyName: event.target.value })
                    }
                    placeholder="Computing Society"
                  />
                </Field>
                <Field label="Institution" htmlFor="society-institution">
                  <input
                    id="society-institution"
                    required
                    className={inputClass}
                    value={society.institution}
                    onChange={(event) =>
                      setSociety({ ...society, institution: event.target.value })
                    }
                    placeholder="University of Lahore"
                  />
                </Field>
                <Field label="Contact person" htmlFor="society-contact">
                  <input
                    id="society-contact"
                    required
                    className={inputClass}
                    value={society.contactPerson}
                    onChange={(event) =>
                      setSociety({ ...society, contactPerson: event.target.value })
                    }
                    placeholder="Ayesha Khan"
                  />
                </Field>
                <Field label="Contact phone" htmlFor="society-phone">
                  <input
                    id="society-phone"
                    className={inputClass}
                    value={society.contactPhone}
                    onChange={(event) =>
                      setSociety({ ...society, contactPhone: event.target.value })
                    }
                    placeholder="+92 300 0000000"
                  />
                </Field>
              </div>
              <Field label="About the society" htmlFor="society-description">
                <textarea
                  id="society-description"
                  rows={3}
                  className={inputClass}
                  value={society.description}
                  onChange={(event) => setSociety({ ...society, description: event.target.value })}
                  placeholder="What kind of events do you run?"
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl bg-slate-50 p-4 sm:p-5">
              <p className="text-sm font-semibold text-slate-900">Business profile</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" htmlFor="vendor-name">
                  <input
                    id="vendor-name"
                    required
                    className={inputClass}
                    value={vendor.businessName}
                    onChange={(event) => setVendor({ ...vendor, businessName: event.target.value })}
                    placeholder="Campus Bites"
                  />
                </Field>
                <Field label="City" htmlFor="vendor-city">
                  <input
                    id="vendor-city"
                    required
                    className={inputClass}
                    value={vendor.city}
                    onChange={(event) => setVendor({ ...vendor, city: event.target.value })}
                    placeholder="Lahore"
                  />
                </Field>
                <Field label="Contact person" htmlFor="vendor-contact">
                  <input
                    id="vendor-contact"
                    className={inputClass}
                    value={vendor.contactPerson}
                    onChange={(event) =>
                      setVendor({ ...vendor, contactPerson: event.target.value })
                    }
                    placeholder="Defaults to your name"
                  />
                </Field>
                <Field label="Contact phone" htmlFor="vendor-phone">
                  <input
                    id="vendor-phone"
                    className={inputClass}
                    value={vendor.contactPhone}
                    onChange={(event) => setVendor({ ...vendor, contactPhone: event.target.value })}
                    placeholder="+92 300 0000000"
                  />
                </Field>
              </div>
              <Field
                label="Service area"
                htmlFor="vendor-area"
                hint="Optional. Cities or regions you cover."
              >
                <input
                  id="vendor-area"
                  className={inputClass}
                  value={vendor.serviceArea}
                  onChange={(event) => setVendor({ ...vendor, serviceArea: event.target.value })}
                  placeholder="Lahore, Kasur, Sheikhupura"
                />
              </Field>
              <Field
                label="Business description"
                htmlFor="vendor-description"
                hint="At least 20 characters. Shown on your public listing after approval."
              >
                <textarea
                  id="vendor-description"
                  required
                  rows={4}
                  className={inputClass}
                  value={vendor.description}
                  onChange={(event) => setVendor({ ...vendor, description: event.target.value })}
                  placeholder="Describe your services, experience and what makes you a good fit."
                />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Service categories</p>
                <div className="flex flex-wrap gap-2">
                  {(categories.data ?? []).map((category) => {
                    const selected = categoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleCategory(category.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-brand bg-teal-50 text-brand'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                  {!categories.loading && (categories.data ?? []).length === 0 && (
                    <span className="text-sm text-slate-500">
                      Categories are unavailable right now.
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  You can update these later from your vendor dashboard.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            className={`${buttonStyles('primary', 'md')} w-full`}
            disabled={submitting}
          >
            {submitting
              ? 'Creating account…'
              : role === 'society'
                ? 'Create society account'
                : 'Apply as a vendor'}
          </button>

          {role === 'vendor' && (
            <p className="text-center text-xs text-slate-500">
              Vendor accounts are reviewed by an administrator before appearing in the directory.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg
        viewBox="0 0 20 20"
        className="mt-0.5 h-4 w-4 shrink-0 text-teal-400"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
          clipRule="evenodd"
        />
      </svg>
      {children}
    </li>
  );
}
