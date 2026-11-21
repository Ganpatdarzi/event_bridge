import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type VendorHireOption, type VendorHireOptionPage } from '../lib/api.js';
import { useApiQuery } from '../lib/use-api.js';
import { formatDate, formatMoney, humanize } from '../lib/format.js';
import { Alert, Badge, buttonStyles, Card, LoadingBlock, SectionHeading } from './ui.js';
import { HirePanel } from './request-applications.js';

export function VendorHireOptions({
  vendorId,
  vendorName,
}: {
  vendorId: string;
  vendorName: string;
}) {
  const options = useApiQuery(
    () => api<VendorHireOptionPage>(`/bookings/options/${vendorId}`),
    [vendorId],
  );
  const [selecting, setSelecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function select(option: VendorHireOption) {
    setSelecting(option.quotationId);
    setNotice(null);
    try {
      await api(`/requests/${option.requestId}/quotations/${option.quotationId}/select`, {
        method: 'POST',
      });
      setNotice({
        tone: 'success',
        text: `${vendorName} is now selected for ${option.requestTitle}. You can confirm the hire below.`,
      });
      options.reload();
    } catch (caught) {
      setNotice({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'Unable to select this vendor',
      });
    } finally {
      setSelecting(null);
    }
  }

  const items = options.data?.items ?? [];

  return (
    <section className="mt-8">
      <SectionHeading
        title="Select or hire for an event"
        description="Use a quotation from one of your requests to reserve this vendor for a specific time window."
      />

      {notice && (
        <div className="mt-3">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {options.error && (
        <div className="mt-3">
          <Alert tone="error">{options.error}</Alert>
        </div>
      )}

      {options.loading ? (
        <div className="mt-4">
          <LoadingBlock label="Loading your options for this vendor" />
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-4 p-5">
          <p className="text-sm text-slate-600">
            You do not have a quotation from {vendorName} that can be selected or hired yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Publish a request in their category, then their quotation will appear here.
          </p>
          <Link
            to="/society/create"
            className={`${buttonStyles('primary', 'sm')} mt-4 inline-flex`}
          >
            Create a request
          </Link>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((option) => {
            const isSelectedEngagement =
              option.quotationStatus === 'selected' && option.requestStatus === 'selected';

            return (
              <Card key={option.quotationId} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {option.requestReference} · {option.reference}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {option.requestTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {option.eventName ? `${option.eventName} · ` : ''}
                      {option.eventDate ? formatDate(option.eventDate) : 'No event date set'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {formatMoney(option.totalPrice)} {option.currency}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <Badge
                        tone={
                          option.booking?.status === 'confirmed'
                            ? 'emerald'
                            : option.booking?.status === 'completed'
                              ? 'emerald'
                              : 'slate'
                        }
                      >
                        {humanize(option.booking?.status ?? option.quotationStatus)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {option.canSelect && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500">
                      This quotation is ready for a decision.
                    </p>
                    <button
                      type="button"
                      className={buttonStyles('primary', 'sm')}
                      disabled={selecting !== null}
                      onClick={() => void select(option)}
                    >
                      {selecting === option.quotationId ? 'Selecting…' : 'Select this vendor'}
                    </button>
                  </div>
                )}

                {isSelectedEngagement &&
                  (option.booking?.status === 'completed' ? (
                    <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      Engagement completed. Leave a review from your dashboard when you are ready.
                    </p>
                  ) : (
                    <HirePanel
                      target={{
                        quotationId: option.quotationId,
                        vendorId,
                        vendorName,
                      }}
                      booking={option.booking}
                      onBooked={() => {
                        setNotice({ tone: 'success', text: `${vendorName} is now hired.` });
                        options.reload();
                      }}
                    />
                  ))}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
