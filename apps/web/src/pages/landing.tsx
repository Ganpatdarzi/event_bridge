import { Link } from 'react-router-dom';
import { api, type Category, type Paginated, type VendorSummary } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { Badge, buttonStyles, Card, StatusBadge } from '../components/ui.js';
import { VendorCard } from '../components/vendor-card.js';

const sampleQuotes = [
  { vendor: 'Lahore Event Caterers', price: 'Rs 85,000', note: 'Full buffet · 150 guests' },
  { vendor: 'Campus Bites', price: 'Rs 72,500', note: 'Live counters · 150 guests', best: true },
  { vendor: 'Grand Hall Catering', price: 'Rs 91,000', note: '3-course meal · 150 guests' },
];

const steps = [
  {
    title: 'Describe the event once',
    body: 'Pick a category, set the date, budget and requirements. No more copy-pasting messages to ten vendors.',
  },
  {
    title: 'Matched vendors respond',
    body: 'Verified vendors in that category receive the request and submit structured quotations.',
  },
  {
    title: 'Compare and select',
    body: 'See price, scope, inclusions and validity side by side, then record the winning quote.',
  },
];

export function LandingPage() {
  const categories = useApiQuery(() => api<Category[]>('/categories', { auth: false }), []);
  const vendors = useApiQuery(
    () => api<Paginated<VendorSummary>>('/vendors?pageSize=3', { auth: false }),
    [],
  );

  const vendorCount = vendors.data?.pagination.total;
  const categoryList = categories.data ?? [];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-teal-50 via-white to-slate-50" />
        <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <Badge tone="brand">Multi-vendor event marketplace</Badge>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              One request.
              <br />
              Multiple quotes.
              <br />
              <span className="text-brand">One place to compare.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Event Bridge lets university societies send a single service request to every relevant
              vendor, then compare structured quotations side by side.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className={buttonStyles('primary', 'lg')}>
                Get started free
              </Link>
              <Link to="/vendors" className={buttonStyles('secondary', 'lg')}>
                Browse vendors
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Dot /> Free for societies
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> Verified vendors only
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> Structured quotations
              </span>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative">
            <Card className="rotate-1 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Request RFQ-2026-014
                  </p>
                  <h2 className="mt-1 text-base font-bold text-slate-900">
                    Catering · Global Fest 2026
                  </h2>
                </div>
                <StatusBadge status="quoted" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-1">12 Mar 2026</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">150 guests</span>
                <span className="rounded-md bg-slate-100 px-2 py-1">Rs 70k – 95k</span>
              </div>

              <div className="mt-5 space-y-2">
                {sampleQuotes.map((quote) => (
                  <div
                    key={quote.vendor}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                      quote.best ? 'border-brand bg-teal-50/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{quote.vendor}</p>
                      <p className="text-xs text-slate-500">{quote.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{quote.price}</p>
                      {quote.best && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-brand">
                          Best value
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="absolute -bottom-6 -left-4 hidden w-44 p-4 shadow-lg sm:block">
              <p className="text-2xl font-bold text-slate-900">3</p>
              <p className="text-xs font-medium text-slate-500">quotes to compare</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-slate-200 px-4 sm:px-6 lg:grid-cols-4">
          <StripStat label="Service categories" value={categoryList.length || '4'} />
          <StripStat label="Verified vendors" value={vendorCount ?? '—'} />
          <StripStat label="Quotes per request" value="Many" />
          <StripStat label="Cost to societies" value="Free" />
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Categories</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Everything an event needs
            </h2>
            <p className="mt-2 max-w-xl text-slate-600">
              Requests are routed to vendors by category, so the right businesses see the right
              opportunities.
            </p>
          </div>
          <Link to="/vendors" className={buttonStyles('secondary', 'sm')}>
            Explore directory
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(categoryList.length ? categoryList : fallbackCategories).map((category) => (
            <Card key={category.id ?? category.slug} className="p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                {category.name.slice(0, 1)}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{category.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {category.description ?? 'Verified vendors in this category.'}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              From request to decision in three steps
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured vendors */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Directory</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Verified vendors, ready to quote
            </h2>
          </div>
          <Link to="/vendors" className={buttonStyles('secondary', 'sm')}>
            View all vendors
          </Link>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.loading &&
            [0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200"
              />
            ))}

          {!vendors.loading && vendors.data?.items.length === 0 && (
            <Card className="p-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
              No vendors have been verified yet. Check back soon.
            </Card>
          )}

          {vendors.data?.items.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Stop chasing quotes in DMs
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Register your society, publish one request, and let verified vendors come to you.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className={buttonStyles('white', 'lg')}>
              Create an account
            </Link>
            <Link to="/vendors" className={buttonStyles('ghost', 'lg')}>
              <span className="text-slate-200">Browse the directory</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StripStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white px-4 py-6 text-center sm:px-6">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />;
}

const fallbackCategories: Category[] = [
  {
    id: 'catering',
    name: 'Catering',
    slug: 'catering',
    description: 'Food and beverage for events of any size.',
  },
  {
    id: 'decoration',
    name: 'Decoration',
    slug: 'decoration',
    description: 'Stage, venue and table decoration.',
  },
  {
    id: 'av',
    name: 'Sound, Lighting & AV',
    slug: 'sound-lighting-av',
    description: 'Sound, lighting and audiovisual support.',
  },
  {
    id: 'photography',
    name: 'Photography',
    slug: 'photography',
    description: 'Event photography and videography.',
  },
];
