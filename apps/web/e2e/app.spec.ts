import { expect, test, type Page } from '@playwright/test';

const category = { id: 'cat-1', name: 'Catering', slug: 'catering' };

const user = {
  id: 'user-1',
  name: 'Society User',
  email: 'society@eventbridge.test',
  role: 'society',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const request = {
  id: 'req-1',
  reference: 'EB-R-0001',
  title: 'Catering for E2E Gala',
  status: 'quoted',
  category,
  event: {
    id: 'event-1',
    name: 'E2E Gala',
    eventDate: '2026-12-12',
    location: 'Karachi Expo Centre',
    expectedAttendance: 150,
  },
  society: { id: 'soc-1', name: 'Test Society', institution: 'Test University' },
  budgetMin: 80_000,
  budgetMax: 120_000,
  responseDeadline: '2026-11-30T17:00:00.000Z',
  invitationCount: 2,
  quotationCount: 2,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

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
  requestId: 'req-1',
  vendor,
  totalPrice: 100_000,
  currency: 'PKR',
  description: 'Full catering service for the gala.',
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

const comparison = {
  requestId: 'req-1',
  request: {
    id: 'req-1',
    title: 'Catering for E2E Gala',
    status: 'quoted',
    budgetMin: 80_000,
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
  summary: { count: 2, lowestTotal: 95_000, highestTotal: 105_000, averageTotal: 100_000 },
};

/** Serve deterministic API responses so the E2E suite needs no database. */
async function mockApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    let status = 200;
    let body: unknown = { data: {} };

    if (path === '/api/v1/auth/refresh') {
      status = 401;
      body = { error: { code: 'UNAUTHORIZED', message: 'No session' } };
    } else if (path === '/api/v1/auth/login') {
      body = {
        data: {
          accessToken: 'e2e-access-token',
          user,
          profile: {
            type: 'society',
            id: 'soc-1',
            name: 'Test Society',
            institution: 'Test University',
          },
        },
      };
    } else if (path === '/api/v1/categories') {
      body = { data: [category] };
    } else if (path === '/api/v1/vendors') {
      body = {
        data: {
          items: [
            {
              id: 'vendor-a',
              businessName: vendor.businessName,
              description: 'Catering for campus events.',
              city: vendor.city,
              serviceArea: vendor.serviceArea,
              verifiedAt: '2026-01-01T00:00:00.000Z',
              categories: [category],
              rating: { average: 4.8, count: 12 },
            },
          ],
          pagination: { page: 1, pageSize: 3, total: 1, totalPages: 1 },
        },
      };
    } else if (path === '/api/v1/notifications') {
      body = {
        data: {
          items: [],
          unreadCount: 0,
          pagination: { page: 1, pageSize: 8, total: 0, totalPages: 1 },
        },
      };
    } else if (path === '/api/v1/societies/me') {
      body = {
        data: {
          id: 'soc-1',
          name: 'Test Society',
          institution: 'Test University',
          contactPerson: 'Society User',
          contactEmail: 'society@eventbridge.test',
          contactPhone: null,
          description: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          account: { id: user.id, name: user.name, email: user.email },
        },
      };
    } else if (path.startsWith('/api/v1/requests/') && path.endsWith('/compare')) {
      body = { data: comparison };
    } else if (path.startsWith('/api/v1/requests/') && path.includes('/quotations')) {
      body = {
        data: {
          requestId: 'req-1',
          items: [quotation, { ...quotation, id: 'quote-b', reference: 'Q-BBBB222' }],
          pagination: { page: 1, pageSize: 50, total: 2, totalPages: 1 },
        },
      };
    } else if (path.startsWith('/api/v1/requests') && path.endsWith('/select')) {
      body = { data: request };
    } else if (path.startsWith('/api/v1/requests')) {
      body = {
        data: {
          items: [request],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      };
    }

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('landing page loads and links to the vendor directory', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /One request/ })).toBeVisible();
  await page.getByRole('link', { name: 'Browse vendors' }).first().click();

  await expect(page).toHaveURL(/\/vendors$/);
  await expect(page.getByText('Vendor A Catering').first()).toBeVisible();
});

test('society can sign in and compare quotations side by side', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('society@eventbridge.test');
  await page.getByLabel('Password').fill('Society123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back, Society' })).toBeVisible();
  await page.getByRole('button', { name: 'Review applications' }).click();
  await page.getByRole('button', { name: 'Compare side by side' }).click();

  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'With extras' })).toBeVisible();
  await expect(table.getByText('Vendor A Catering')).toBeVisible();
  await expect(table.getByText('Vendor B Catering')).toBeVisible();
});

test('layout and navigation adapt to the viewport', async ({ page }) => {
  await page.goto('/');

  const width = page.viewportSize()!.width;
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width + 1);

  if (width < 768) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    const mobileNav = page.getByRole('navigation', { name: 'Mobile' });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Vendors' })).toBeVisible();
  } else {
    const mainNav = page.getByRole('navigation', { name: 'Main' });
    await expect(mainNav).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Vendors' })).toBeVisible();
  }

  await page.goto('/login');
  if (width < 1024) {
    const formHeading = await page.getByRole('heading', { name: 'Sign in' }).boundingBox();
    const promoHeading = await page
      .getByRole('heading', { name: /Welcome back to the marketplace/ })
      .boundingBox();
    expect(formHeading!.y).toBeLessThan(promoHeading!.y);
  }
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width + 1);
});
