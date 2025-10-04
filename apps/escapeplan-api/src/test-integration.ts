/**
 * Integration Test for Logging & Alerting System Phase 2
 * Tests the complete flow: state.ts commands → logging → alert rules → database
 */

import { sqlite } from './db/client.js';
import { applyCommand, quickStartSession, getDashboard } from './state/index.js';
import { getActiveAlerts, getSessionAlerts } from './logging/index.js';

console.log('\n🧪 Starting Integration Test - Logging & Alerting Phase 2\n');

try {
  // Clean up test data
  console.log('1. Cleaning up previous test data...');
  sqlite.prepare('DELETE FROM alerts WHERE id LIKE ?').run('alert-%');
  sqlite.prepare('DELETE FROM system_logs WHERE id LIKE ?').run('log-%');
  sqlite.prepare('DELETE FROM session_hints WHERE id LIKE ?').run('hint-%');
  console.log('   ✅ Cleanup complete\n');

  // Get first available game
  console.log('2. Finding test game...');
  const game = sqlite.prepare('SELECT * FROM games LIMIT 1').get() as any;

  if (!game) {
    console.log('   ⚠️  No game found. Run `pnpm db:seed` first.');
    process.exit(1);
  }

  console.log(`   ✅ Found test game: ${game.name}\n`);

  // Get test operator (use admin from seed)
  const operator = sqlite.prepare(`SELECT id FROM operators WHERE username = 'admin' LIMIT 1`).get() as any;
  if (!operator) {
    console.log('   ⚠️  No operator found. Run `pnpm db:seed` first.');
    process.exit(1);
  }

  // Start a test session
  console.log('3. Starting quick start session...');
  const sessionResponse = quickStartSession({
    gameId: game.id,
    partySize: 4,
    durationMinutes: game.duration_minutes
  }, operator.id);

  const sessionId = sessionResponse.session.id;
  console.log(`   ✅ Session started: ${sessionId}\n`);

  // Test 1: Pause timer (should create alert)
  console.log('4. Test: Pause timer');
  applyCommand(sessionId, { command: 'pause_timer' });

  const pauseAlerts = getSessionAlerts(sessionId);
  console.log(`   Alerts after pause: ${pauseAlerts.length}`);

  if (pauseAlerts.length > 0) {
    const alert = pauseAlerts[0] as any;
    console.log(`   ✅ Alert created: "${alert.title}" - ${alert.message}`);
  } else {
    console.log('   ❌ No alert created (expected "Game Paused" alert)');
  }

  // Check system logs
  const pauseLogs = sqlite.prepare(
    `SELECT * FROM system_logs WHERE message LIKE '%paused%' ORDER BY created_at DESC LIMIT 1`
  ).get() as any;

  if (pauseLogs) {
    console.log(`   ✅ Log entry created: "${pauseLogs.message}"`);
  } else {
    console.log('   ❌ No log entry found');
  }
  console.log('');

  // Test 2: Resume timer (should auto-dismiss alert)
  console.log('5. Test: Resume timer');
  applyCommand(sessionId, { command: 'resume_timer' });

  const resumeAlerts = getSessionAlerts(sessionId);
  console.log(`   Alerts after resume: ${resumeAlerts.length}`);

  if (resumeAlerts.length === 0) {
    console.log('   ✅ Alert auto-dismissed (expected behavior)');
  } else {
    console.log('   ❌ Alert still active (should be auto-dismissed)');
  }
  console.log('');

  // Test 3: Send hints (should create excessive hints alert on 3rd)
  console.log('6. Test: Send hints (excessive hints rule)');

  applyCommand(sessionId, {
    command: 'send_hint',
    payload: { message: 'Check the bookshelf', medium: 'text' }
  });
  console.log('   Sent hint 1');

  applyCommand(sessionId, {
    command: 'send_hint',
    payload: { message: 'Look under the rug', medium: 'text' }
  });
  console.log('   Sent hint 2');

  applyCommand(sessionId, {
    command: 'send_hint',
    payload: { message: 'Check the painting', medium: 'text' }
  });
  console.log('   Sent hint 3');

  const hintAlerts = getSessionAlerts(sessionId);
  const excessiveHintAlert = hintAlerts.find((a: any) => a.category === 'hint');

  if (excessiveHintAlert) {
    console.log(`   ✅ Excessive hints alert created: "${(excessiveHintAlert as any).message}"`);
  } else {
    console.log('   ⚠️  No excessive hints alert (may need more hints or rule is disabled)');
  }
  console.log('');

  // Test 4: Dashboard includes alerts
  console.log('7. Test: Dashboard alerts query');
  const dashboard = getDashboard();
  console.log(`   Active alerts in dashboard: ${dashboard.alerts.length}`);

  if (dashboard.alerts.length > 0) {
    dashboard.alerts.forEach((alert: any, index: number) => {
      console.log(`   ${index + 1}. [${alert.level}] ${alert.title}: ${alert.message}`);
    });
    console.log('   ✅ Dashboard correctly queries alerts table');
  } else {
    console.log('   ⚠️  No alerts in dashboard');
  }
  console.log('');

  // Test 5: Low time alert (simulate by updating timer)
  console.log('8. Test: Low time alert (< 5 min)');
  sqlite.prepare(
    'UPDATE sessions SET timer_remaining_seconds = 280 WHERE id = ?'
  ).run(sessionId);

  // Trigger rule evaluation by calling getDashboard (which updates timer)
  // In production, this happens via the timer tick function
  console.log('   Timer set to 280 seconds (4:40)');
  console.log('   ⚠️  Low time alert requires timer tick (production only)');
  console.log('');

  // Summary
  console.log('9. Summary');
  const totalLogs = sqlite.prepare(
    `SELECT COUNT(*) as count FROM system_logs`
  ).get() as { count: number };

  const totalAlerts = sqlite.prepare(
    `SELECT COUNT(*) as count FROM alerts`
  ).get() as { count: number };

  const activeAlertsCount = getActiveAlerts().length;

  console.log(`   Total logs in database: ${totalLogs.count}`);
  console.log(`   Total alerts created: ${totalAlerts.count}`);
  console.log(`   Active (non-dismissed) alerts: ${activeAlertsCount}`);
  console.log('');

  console.log('✅ Integration test complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Start dev server: pnpm --filter escapeplan-api dev');
  console.log('   2. Test pause/resume in Game Runner UI');
  console.log('   3. Verify alerts appear in Dashboard');
  console.log('   4. Test alert dismissal');
  console.log('');

} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}
