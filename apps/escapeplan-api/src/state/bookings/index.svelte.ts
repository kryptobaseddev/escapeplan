/**
 * Bookings domain state management
 *
 * This module provides booking CRUD operations using a class-based state pattern
 * inspired by Svelte 5 runes. All functions maintain existing behavior from
 * the original state.ts implementation.
 */

import { sqlite } from '../../db/client.js';
import { emitBookingsUpdate } from '../../realtime.js';
import type {
  BookingSummary,
  BookingCalendarResponse
} from '@escapeplan/contracts';
import type { BookingRow } from './types.js';

/**
 * Maps a database BookingRow to a BookingSummary domain object
 */
function mapBooking(row: BookingRow): BookingSummary {
  return {
    id: row.id,
    bookingCode: row.booking_code,
    gameId: row.game_id,
    gameName: row.game_name ?? '',
    roomName: row.room_name ?? '',
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status as BookingSummary['status'],
    partySize: row.party_size,
    depositDue: row.deposit_due_cents / 100,
    totalDue: row.total_due_cents / 100,
    priceTier: row.price_tier as BookingSummary['priceTier'],
    discountCode: row.discount_code ?? undefined,
    isMobile: Boolean(row.is_mobile),
    isAdhoc: Boolean(row.is_adhoc),
    notes: row.notes ?? undefined,
    locationNote: row.location_note ?? undefined,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    conflict: Boolean(row.conflict)
  };
}

/**
 * Class-based state management for bookings domain
 * Inspired by Svelte 5 runes pattern but adapted for backend use
 */
class BookingsState {
  // In a Svelte context, these would use $state rune
  // For backend, we keep them as regular class properties
  upcomingBookings: BookingSummary[] = [];
  selectedDate: string = new Date().toISOString().slice(0, 10);

  // Derived state (in Svelte this would be $derived)
  get todayBookings(): BookingSummary[] {
    const today = new Date().toISOString().slice(0, 10);
    return this.upcomingBookings.filter(b => b.startTime.startsWith(today));
  }

  /**
   * Lists upcoming bookings within a time window
   */
  listUpcomingBookings(windowMinutes = 240): BookingSummary[] {
    const now = new Date();
    const end = new Date(now.getTime() + windowMinutes * 60 * 1000);
    const stmt = sqlite.prepare(
      `SELECT b.*, g.name AS game_name, g.name AS room_name, 0 AS conflict
       FROM bookings b
       JOIN games g ON g.id = b.game_id
       WHERE b.start_time BETWEEN ? AND ?
       ORDER BY b.start_time ASC`
    );
    const rows = stmt.all(now.toISOString(), end.toISOString()) as BookingRow[];
    this.upcomingBookings = rows.map(mapBooking);
    return this.upcomingBookings;
  }

  /**
   * Gets bookings for a specific date with conflict detection
   */
  getBookingsByDate(date: string, scope: 'all' | 'storefront' | 'mobile'): BookingCalendarResponse {
    const like = `${date}%`;
    const rows = sqlite
      .prepare(
        `SELECT b.*, g.name AS game_name, g.name AS room_name
         FROM bookings b
         JOIN games g ON g.id = b.game_id
         WHERE b.start_time LIKE ?
         ORDER BY b.start_time ASC`
      )
      .all(like) as BookingRow[];

    const filtered = rows.filter((row) => {
      if (scope === 'all') return true;
      return scope === 'mobile' ? Boolean(row.is_mobile) : !row.is_mobile;
    });

    // Conflict detection algorithm
    // Two bookings conflict if they're for the same game and their time ranges overlap
    for (let i = 0; i < filtered.length; i += 1) {
      const current = filtered[i];
      current.conflict = 0;
      for (let j = i + 1; j < filtered.length; j += 1) {
        const other = filtered[j];
        // Skip if different games (games can run in parallel)
        if (current.game_id !== other.game_id) continue;
        // If current ends before other starts, no more conflicts possible (sorted by start_time)
        if (current.end_time <= other.start_time) break;
        // Overlap detected - mark both as conflicting
        current.conflict = 1;
        other.conflict = 1;
      }
    }

    const bookings = filtered.map(mapBooking);
    const conflicts = bookings
      .filter((b) => b.conflict)
      .map((booking) => ({ bookingIds: [booking.id], reason: `Conflict detected for ${booking.roomName}` }));

    this.selectedDate = date;

    return {
      date,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      scope,
      bookings,
      conflicts
    };
  }

  /**
   * Updates bookings and broadcasts to connected clients
   */
  broadcastBookingsUpdate(date: string, scope: 'all' | 'storefront' | 'mobile' = 'all'): void {
    const response = this.getBookingsByDate(date, scope);
    emitBookingsUpdate(response);
  }
}

/**
 * Singleton instance of the bookings state
 * In a Svelte 5 frontend, this would be exported as reactive state
 */
export const bookingsState = new BookingsState();

/**
 * Export individual methods as standalone functions for backward compatibility
 */
export const listUpcomingBookings = (windowMinutes = 240) => bookingsState.listUpcomingBookings(windowMinutes);
export const getBookingsByDate = (date: string, scope: 'all' | 'storefront' | 'mobile') => bookingsState.getBookingsByDate(date, scope);

/**
 * Re-export types for convenience
 */
export type { BookingRow } from './types.js';
