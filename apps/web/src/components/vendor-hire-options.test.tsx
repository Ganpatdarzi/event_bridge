import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: state.api }));

import { VendorHireOptions } from './vendor-hire-options.js';

const baseOption = {
  quotationId: 'quote-a',
  reference: 'Q-AAAA111',
  requestId: 'request-1',
  requestReference: 'EB-R-0001',
  requestTitle: 'Catering for the gala',
  eventName: 'Gala',
  eventDate: '2030-06-01',
  totalPrice: 100_000,
  currency: 'PKR',
  quotationStatus: 'submitted',
  requestStatus: 'quoted',
  canSelect: true,
  canHire: false,
  booking: null,
};

function pageWith(option: typeof baseOption) {
  return { vendorId: 'vendor-a', items: [option] };
}

function renderOptions() {
  return render(
    <MemoryRouter>
      <VendorHireOptions vendorId="vendor-a" vendorName="Vendor A Catering" />
    </MemoryRouter>,
  );
}

describe('VendorHireOptions', () => {
  beforeEach(() => {
    state.api.mockReset();
  });

  it('lets a society select this vendor from the profile', async () => {
    const user = userEvent.setup();
    state.api.mockImplementation(async (path: string) => {
      if (path === '/bookings/options/vendor-a') return pageWith(baseOption);
      if (path.includes('/select')) return {};
      return {};
    });

    renderOptions();

    expect(await screen.findByText('Select or hire for an event')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Select this vendor' }));

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/requests/request-1/quotations/quote-a/select', {
        method: 'POST',
      });
    });
    expect(await screen.findByText(/now selected for Catering for the gala/)).toBeInTheDocument();
  });

  it('lets a society hire this vendor from the profile', async () => {
    const user = userEvent.setup();
    state.api.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/bookings/options/vendor-a') {
        return pageWith({
          ...baseOption,
          quotationStatus: 'selected',
          requestStatus: 'selected',
          canSelect: false,
          canHire: true,
        });
      }
      if (path === '/bookings' && options?.method === 'POST') {
        return { id: 'booking-1', status: 'confirmed' };
      }
      return {};
    });

    renderOptions();

    expect(await screen.findByText('Hire this vendor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm hire' }));

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith(
        '/bookings',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ quotationId: 'quote-a' }),
        }),
      );
    });
    expect(await screen.findByText('Vendor A Catering is now hired.')).toBeInTheDocument();
  });
});
