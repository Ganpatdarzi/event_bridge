import { useState } from 'react';
import type { FormEvent } from 'react';
import { buttonStyles, Card, Field, inputClass, PageHeader } from '../components/ui.js';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent(`Event Bridge enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name} (${email})`);
    window.location.href = `mailto:hello@eventbridge.test?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Contact us"
        title="Get in touch"
        description="Questions about the platform, partnerships or support? Send us a message."
      />

      <Card className="mt-8 p-6">
        {sent ? (
          <div className="text-sm text-slate-600">
            Your email client should have opened with the message. If not, email us directly at{' '}
            <a className="font-semibold text-brand" href="mailto:hello@eventbridge.test">
              hello@eventbridge.test
            </a>
            .
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Name" htmlFor="contact-name">
              <input
                id="contact-name"
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <input
                id="contact-email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Message" htmlFor="contact-message">
              <textarea
                id="contact-message"
                rows={5}
                className={inputClass}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
              />
            </Field>
            <button type="submit" className={buttonStyles('primary', 'md')}>
              Send message
            </button>
          </form>
        )}
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p>
          <p className="mt-2 text-sm font-medium text-slate-900">hello@eventbridge.test</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Support hours</p>
          <p className="mt-2 text-sm font-medium text-slate-900">Mon–Fri, 9am–5pm</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Location</p>
          <p className="mt-2 text-sm font-medium text-slate-900">University campus</p>
        </Card>
      </div>
    </div>
  );
}
