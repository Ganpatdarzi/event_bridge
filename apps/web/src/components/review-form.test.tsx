import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: state.api }));

import { ReviewForm } from './review-form.js';

describe('ReviewForm', () => {
  beforeEach(() => {
    state.api.mockReset();
  });

  it('submits the selected rating and trimmed comment', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onCancel = vi.fn();
    state.api.mockResolvedValue({ data: {} });

    render(<ReviewForm requestId="request-1" onDone={onDone} onCancel={onCancel} />);

    await user.selectOptions(screen.getByLabelText('Rating'), '4');
    await user.type(screen.getByLabelText('Comment'), '  Great vendor.  ');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/requests/request-1/review', {
        method: 'POST',
        body: { rating: 4, comment: 'Great vendor.' },
      });
    });
    expect(onDone).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('shows an API error without closing the form', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    state.api.mockRejectedValue(new Error('Reviews require a completed engagement'));

    render(<ReviewForm requestId="request-1" onDone={onDone} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Reviews require a completed engagement')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
