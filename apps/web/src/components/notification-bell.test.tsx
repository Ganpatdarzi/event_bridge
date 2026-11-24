import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  api: vi.fn(),
  navigate: vi.fn(),
  user: { id: 'user-1', role: 'society' },
}));

vi.mock('../lib/auth.js', () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => state.navigate };
});

vi.mock('../lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api.js')>();
  return { ...actual, api: state.api };
});

import { NotificationBell } from './notification-bell.js';

const notification = {
  id: 'notification-1',
  type: 'new_quotation',
  title: 'New quotation from Campus Bites',
  body: 'Campus Bites quoted PKR 85,000 for the annual gala.',
  link: '/society',
  readAt: null,
  createdAt: new Date().toISOString(),
};

function bellButton() {
  return screen.getByRole('button', { name: /Notifications/ });
}

function dialog() {
  return screen.queryByRole('dialog', { name: 'Notifications' });
}

describe('NotificationBell', () => {
  beforeEach(() => {
    state.api.mockReset();
    state.navigate.mockReset();
    state.api.mockImplementation(async (path: string) => {
      if (path.startsWith('/notifications?')) {
        return { items: [notification], unreadCount: 1 };
      }
      return {};
    });
  });

  it('stays open until the user dismisses it', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(bellButton());
    expect(await screen.findByText(notification.title)).toBeInTheDocument();

    await user.click(document.body);
    expect(dialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close notifications' }));
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
  });

  it('marks a notification as read and closes after it is checked', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(bellButton());
    await user.click(
      await screen.findByRole('button', { name: /New quotation from Campus Bites/ }),
    );

    await waitFor(() => {
      expect(state.api).toHaveBeenCalledWith('/notifications/notification-1/read', {
        method: 'POST',
      });
    });
    expect(state.navigate).toHaveBeenCalledWith('/society');
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
  });
});
