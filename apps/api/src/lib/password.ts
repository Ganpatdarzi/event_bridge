import argon2, { type HashOptions } from 'argon2';

/**
 * OWASP-recommended Argon2id baseline (19 MiB, t=2, p=1).
 * Tune upward only; never lower these values without a security review.
 */
const options: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
