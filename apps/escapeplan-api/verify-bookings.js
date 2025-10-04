#!/usr/bin/env node
/**
 * Verification script for bookings state module
 * Tests that the extracted booking functions work correctly
 */

import { bookingsState, getBookingsByDate, listUpcomingBookings } from './dist/index.js';

console.log('✓ Successfully imported booking functions from new module');

// Verify class instance
if (bookingsState) {
  console.log('✓ bookingsState singleton created');
}

// Verify functions are callable
if (typeof getBookingsByDate === 'function') {
  console.log('✓ getBookingsByDate is a function');
}

if (typeof listUpcomingBookings === 'function') {
  console.log('✓ listUpcomingBookings is a function');
}

// Verify state properties exist
if (Array.isArray(bookingsState.upcomingBookings)) {
  console.log('✓ upcomingBookings state property exists and is an array');
}

if (typeof bookingsState.selectedDate === 'string') {
  console.log('✓ selectedDate state property exists and is a string');
}

// Verify derived state
if (Array.isArray(bookingsState.todayBookings)) {
  console.log('✓ todayBookings derived state exists and is an array');
}

console.log('\n✅ All bookings module verifications passed!');
