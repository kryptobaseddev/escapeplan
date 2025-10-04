/**
 * Converts a string to a URL-safe slug
 * @param value - The string to convert
 * @returns URL-safe slug (lowercase, hyphens, alphanumeric, max 64 chars)
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Generates a unique ID with a prefix
 * @param prefix - The prefix for the ID
 * @returns Unique ID string (uses crypto.randomUUID if available, otherwise fallback)
 */
export function uid(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reorders an item in an array by moving it from one index to another
 * @param items - The array to reorder
 * @param from - Source index
 * @param to - Destination index
 * @returns New array with reordered items (returns copy if indices invalid)
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const clone = [...items];
  const [removed] = clone.splice(from, 1);
  clone.splice(to, 0, removed);
  return clone;
}
