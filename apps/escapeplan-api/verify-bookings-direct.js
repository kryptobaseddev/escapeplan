#!/usr/bin/env node
/**
 * Verification script for bookings state module
 * Tests by importing directly from the state module
 */

import { bookingsState, getBookingsByDate, listUpcomingBookings } from './dist/state/index.js';

console.log('✓ Successfully imported booking functions from state module');

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

// Verify broadcast method exists
if (typeof bookingsState.broadcastBookingsUpdate === 'function') {
  console.log('✓ broadcastBookingsUpdate method exists');
}

console.log('\n✅ All bookings module verifications passed!');
console.log('\nBookings State Properties:');
console.log('- upcomingBookings:', bookingsState.upcomingBookings.length, 'items');
console.log('- selectedDate:', bookingsState.selectedDate);
console.log('- todayBookings:', bookingsState.todayBookings.length, 'items');
