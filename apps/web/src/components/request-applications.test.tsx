import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: state.api }));

import { RequestApplications } from './request-applications.js';

const vendor = {
  id: 'vendor-a',
  businessName: 'Vendor A Catering',
  city: 'Karachi',
  serviceArea: 'Karachi',
  contactPerson: 'Adil',
  contactPhone: '03001234567',
  contactEmail: 'vendor-a@example.com',
};

const quotation = {
  id: 'quote-a',
  reference: 'Q-AAAA111',
  requestId: 'request-1',
  vendor,
  totalPrice: 100_000,
  currency: 'PKR',
  description: 'Full catering service for the event.',
  inclusions: 'Dinner and refreshments',
  exclusions: null,
  additionalCharges: 5_000,
  availableOnDate: true,
  validUntil: '2026-11-30T17:00:00.000Z',
  notes: null,
  status: 'submitted',
  submittedAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const quotationsPage = {
  requestId: 'request-1',
  items: [quotation, { ...quotation, id: 'quote-b', reference: 'Q-BBBB222' }],
  pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
};

const comparison = {
  requestId: 'request-1',
  request: {
    id: 'request-1',
    title: 'Catering',
    status: 'quoted',
    budgetMin: 90_000,
    budgetMax: 120_000,
    currency: 'PKR',
  },
  items: [
    {
      quotationId: 'quote-a',
      reference: 'Q-AAAA111',
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        city: vendor.city,
        serviceArea: vendor.serviceArea,
      },
      totalPrice: 100_000,
      additionalCharges: 5_000,
      totalWithExtras: 105_000,
      inclusions: 'Dinner and refreshments',
      exclusions: null,
      availableOnDate: true,
      validUntil: '2026-11-30T17:00:00.000Z',
      status: 'submitted',
      submittedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      quotationId: 'quote-b',
      reference: 'Q-BBBB222',
      vendor: {
        id: 'vendor-b',
        businessName: 'Vendor B Catering',
        city: 'Lahore',
        serviceArea: 'Lahore',
      },
      totalPrice: 95_000,
      additionalCharges: 0,
      totalWithExtras: 95_000,
      inclusions: null,
      exclusions: null,
      availableOnDate: false,
      validUntil: null,
      status: 'submitted',
      submittedAt: '2026-11-19T10:00:00.000Z',
    },
  ],
  summary: {
    count: 2,
    lowestTotal: 95_000,
    highestTotal: 105_000,
    averageTotal: 100_000,
  },
};

describe('RequestApplications', () => {
  beforeEach(() => {
    state.api.mockReset();
    state.api.mockImplementation(async (path: string) => {
      if (path.includes('/compare')) return comparison;
      if (path.includes('/quotations?pageSize')) return quotationsPage;
      return { data: {} };
    });
  });

  it('renders the server-generated comparison payload on demand', async () => {
    const user = userEvent.setup();
    render(<RequestApplications requestId="request-1" />);

    expect(await screen.findByText('2 quotations received')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare side by side' }));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'With extras' })).toBeInTheDocument();
    expect(within(table).getByText('Vendor A Catering')).toBeInTheDocument();
    expect(within(table).getByText('Vendor B Catering')).toBeInTheDocument();
    expect(within(table).getByText('2 comparable quotations')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compare side by side' })).not.toBeInTheDocument();
  });

  it('calls the select endpoint and reports success', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RequestApplications requestId="request-1" canSelect onSelect={onSelect} />);

    const buttons = await screen.findAllByRole('button', { name: 'Select this vendor' });
    await user.click(buttons[0] as HTMLElement);

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/requests/request-1/quotations/quote-a/select', {
        method: 'POST',
      });
    });
    expect(await screen.findByText(/Vendor selected/)).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
