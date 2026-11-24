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
const vendorUser = {
  ...user,
  id: 'user-2',
  name: 'Vendor User',
  email: 'vendor@eventbridge.test',
  role: 'vendor' as const,
};

const adminUser = {
  ...user,
  id: 'user-3',
  name: 'Admin User',
  email: 'admin@eventbridge.test',
  role: 'admin' as const,
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

const draftRequest = {
  id: 'req-draft',
  reference: 'EB-R-0002',
  title: 'Draft Catering Request',
  status: 'draft',
  category,
  event: {
    id: 'event-draft',
    name: 'Draft Gala',
    eventDate: '2026-12-20',
    location: 'Main Auditorium',
    expectedAttendance: 120,
  },
  society: { id: 'soc-1', name: 'Test Society', institution: 'Test University' },
  description: 'Catering for 120 guests including vegetarian options and dessert.',
  budgetMin: 50_000,
  budgetMax: 90_000,
  quantity: 120,
  responseDeadline: '2026-12-01T17:00:00.000Z',
  invitationCount: 0,
  quotationCount: 0,
  createdAt: '2026-11-21T10:00:00.000Z',
  updatedAt: '2026-11-21T10:00:00.000Z',
  permissions: {
    canEdit: true,
    canSubmit: true,
    canCancel: true,
    canClose: false,
    canViewVendors: true,
  },
  counts: { invitedVendors: 0, quotations: 0 },
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

const hireOption = {
  ...quotation,
  requestReference: 'EB-R-0001',
  requestTitle: 'Catering for E2E Gala',
  eventName: 'E2E Gala',
  eventDate: '2026-12-12',
  quotationStatus: 'selected',
  requestStatus: 'selected',
  canSelect: false,
  canHire: true,
  booking: null,
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
  let currentDraft: typeof draftRequest = { ...draftRequest };

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    let status = 200;
    let body: unknown = { data: {} };

    if (path === '/api/v1/auth/refresh') {
      status = 401;
      body = { error: { code: 'UNAUTHORIZED', message: 'No session' } };
    } else if (path === '/api/v1/auth/login') {
      const { email } = (route.request().postDataJSON() ?? {}) as { email?: string };
      const isVendor = email === vendorUser.email;
      const isAdmin = email === adminUser.email;
      body = {
        data: {
          accessToken: 'e2e-access-token',
          user: isVendor ? vendorUser : isAdmin ? adminUser : user,
          profile: isVendor
            ? {
                type: 'vendor',
                id: vendor.id,
                name: vendor.businessName,
                verificationStatus: 'verified',
              }
            : isAdmin
              ? null
              : {
                  type: 'society',
                  id: 'soc-1',
                  name: 'Test Society',
                  institution: 'Test University',
                },
        },
      };
    } else if (path === '/api/v1/categories') {
      body = { data: [category] };
    } else if (path === '/api/v1/vendors/me') {
      body = {
        data: {
          id: vendor.id,
          businessName: vendor.businessName,
          description: 'Catering for campus events and formal gala dinners.',
          city: vendor.city,
          serviceArea: vendor.serviceArea,
          verifiedAt: '2026-01-01T00:00:00.000Z',
          categories: [category],
          rating: { average: 4.8, count: 12 },
          contactPerson: vendor.contactPerson,
          contactPhone: vendor.contactPhone,
          verificationStatus: 'verified',
          rejectionReason: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          portfolio: [],
        },
      };
    } else if (path === '/api/v1/vendor/requests') {
      body = {
        data: {
          items: [
            {
              ...request,
              distribution: {
                status: 'invited',
                viewedAt: null,
                notifiedAt: '2026-11-20T10:00:00.000Z',
              },
              hasQuoted: false,
            },
          ],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      };
    } else if (path === '/api/v1/quotations/mine') {
      body = {
        data: { items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
      };
    } else if (path === '/api/v1/admin/stats') {
      body = {
        data: {
          users: { total: 3, byRole: { society: 1, vendor: 1, admin: 1 }, byStatus: {} },
          vendors: { total: 1, byStatus: { verified: 1 } },
          requests: { total: 2, byStatus: { open: 1, quoted: 1 } },
          categories: { total: 1, active: 1 },
          quotations: { total: 0 },
        },
      };
    } else if (/^\/api\/v1\/vendors\/[^/]+\/reviews$/.test(path)) {
      body = { data: [] };
    } else if (/^\/api\/v1\/vendors\/[^/]+$/.test(path) && !path.endsWith('/me')) {
      body = {
        data: {
          id: 'vendor-a',
          businessName: vendor.businessName,
          description: 'Catering for campus events and formal gala dinners.',
          city: vendor.city,
          serviceArea: vendor.serviceArea,
          verifiedAt: '2026-01-01T00:00:00.000Z',
          categories: [category],
          rating: { average: 4.8, count: 12 },
          contactPerson: vendor.contactPerson,
          contactPhone: vendor.contactPhone,
          portfolio: [],
        },
      };
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
    } else if (path === '/api/v1/bookings' && route.request().method() === 'POST') {
      body = {
        data: {
          id: 'booking-1',
          requestId: 'req-1',
          quotationId: 'quote-a',
          societyId: 'soc-1',
          vendorId: 'vendor-a',
          status: 'confirmed',
          startsAt: '2030-06-01T10:00:00.000Z',
          endsAt: '2030-06-01T14:00:00.000Z',
          amount: 105_000,
          currency: 'PKR',
          notes: null,
          request: { id: 'req-1', reference: 'EB-R-0001', title: 'Catering for E2E Gala' },
          vendor: { id: 'vendor-a', businessName: 'Vendor A Catering' },
          createdAt: '2026-11-20T10:00:00.000Z',
          updatedAt: '2026-11-20T10:00:00.000Z',
        },
      };
    } else if (path.startsWith('/api/v1/bookings/options/')) {
      body = { data: { vendorId: 'vendor-a', items: [hireOption] } };
    } else if (path.startsWith('/api/v1/bookings/availability/')) {
      body = {
        data: {
          vendorId: 'vendor-a',
          from: '2030-06-01T10:00:00.000Z',
          to: '2030-06-01T14:00:00.000Z',
          available: true,
          busyWindows: [],
        },
      };
    } else if (path === `/api/v1/requests/${draftRequest.id}` && method === 'GET') {
      body = { data: currentDraft };
    } else if (path === `/api/v1/requests/${draftRequest.id}` && method === 'PATCH') {
      const patch = (route.request().postDataJSON() ?? {}) as Partial<typeof draftRequest>;
      currentDraft = {
        ...currentDraft,
        ...patch,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      };
      body = { data: currentDraft };
    } else if (path === `/api/v1/requests/${draftRequest.id}/submit` && method === 'POST') {
      currentDraft = { ...currentDraft, status: 'submitted' };
      body = { data: currentDraft };
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
          items: [request, currentDraft],
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

test('society can reopen, update, and publish a saved draft', async ({ page }) => {
  const calls: { method: string; path: string }[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith(`/api/v1/requests/${draftRequest.id}`)) {
      calls.push({ method: request.method(), path });
    }
  });

  await page.goto('/login');
  await page.getByLabel('Email').fill('society@eventbridge.test');
  await page.getByLabel('Password').fill('Society123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back, Society' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit draft' }).click();

  const expectedDeadline = await page.evaluate(() => {
    const date = new Date('2026-12-01T17:00:00.000Z');
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  });

  await expect(page.getByRole('heading', { name: 'Edit service request' })).toBeVisible();
  await expect(page.getByLabel('Request title')).toHaveValue('Draft Catering Request');
  await expect(page.getByLabel('Event name')).toHaveValue('Draft Gala');
  await expect(page.getByLabel('Quotation deadline')).toHaveValue(expectedDeadline);

  await page.getByLabel('Request title').fill('Updated Draft Catering Request');
  await page.getByLabel('Budget min (PKR)').fill('60000');
  await page.getByRole('button', { name: 'Publish request' }).click();

  await expect(page.getByText('Draft updated and published.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Updated Draft Catering Request' })).toBeVisible();

  expect(calls).toEqual(
    expect.arrayContaining([
      { method: 'GET', path: `/api/v1/requests/${draftRequest.id}` },
      { method: 'PATCH', path: `/api/v1/requests/${draftRequest.id}` },
      { method: 'POST', path: `/api/v1/requests/${draftRequest.id}/submit` },
    ]),
  );
});

test('society can inspect a vendor profile and check availability', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('society@eventbridge.test');
  await page.getByLabel('Password').fill('Society123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back, Society' })).toBeVisible();
  await page.getByRole('button', { name: 'Review applications' }).click();
  await page.getByRole('link', { name: 'View profile' }).first().click();

  await expect(page).toHaveURL(/\/vendors\/vendor-a$/);
  await expect(page.getByRole('heading', { name: 'Vendor A Catering' })).toBeVisible();
  await expect(page.getByText('Catering', { exact: true })).toBeVisible();

  const hireSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Select or hire for an event' }),
  });
  await expect(hireSection.getByText('Catering for E2E Gala')).toBeVisible();
  await expect(hireSection.getByText('Hire this vendor')).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Check availability' }).click();
  await expect(page.getByText('Available for this window')).toBeVisible();

  await hireSection.getByRole('button', { name: 'Confirm hire' }).click();
  await expect(page.getByText('Vendor A Catering is now hired.')).toBeVisible();
});

