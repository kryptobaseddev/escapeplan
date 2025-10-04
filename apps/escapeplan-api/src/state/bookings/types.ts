/**
 * Bookings state management types
 *
 * This module defines types for booking operations including:
 * - Booking creation, updating, and cancellation
 * - Calendar view and date-based queries
 * - Pricing and payment tracking
 * - Booking status management
 * - Mobile and adhoc booking support
 */

import type {
  BookingSummary,
  BookingCalendarResponse
} from '@escapeplan/contracts';

/**
 * Re-export contract types for convenience
 */
export type {
  BookingSummary,
  BookingCalendarResponse
};

/**
 * Booking status types
 */
export type BookingStatus = 'confirmed' | 'checked_in' | 'completed' | 'cancelled';

/**
 * Price tier types
 */
export type PriceTier = 'standard' | 'premier' | 'offsite';

/**
 * Database row representation of a booking
 */
export interface BookingRow {
  id: string;
  booking_code: string;
  game_id: string;
  start_time: string;
  end_time: string;
  status: string;
  party_size: number;
  deposit_due_cents: number;
  total_due_cents: number;
  price_tier: PriceTier | string;
  discount_code: string | null;
  is_mobile: number;
  is_adhoc: number;
  notes: string | null;
  location_note: string | null;
  contact_name: string;
  contact_phone: string;
  game_name?: string;
  room_name?: string;
  conflict?: number;
}

/**
 * Filters for listing bookings
 */
export interface BookingListFilters {
  date?: string;
  scope?: 'all' | 'storefront' | 'mobile';
  status?: BookingStatus;
  gameId?: string;
  isMobile?: boolean;
  isAdhoc?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Create booking request
 */
export interface CreateBookingRequest {
  gameId: string;
  startTime: string;
  endTime: string;
  partySize: number;
  contactName: string;
  contactPhone: string;
  priceTier: PriceTier;
  depositDueCents?: number;
  totalDueCents?: number;
  discountCode?: string | null;
  isMobile?: boolean;
  isAdhoc?: boolean;
  notes?: string | null;
  locationNote?: string | null;
}

/**
 * Update booking request
 */
export interface UpdateBookingRequest {
  startTime?: string;
  endTime?: string;
  partySize?: number;
  contactName?: string;
  contactPhone?: string;
  status?: BookingStatus;
  priceTier?: PriceTier;
  depositDueCents?: number;
  totalDueCents?: number;
  discountCode?: string | null;
  notes?: string | null;
  locationNote?: string | null;
}

/**
 * Booking with conflict detection
 */
export interface BookingWithConflict extends BookingSummary {
  hasConflict: boolean;
  conflictingBookings?: string[];
}

/**
 * Booking calendar day
 */
export interface BookingCalendarDay {
  date: string;
  bookings: BookingSummary[];
  totalBookings: number;
  confirmedBookings: number;
  revenue: number;
}

/**
 * Upcoming booking window
 */
export interface UpcomingBookingsWindow {
  windowMinutes: number;
  bookings: BookingSummary[];
  generatedAt: string;
}

/**
 * Booking operation errors
 */
export enum BookingErrorCode {
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_CONFLICT = 'BOOKING_CONFLICT',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  INVALID_PARTY_SIZE = 'INVALID_PARTY_SIZE',
  BOOKING_ALREADY_COMPLETED = 'BOOKING_ALREADY_COMPLETED',
  BOOKING_ALREADY_CANCELLED = 'BOOKING_ALREADY_CANCELLED',
  CANNOT_MODIFY_STARTED_BOOKING = 'CANNOT_MODIFY_STARTED_BOOKING',
}

export interface BookingError {
  code: BookingErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Booking pricing breakdown
 */
export interface BookingPricingBreakdown {
  basePriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositCents: number;
  remainingCents: number;
}

/**
 * Booking metrics
 */
export interface BookingMetrics {
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalRevenue: number;
  averagePartySize: number;
  occupancyRate: number;
}
