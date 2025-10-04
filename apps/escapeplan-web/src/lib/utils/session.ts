import type { GameSessionDetails } from '@escapeplan/contracts';

/**
 * Build the room display URL for a game session.
 *
 * Constructs the full URL for the room display page, including the room query parameter
 * if a roomId is provided. This URL can be used to open the public room display in a new
 * window or copy to clipboard for sharing.
 *
 * @param session - The game session details
 * @returns The full room display URL, or empty string if slug is missing
 *
 * @example
 * const url = buildRoomDisplayUrl(session);
 * // Returns: "https://escapeplan.local/room/mystery-mansion?room=room-1"
 */
export function buildRoomDisplayUrl(session: GameSessionDetails): string {
  const slug = session.gameSlug ?? session.gameId;
  if (!slug) {
    return '';
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(`/room/${slug}`, origin || 'http://localhost');

  if (session.roomId) {
    url.searchParams.set('room', session.roomId);
  }

  return url.toString();
}

/**
 * Get the appropriate CSS color class for the timer based on remaining time.
 *
 * Returns a warning color when the timer is running low (5 minutes or less),
 * otherwise returns the primary color.
 *
 * @param remainingSeconds - Number of seconds remaining on the timer
 * @returns The DaisyUI text color class to apply
 *
 * @example
 * const colorClass = getTimerColorClass(180); // Returns: "text-warning"
 * const colorClass = getTimerColorClass(600); // Returns: "text-primary"
 */
export function getTimerColorClass(remainingSeconds: number): string {
  return remainingSeconds <= 300 ? 'text-warning' : 'text-primary';
}

/**
 * Format a session timestamp for consistent display across the application.
 *
 * Converts an ISO timestamp string to a localized time string in 24-hour format
 * with hour and minute precision.
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted time string (e.g., "14:30")
 *
 * @example
 * const time = formatSessionTime('2025-10-04T14:30:00.000Z');
 * // Returns: "14:30" (formatted according to user's locale)
 */
export function formatSessionTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}
