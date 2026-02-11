import crypto from 'crypto';

const PEPPER = process.env.PEPPER_SECRET || 'mdavel-dev-pepper-secret-2026';

/**
 * Normalize a flag string:
 * 1. trim whitespace
 * 2. NFKC unicode normalization
 * 3. lowercase if not caseSensitive
 */
export function normalizeFlag(raw: string, caseSensitive: boolean): string {
  let flag = raw.trim().normalize('NFKC');
  if (!caseSensitive) {
    flag = flag.toLowerCase();
  }
  return flag;
}

/**
 * Compute HMAC-SHA256 hash of a normalized flag.
 */
export function hashFlag(normalizedFlag: string): string {
  return crypto
    .createHmac('sha256', PEPPER)
    .update(normalizedFlag)
    .digest('hex');
}

/**
 * Hash an IP/UA for logging (privacy).
 */
export function hashMeta(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
