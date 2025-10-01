/**
 * Comprehensive Test for Logging & Alerting System - Drizzle ORM Migration
 * Tests pure Drizzle ORM implementation with zero raw SQL
 */

import { db, sqlite } from './db/client.js';
import { systemLogs, alerts, alertRules, sessionHints, sessions, bookings, games, rooms, operators } from './db/schema.js';
import { eq, and, isNull, count, desc, like } from 'drizzle-orm';
import { logToDatabase, queryLogs } from './logging/database.js';
import {
  createAlert,
  dismissAlert,
  dismissAlertsBySession,
  autoDismissAlerts,
  evaluateAlertRules,
  getActiveAlerts,
  getSessionAlerts
} from './logging/alerts.js';
import { quickStartSession, applyCommand, getDashboard } from './state.js';
import type { AlertLevel, AlertCategory, LogLevel, LogCategory } from '@escapeplan/contracts';

console.log('\n🧪 Comprehensive Drizzle ORM Test - Logging & Alerting System\n');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`   ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`   ❌ FAIL: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  testsRun++;
  if (actual === expected) {
    testsPassed++;
    console.log(`   ✅ ${message}: ${actual}`);
  } else {
    testsFailed++;
    console.log(`   ❌ FAIL: ${message}. Expected ${expected}, got ${actual}`);
  }
}

