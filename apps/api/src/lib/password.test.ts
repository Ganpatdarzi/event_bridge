import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('produces an Argon2id hash that verifies the original password', async () => {
    const hash = await hashPassword('Correct123');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, 'Correct123')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'Wrong123')).resolves.toBe(false);
  }, 30_000);

  it('uses a unique salt per hash', async () => {
    const [first, second] = await Promise.all([
      hashPassword('Correct123'),
      hashPassword('Correct123'),
    ]);

    expect(first).not.toBe(second);
  }, 30_000);
});