test('layout and navigation adapt to the viewport', async ({ page }) => {
  await page.goto('/');

  const width = page.viewportSize()!.width;
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width + 1);

  if (width < 768) {
    const menuBox = await page.getByRole('button', { name: 'Open menu' }).boundingBox();
    const logoBox = await page
      .getByRole('img', { name: 'Event Bridge logo' })
      .first()
      .boundingBox();
    expect(menuBox!.x).toBeLessThan(logoBox!.x);

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

test('vendor opens dashboard pages from the header without duplicate tabs', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('vendor@eventbridge.test');
  await page.getByLabel('Password').fill('Vendor123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/vendor$/);

  const isMobile = page.viewportSize()!.width < 768;
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  const nav = page.getByRole('navigation', { name: isMobile ? 'Mobile' : 'Main' });

  for (const label of ['Profile', 'Requests', 'Quotations', 'Reviews', 'Settings']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Requests', exact: true })).toHaveCount(1);

  await nav.getByRole('link', { name: 'Requests', exact: true }).click();
  await expect(page).toHaveURL(/\/vendor\/requests$/);
  await expect(page.getByRole('heading', { name: 'Requests for you' })).toBeVisible();
});

test('admin dashboard has no requests tab', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@eventbridge.test');
  await page.getByLabel('Password').fill('Admin123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.getByRole('button', { name: 'Requests', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Requests', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reviews', exact: true })).toBeVisible();
});
