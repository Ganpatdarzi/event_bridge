import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import type { NewUser, User } from './schema/index.js';
import { db } from './index.js';
import { closePool } from './pool.js';
import {
  categories,
  events,
  quotations,
  requestVendors,
  serviceRequests,
  societies,
  users,
  vendorCategories,
  vendors,
} from './schema/index.js';
import { DEFAULT_CATEGORIES } from '@event-bridge/shared';
import { hashPassword } from '../lib/password.js';
import { logger } from '../config/logger.js';

const SEED_REQUEST_REFERENCE = 'EB-R-SEED01';

async function ensureUser(values: NewUser): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.email, values.email)).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(users).values(values).returning();
  if (!created) throw new Error(`Failed to create user ${values.email}`);
  return created;
}

async function ensureCategories(): Promise<Map<string, string>> {
  for (const category of DEFAULT_CATEGORIES) {
    await db.insert(categories).values(category).onConflictDoNothing({ target: categories.slug });
  }

  const rows = await db.select().from(categories);
  return new Map(rows.map((row) => [row.slug, row.id]));
}

export async function seed(): Promise<void> {
  logger.info('Seeding development data');

  const categoryIds = await ensureCategories();
  const catering = categoryIds.get('catering');
  const decoration = categoryIds.get('decoration');
  if (!catering || !decoration) throw new Error('Seed categories missing');

  const [adminHash, societyHash, vendorHash] = await Promise.all([
    hashPassword('Admin123!'),
    hashPassword('Society123!'),
    hashPassword('Vendor123!'),
  ]);

  const admin = await ensureUser({
    name: 'Platform Admin',
    email: 'admin@eventbridge.test',
    passwordHash: adminHash,
    role: 'admin',
  });

  const societyUser = await ensureUser({
    name: 'Ayesha Khan',
    email: 'society@eventbridge.test',
    passwordHash: societyHash,
    role: 'society',
  });

  await db
    .insert(societies)
    .values({
      userId: societyUser.id,
      name: 'IBA Entrepreneurship Society',
      institution: 'Institute of Business Administration',
      contactPerson: 'Ayesha Khan',
      contactEmail: 'society@eventbridge.test',
      contactPhone: '+92 300 0000001',
      description: 'Student society organising entrepreneurship events, competitions and seminars.',
    })
    .onConflictDoNothing({ target: societies.userId });

  const societyUserTwo = await ensureUser({
    name: 'Bilal Ahmed',
    email: 'society2@eventbridge.test',
    passwordHash: societyHash,
    role: 'society',
  });

  await db
    .insert(societies)
    .values({
      userId: societyUserTwo.id,
      name: 'NUST Computing Society',
      institution: 'National University of Sciences and Technology',
      contactPerson: 'Bilal Ahmed',
      contactEmail: 'society2@eventbridge.test',
      contactPhone: '+92 300 0000002',
      description: 'Computing society running hackathons, workshops and tech talks.',
    })
    .onConflictDoNothing({ target: societies.userId });

  const [society] = await db
    .select()
    .from(societies)
    .where(eq(societies.userId, societyUser.id))
    .limit(1);
  if (!society) throw new Error('Society profile missing after seed');

  const vendorSeeds = [
    {
      name: 'Patel Event Management',
      email: 'vendor@eventbridge.test',
      businessName: "Patel's Event Management",
      description:
        'Full-service catering and event management for university functions, with 12 years of experience.',
      city: 'Karachi',
      serviceArea: 'Karachi (all campuses)',
      contactPhone: '+92 300 0000011',
      categories: [catering],
      verified: true,
    },
    {
      name: 'Adil Khan',
      email: 'moments@eventbridge.test',
      businessName: 'Moments by Adil Khan',
      description:
        'Food and decor specialists for student events, including stage design and table settings.',
      city: 'Karachi',
      serviceArea: 'Karachi',
      contactPhone: '+92 300 0000012',
      categories: [catering, decoration],
      verified: true,
    },
    {
      name: 'Shahid Ali',
      email: 'pending@eventbridge.test',
      businessName: 'Shahid Catering',
      description:
        'Local catering service operating in Karachi with a focus on budget-friendly menus.',
      city: 'Karachi',
      serviceArea: 'Karachi',
      contactPhone: '+92 300 0000013',
      categories: [catering],
      verified: false,
    },
  ] as const;

  const vendorIds: Record<string, string> = {};

  for (const seedVendor of vendorSeeds) {
    const user = await ensureUser({
      name: seedVendor.name,
      email: seedVendor.email,
      passwordHash: vendorHash,
      role: 'vendor',
    });

    await db
      .insert(vendors)
      .values({
        userId: user.id,
        businessName: seedVendor.businessName,
        description: seedVendor.description,
        city: seedVendor.city,
        serviceArea: seedVendor.serviceArea,
        contactPerson: seedVendor.name,
        contactPhone: seedVendor.contactPhone,
        verificationStatus: seedVendor.verified ? 'verified' : 'pending_review',
        ...(seedVendor.verified ? { verifiedBy: admin.id, verifiedAt: new Date() } : {}),
      })
      .onConflictDoNothing({ target: vendors.userId });

    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, user.id)).limit(1);
    if (!vendor) throw new Error(`Vendor profile missing for ${seedVendor.email}`);
    vendorIds[seedVendor.email] = vendor.id;

    for (const categoryId of seedVendor.categories) {
      await db
        .insert(vendorCategories)
        .values({ vendorId: vendor.id, categoryId })
        .onConflictDoNothing();
    }
  }

  const [existingRequest] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.reference, SEED_REQUEST_REFERENCE))
    .limit(1);

  if (existingRequest) {
    logger.info('Sample request already present, skipping request/quotation seed');
    return;
  }

  const [event] = await db
    .insert(events)
    .values({
      societyId: society.id,
      name: 'Startup Pitch Night 2026',
      eventDate: '2026-12-10',
      location: 'IBA Main Campus, Karachi',
      expectedAttendance: 180,
    })
    .returning();

  if (!event) throw new Error('Failed to create seed event');

  const [request] = await db
    .insert(serviceRequests)
    .values({
      reference: SEED_REQUEST_REFERENCE,
      societyId: society.id,
      eventId: event.id,
      categoryId: catering,
      title: 'Catering for 180 guests at Startup Pitch Night',
      budgetMin: '120000.00',
      budgetMax: '180000.00',
      quantity: 180,
      description:
        'Buffet-style dinner for 180 guests, including vegetarian options, soft drinks and serving staff. Setup from 4pm, service from 7pm.',
      status: 'open',
      responseDeadline: new Date('2026-12-01T18:00:00Z'),
    })
    .returning();

  if (!request) throw new Error('Failed to create seed request');

  const invitedVendorIds = [
    vendorIds['vendor@eventbridge.test'],
    vendorIds['moments@eventbridge.test'],
  ];

  for (const vendorId of invitedVendorIds) {
    if (!vendorId) continue;
    await db
      .insert(requestVendors)
      .values({ requestId: request.id, vendorId })
      .onConflictDoNothing();
  }

  const quotationSeeds = [
    {
      reference: 'EB-Q-SEED01',
      vendorId: vendorIds['vendor@eventbridge.test'],
      totalPrice: '155000.00',
      description: 'Buffet dinner for 180 guests with two mains, rice, salad bar and soft drinks.',
      inclusions: 'Serving staff, crockery, buffet setup and cleanup.',
      exclusions: 'Live cooking stations and dessert.',
      additionalCharges: '5000.00',
      availableOnDate: true,
    },
    {
      reference: 'EB-Q-SEED02',
      vendorId: vendorIds['moments@eventbridge.test'],
      totalPrice: '142500.00',
      description: 'Buffet dinner for 180 guests plus basic stage decoration.',
      inclusions: 'Serving staff, crockery, table linen, stage backdrop.',
      exclusions: 'Sound system and photography.',
      additionalCharges: null,
      availableOnDate: true,
    },
  ] as const;

  for (const quotation of quotationSeeds) {
    if (!quotation.vendorId) continue;
    await db
      .insert(quotations)
      .values({
        reference: quotation.reference,
        requestId: request.id,
        vendorId: quotation.vendorId,
        totalPrice: quotation.totalPrice,
        description: quotation.description,
        inclusions: quotation.inclusions,
        exclusions: quotation.exclusions,
        additionalCharges: quotation.additionalCharges,
        availableOnDate: quotation.availableOnDate,
        status: 'submitted',
      })
      .onConflictDoNothing();
  }

  logger.info('Seed complete');
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  seed()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      logger.error({ err: error }, 'Seed failed');
      await closePool();
      process.exit(1);
    });
}
