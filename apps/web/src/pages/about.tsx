import { Link } from 'react-router-dom';
import { buttonStyles, Card, PageHeader } from '../components/ui.js';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="About us"
        title="Built for societies, trusted by vendors"
        description="Event Bridge is a multi-vendor event marketplace for university societies and the businesses that serve them."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Our mission</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            University societies run dozens of events every year, but sourcing vendors still happens
            over WhatsApp threads and email chains. Event Bridge replaces that chaos with one
            structured request that reaches every relevant, verified vendor at once.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Societies compare quotations side by side and record a decision with a full audit trail.
            Vendors get qualified leads instead of cold outreach.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">What we are not</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Event Bridge does not replace a university's procurement or approval authority.
            Selecting a quotation records a preference; it is not a confirmed booking or a payment.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            We also do not handle payments, contracts or logistics. We connect the right people and
            keep the record honest.
          </p>
        </Card>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Our values</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Trust first',
              body: 'Every vendor is reviewed by an administrator before they can quote.',
            },
            {
              title: 'Transparency',
              body: 'Quotations are structured, comparable and auditable.',
            },
            {
              title: 'Fairness',
              body: 'No pay-to-rank. Vendors compete on price and scope.',
            },
          ].map((value) => (
            <Card key={value.title} className="p-5">
              <h3 className="text-base font-semibold text-slate-900">{value.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{value.body}</p>
            </Card>
          ))}
        </div>
      </section>

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
