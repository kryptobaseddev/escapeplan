/**
 * Crypto utilities with browser compatibility fallbacks
 */

/**
 * Generate a UUID with browser compatibility check
 * Falls back to a random string if crypto.randomUUID is not available
 *
 * @param prefix Optional prefix for the UUID
 * @returns UUID string, optionally prefixed
 */
export function generateUUID(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * Generate a short random ID (8-16 characters)
 *
 * @param length Length of the ID (default: 10)
 * @returns Random ID string
 */
export function generateRandomId(length: number = 10): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
