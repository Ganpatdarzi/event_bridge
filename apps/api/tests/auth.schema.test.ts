import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, upsertQuotationSchema } from '@event-bridge/shared';

const account = {
  name: 'Test User',
  email: '  TEST@Example.com  ',
  password: 'Strong123',
};

const societyProfile = {
  societyName: 'Test Society',
  institution: 'Test University',
  contactPerson: 'Test User',
};

const vendorProfile = {
  businessName: 'Test Events',
  description: 'A perfectly valid vendor description with enough detail.',
  city: 'Karachi',
};

describe('registerSchema', () => {
  it('accepts a society registration and normalises the email', () => {
    const parsed = registerSchema.parse({
      ...account,
      role: 'society',
      society: societyProfile,
    });

    expect(parsed.email).toBe('test@example.com');
    expect(parsed.role).toBe('society');
  });

  it('accepts a vendor registration', () => {
    const parsed = registerSchema.parse({
      ...account,
      role: 'vendor',
      vendor: vendorProfile,
    });

    expect(parsed.role).toBe('vendor');
  });

  it('rejects passwords without a number', () => {
    const result = registerSchema.safeParse({
      ...account,
      password: 'onlyletters',
      role: 'society',
      society: societyProfile,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('password'))).toBe(true);
    }
  });

  it('rejects a vendor description shorter than 20 characters', () => {
    const result = registerSchema.safeParse({
      ...account,
      role: 'vendor',
      vendor: { ...vendorProfile, description: 'Too short' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects the admin role for self-registration', () => {
    const result = registerSchema.safeParse({ ...account, role: 'admin' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a valid email and a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  });
});

describe('upsertQuotationSchema', () => {
  const quotation = { totalPrice: 50_000, description: 'A detailed quotation for the event.' };

  it('accepts numeric strings for money fields', () => {
    expect(upsertQuotationSchema.safeParse({ ...quotation, totalPrice: '50000' }).success).toBe(
      true,
    );
  });

  it('rejects booleans that z.coerce.number() would silently accept', () => {
    expect(upsertQuotationSchema.safeParse({ ...quotation, totalPrice: true }).success).toBe(false);
    expect(
      upsertQuotationSchema.safeParse({ ...quotation, additionalCharges: false }).success,
    ).toBe(false);
  });
});