try {
  // =========================================================================
  // PHASE 1: Database Schema Validation
  // =========================================================================
  console.log('1. Validating Drizzle Schema Definitions');

  // Verify tables exist
  const tables = sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('system_logs', 'alerts', 'alert_rules', 'session_hints')`
  ).all();
  assertEquals(tables.length, 4, 'All logging/alerting tables exist');

  // Verify indexes exist
  const indexes = sqlite.prepare(
    `SELECT COUNT(*) as count FROM sqlite_master
     WHERE type='index' AND name LIKE 'idx_logs_%' OR name LIKE 'idx_alerts_%' OR name LIKE 'idx_alert_rules_%'`
  ).get() as { count: number };
  assert(indexes.count >= 8, `Found ${indexes.count} indexes (expected >= 8)`);

  // Verify foreign keys are enabled
  const fkStatus = sqlite.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
  assertEquals(fkStatus.foreign_keys, 1, 'Foreign keys enabled');

  console.log('');

  // =========================================================================
  // PHASE 2: Drizzle ORM Insert Operations
  // =========================================================================
  console.log('2. Testing Drizzle ORM Inserts');

  // Clean up test data using Drizzle
  db.delete(alerts).where(like(alerts.id, 'alert-test-%')).run();
  db.delete(systemLogs).where(like(systemLogs.id, 'log-test-%')).run();

  // Test logToDatabase() - uses Drizzle internally
  logToDatabase('info', 'system', 'Test log entry via Drizzle', {
    testKey: 'testValue',
    timestamp: new Date().toISOString()
  });

  const insertedLog = db.select()
    .from(systemLogs)
    .where(like(systemLogs.message, '%Test log entry via Drizzle%'))
    .limit(1)
    .all()[0];

  assert(!!insertedLog, 'Log inserted via Drizzle ORM');
  assertEquals(insertedLog.level, 'info', 'Log level correct');
  assertEquals(insertedLog.category, 'system', 'Log category correct');

  // Test createAlert() - uses Drizzle internally
  const testAlertId = createAlert({
    level: 'warning' as AlertLevel,
    category: 'system' as AlertCategory,
    title: 'Test Alert',
    message: 'Test alert created via Drizzle',
    context: { source: 'test' }
  });

  const insertedAlert = db.select()
    .from(alerts)
    .where(eq(alerts.id, testAlertId))
    .limit(1)
    .all()[0];

  assert(!!insertedAlert, 'Alert inserted via Drizzle ORM');
  assertEquals(insertedAlert.title, 'Test Alert', 'Alert title correct');
  assertEquals(insertedAlert.level, 'warning', 'Alert level correct');
  assert(insertedAlert.context !== null, 'Alert context JSON stored');

  console.log('');

  // =========================================================================
  // PHASE 3: Drizzle ORM Update Operations
  // =========================================================================
  console.log('3. Testing Drizzle ORM Updates');

  // Get a real operator ID for FK constraint
  const operatorResult = db.select().from(operators).limit(1).all();
  const testOperatorId = operatorResult.length > 0 ? operatorResult[0].id : 'system';

  // Test dismissAlert() - uses Drizzle internally
  dismissAlert(testAlertId, testOperatorId);

  const dismissedAlert = db.select()
    .from(alerts)
    .where(eq(alerts.id, testAlertId))
    .limit(1)
    .all()[0];

  assert(dismissedAlert.dismissed_at !== null, 'Alert dismissed_at timestamp set');
  assert(dismissedAlert.dismissed_by !== null, 'Alert dismissed_by operator set');

  console.log('');

  // =========================================================================
  // PHASE 4: Drizzle ORM Select Operations
  // =========================================================================
  console.log('4. Testing Drizzle ORM Selects');

  // Test queryLogs() - uses Drizzle internally
  const logsResult = queryLogs({ level: 'info' as LogLevel, limit: 10 });
  assert(logsResult.logs.length > 0, `Found ${logsResult.logs.length} info logs`);
  assert(logsResult.total > 0, `Total log count: ${logsResult.total}`);

  // Test queryLogs() with category filter
  const systemLogsResult = queryLogs({ category: 'system' as LogCategory, limit: 5 });
  assert(systemLogsResult.logs.length > 0, `Found ${systemLogsResult.logs.length} system logs`);
  assert(systemLogsResult.logs.every(log => log.category === 'system'), 'All logs are system category');

  // Test getActiveAlerts() - uses Drizzle internally
  const activeAlerts = getActiveAlerts();
  const allAlertsCount = db.select({ count: count() }).from(alerts).all()[0].count;
  assert(activeAlerts.length <= allAlertsCount, `Active alerts: ${activeAlerts.length} of ${allAlertsCount} total`);

  console.log('');

  // =========================================================================
  // PHASE 5: Drizzle ORM Complex Queries (JOINs)
  // =========================================================================
  console.log('5. Testing Drizzle ORM Complex Queries');

  // Test alert rules query
  const enabledRules = db.select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true))
    .all();

  assert(enabledRules.length > 0, `Found ${enabledRules.length} enabled alert rules`);

  // Verify JSON parsing works
  enabledRules.forEach(rule => {
    const conditions = rule.conditions as any;
    assert(typeof conditions === 'object', `Rule "${rule.name}" conditions auto-parsed from JSON`);
  });

  console.log('');

  // =========================================================================
  // PHASE 6: End-to-End Integration Test
  // =========================================================================
  console.log('6. Testing End-to-End Flow (Session → Logging → Alerting)');

  // Get test game and room
  const game = db.select().from(games).limit(1).all()[0];
  const room = db.select().from(rooms).limit(1).all()[0];

  if (!game || !room) {
    console.log('   ⚠️  Skipping integration test - no game/room found. Run `pnpm db:seed` first.');
  } else {
    // Clean up any existing active sessions for this room
    try {
      sqlite.prepare('UPDATE sessions SET status = ? WHERE room_id = ? AND status = ?')
        .run('completed', room.id, 'running');
    } catch (e) {
      // Ignore cleanup errors
    }
    // Create test booking using Drizzle
    const bookingId = `booking-drizzle-test-${Date.now()}`;
    const bookingCode = `DRZ${Date.now()}`;
    const now = new Date();
    const startTime = new Date(now.getTime() + 60000).toISOString();
    const endTime = new Date(now.getTime() + 4500000).toISOString();

    db.insert(bookings).values({
      id: bookingId,
      booking_code: bookingCode,
      game_id: game.id,
      room_id: room.id,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
      contact_name: 'Drizzle Test',
      contact_phone: '555-9999',
      party_size: 4,
      price_tier: 'standard',
      total_due_cents: 10000,
      deposit_due_cents: 0,
      is_mobile: false
    }).run();

    console.log(`   Created test booking: ${bookingCode}`);

    // Start session using the proper QuickStartSessionRequest
    const sessionResponse = quickStartSession({
      gameId: game.id,
      roomId: room.id,
      partySize: 4,
      durationMinutes: null,
      notes: 'Drizzle ORM test session'
    }, operatorResult[0].id);

    const sessionId = sessionResponse.session.id;
    console.log(`   Started session: ${sessionId}`);

    // Test pause timer → creates alert
    applyCommand(sessionId, { command: 'pause_timer' });
    const pauseAlerts = getSessionAlerts(sessionId);
    assert(pauseAlerts.length > 0, `Created ${pauseAlerts.length} alert(s) on pause`);

    // Verify alert was logged to database
    const pauseLog = db.select()
      .from(systemLogs)
      .where(like(systemLogs.message, '%Timer paused%'))
      .orderBy(desc(systemLogs.created_at))
      .limit(1)
      .all()[0];
    assert(!!pauseLog, 'Timer pause logged to system_logs');

    // Test resume timer → auto-dismisses alert
    applyCommand(sessionId, { command: 'resume_timer' });
    const resumeAlerts = db.select()
      .from(alerts)
      .where(and(
        eq(alerts.session_id, sessionId),
        isNull(alerts.dismissed_at)
      ))
      .all();
    assert(resumeAlerts.length === 0, 'Alerts auto-dismissed on resume');

    // Test dashboard query
    const dashboard = getDashboard();
    assert(Array.isArray(dashboard.alerts), 'Dashboard includes alerts array');
    console.log(`   Dashboard has ${dashboard.alerts.length} active alerts`);

    // Cleanup test booking
    db.delete(bookings).where(eq(bookings.id, bookingId)).run();
  }

  console.log('');

  // =========================================================================
  // PHASE 7: Type Safety Verification
  // =========================================================================
  console.log('7. Testing Type Safety');

  // Verify Drizzle infers types correctly
  const typedLog = db.select().from(systemLogs).limit(1).all()[0];
  if (typedLog) {
    assert(typeof typedLog.id === 'string', 'Log ID is string');
    assert(typeof typedLog.level === 'string', 'Log level is string');
    assert(typeof typedLog.created_at === 'string', 'Log created_at is string');
  }

  const typedAlert = db.select().from(alerts).limit(1).all()[0];
  if (typedAlert) {
    assert(typeof typedAlert.id === 'string', 'Alert ID is string');
    assert(typeof typedAlert.level === 'string', 'Alert level is string');
    assert(['string', 'object'].includes(typeof typedAlert.session_id), 'Alert session_id is string or null');
  }

  const typedRule = db.select().from(alertRules).limit(1).all()[0];
  if (typedRule) {
    assert(typeof typedRule.enabled === 'boolean', 'Alert rule enabled is boolean (not 0/1)');
    assert(typeof typedRule.conditions === 'object', 'Alert rule conditions auto-parsed from JSON');
  }

  console.log('');

  // =========================================================================
  // PHASE 8: Performance Test
  // =========================================================================
  console.log('8. Testing Performance');

  const startTime = Date.now();

  // Insert 100 logs
  for (let i = 0; i < 100; i++) {
    logToDatabase('debug', 'api', `Performance test log ${i}`, { iteration: i });
  }

  const insertTime = Date.now() - startTime;
  assert(insertTime < 5000, `Inserted 100 logs in ${insertTime}ms (< 5000ms)`);

  // Query with filters
  const queryStartTime = Date.now();
  const perfLogs = queryLogs({
    level: 'debug' as LogLevel,
    category: 'api' as LogCategory,
    limit: 50
  });
  const queryTime = Date.now() - queryStartTime;
  assert(queryTime < 100, `Queried logs in ${queryTime}ms (< 100ms)`);
  assert(perfLogs.logs.length > 0, `Found ${perfLogs.logs.length} performance test logs`);

  console.log('');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Tests:  ${testsRun}`);
  console.log(`✅ Passed:    ${testsPassed}`);
  console.log(`❌ Failed:    ${testsFailed}`);
  console.log(`Success Rate: ${Math.round((testsPassed / testsRun) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Drizzle ORM migration is complete and working.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review errors above.\n');
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Test execution failed:', error);
  console.error((error as Error).stack);
  process.exit(1);
}
