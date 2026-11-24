import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  register: vi.fn(),
  api: vi.fn(),
}));

vi.mock('../lib/auth.js', () => ({
  useAuth: () => ({ register: state.register }),
}));

vi.mock('../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.js')>();
  return { ...actual, api: state.api };
});

import { ApiError } from '../lib/api.js';
import { RegisterPage } from './register.js';

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

async function fillSociety(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText('Full name'), 'Ayesha Khan');
  await user.type(screen.getByLabelText('Email'), 'ayesha@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Society name'), 'Computing Society');
  await user.type(screen.getByLabelText('Institution'), 'University of Lahore');
  await user.type(screen.getByLabelText('Contact person'), 'Ayesha Khan');
}

describe('RegisterPage', () => {
  beforeEach(() => {
    state.api.mockReset();
    state.api.mockResolvedValue([]);
    state.register.mockReset();
  });

  it('shows a clear message instead of submitting an invalid password', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillSociety(user, 'password');

    await user.click(screen.getByRole('button', { name: 'Create society account' }));

    expect(await screen.findByText(/Password must be at least 8 characters/)).toBeInTheDocument();
    expect(state.register).not.toHaveBeenCalled();
  });

  it('shows field-level details returned by the API', async () => {
    const user = userEvent.setup();
    state.register.mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', [
        { path: 'society.contactPhone', message: 'Enter a valid phone number' },
      ]),
    );
    renderPage();
    await fillSociety(user, 'Society123!');

    await user.click(screen.getByRole('button', { name: 'Create society account' }));

    expect(
      await screen.findByText(/society\.contactPhone: Enter a valid phone number/),
    ).toBeInTheDocument();
  });
});
