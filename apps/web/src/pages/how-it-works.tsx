import { Link } from 'react-router-dom';
import { buttonStyles, Card, PageHeader } from '../components/ui.js';

const societySteps = [
  {
    title: 'Create your society profile',
    body: 'Register once with your institution and contact details.',
  },
  {
    title: 'Publish a request',
    body: 'Pick a service category, set the date, location, budget and requirements.',
  },
  {
    title: 'Receive quotations',
    body: 'Verified vendors in that category are invited and submit structured quotes.',
  },
  {
    title: 'Compare and select',
    body: 'Review price, scope, inclusions and validity side by side, then select a vendor.',
  },
];

const vendorSteps = [
  {
    title: 'Apply as a vendor',
    body: 'Submit your business profile, categories and service area for admin review.',
  },
  {
    title: 'Get verified',
    body: 'An administrator approves your application before you can receive requests.',
  },
  {
    title: 'Receive matched requests',
    body: 'Requests in your categories land on your dashboard automatically.',
  },
  {
    title: 'Quote and win',
    body: 'Submit a structured quotation. Societies are notified and can review your offer.',
  },
];

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="How it works"
        title="From request to decision in four steps"
        description="Event Bridge keeps both sides of the marketplace on the same page."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold text-slate-900">For societies</h2>
          <div className="mt-4 space-y-3">
            {societySteps.map((step, index) => (
              <Card key={step.title} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">For vendors</h2>
          <div className="mt-4 space-y-3">
            {vendorSteps.map((step, index) => (
              <Card key={step.title} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link to="/register" className={buttonStyles('primary', 'md')}>
          Get started
        </Link>
        <Link to="/vendors" className={buttonStyles('secondary', 'md')}>
          Browse vendors
        </Link>
      </div>
    </div>
  );
}
