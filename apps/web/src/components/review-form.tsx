import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../lib/api.js';
import { Alert, buttonStyles, Card, Field, inputClass } from './ui.js';

export function ReviewForm({
  requestId,
  onDone,
  onCancel,
}: {
  requestId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/requests/${requestId}/review`, {
        method: 'POST',
        body: { rating, comment: comment.trim() || undefined },
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit your review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <Field label="Rating" htmlFor={`review-rating-${requestId}`}>
          <select
            id={`review-rating-${requestId}`}
            className={inputClass}
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comment" htmlFor={`review-comment-${requestId}`} hint="Optional.">
          <textarea
            id={`review-comment-${requestId}`}
            rows={3}
            className={inputClass}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share your experience with this vendor."
          />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles('primary', 'sm')} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit review'}
          </button>
          <button type="button" className={buttonStyles('ghost', 'sm')} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
