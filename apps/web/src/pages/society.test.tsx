import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: state.api }));
vi.mock('../lib/auth.js', () => ({ useAuth: state.useAuth }));

import { SocietyPage } from './society.js';

const category = { id: 'cat-1', name: 'Catering', slug: 'catering' };

function request(id: string, status: string, title: string) {
  return {
    id,
    reference: `EB-R-${id}`,
    title,
    status,
    category,
    event: null,
    society: { id: 'soc-1', name: 'Test Society', institution: 'Test University' },
    budgetMin: null,
    budgetMax: null,
    responseDeadline: null,
    invitationCount: 1,
    quotationCount: 1,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
  };
}

const requests = [
  request('req-open', 'partially_quoted', 'Open catering request'),
  request('req-selected', 'selected', 'Selected catering request'),
  request('req-completed', 'completed', 'Completed catering request'),
];

const paginated = {
  items: requests,
  pagination: { page: 1, pageSize: 50, total: requests.length, totalPages: 1 },
};

function cardFor(title: string): HTMLElement {
  // The dashboard also lists pending requests in the profile section; the
  // first heading is the one in the main "Your requests" list.
  const heading = screen.getAllByRole('heading', { name: title })[0];
  const card = heading?.closest('.rounded-2xl');
  if (!(card instanceof HTMLElement)) throw new Error(`Card not found for ${title}`);
  return card;
}

describe('SocietyPage lifecycle actions', () => {
  beforeEach(() => {
    state.api.mockReset();
    state.useAuth.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Society User',
        email: 'society@example.com',
        role: 'society',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      profile: null,
      loading: false,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });

    state.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/requests?pageSize')) return paginated;
      if (path === '/categories') return [];
      if (path === '/societies/me') {
        return {
          id: 'soc-1',
          name: 'Test Society',
          institution: 'Test University',
          contactPerson: 'Society User',
          contactEmail: 'society@example.com',
          contactPhone: null,
          description: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          account: { id: 'user-1', name: 'Society User', email: 'society@example.com' },
        };
      }
      if (path.endsWith('/close-quoting') || path.endsWith('/complete')) {
        return {
          ...requests.find(
            (item) => `/requests/${item.id}` === path.replace(/\/(close-quoting|complete)$/, ''),
          ),
        };
      }
      return { data: {} };
    });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <SocietyPage />
      </MemoryRouter>,
    );
  }

  it('offers Start review only while quotations are still being collected', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(cardFor('Open catering request')).toBeInTheDocument());
    expect(
      within(cardFor('Open catering request')).queryByRole('button', { name: 'Leave a review' }),
    ).not.toBeInTheDocument();

    await user.click(
      within(cardFor('Open catering request')).getByRole('button', { name: 'Start review' }),
    );

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/requests/req-open/close-quoting', {
        method: 'POST',
      });
    });
    expect(await screen.findByText('Quotation review is now open.')).toBeInTheDocument();
  });

  it('offers completion for selected requests and reviews only after completion', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(cardFor('Selected catering request')).toBeInTheDocument());
    expect(
      within(cardFor('Completed catering request')).getByRole('button', { name: 'Leave a review' }),
    ).toBeInTheDocument();
    expect(
      within(cardFor('Selected catering request')).queryByRole('button', {
        name: 'Leave a review',
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(cardFor('Selected catering request')).getByRole('button', {
        name: 'Mark as completed',
      }),
    );

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/requests/req-selected/complete', { method: 'POST' });
    });
    expect(await screen.findByText('Engagement marked as completed.')).toBeInTheDocument();
  });
});
