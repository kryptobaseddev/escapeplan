// Test script for Winston logging and database integration
import logger from './logger.js';
import { logToDatabase } from './logging/database.js';
import { createAlert, evaluateAlertRules } from './logging/alerts.js';

console.log('🧪 Testing Logging & Alerting System...\n');

// Test 1: Winston file logging
console.log('1️⃣ Testing Winston file logging...');
logger.info('Test info message from Winston');
logger.warn('Test warning message from Winston');
logger.error('Test error message from Winston');
logger.debug('Test debug message from Winston');
console.log('✅ Winston logs written to apps/escapeplan-api/logs/\n');

// Test 2: Database logging
console.log('2️⃣ Testing database logging...');
logToDatabase('info', 'system', 'Test system log entry', { testId: 'test-1' });
logToDatabase('warn', 'session', 'Test session warning', { sessionId: 'sess-test', userId: 'op-test' });
logToDatabase('error', 'api', 'Test API error', { endpoint: '/test', statusCode: 500 });
console.log('✅ Database logs written to system_logs table\n');

// Test 3: Alert creation
console.log('3️⃣ Testing alert creation...');
const alertId = createAlert({
  level: 'warning',
  category: 'timer',
  title: 'Test Alert',
  message: 'This is a test alert message',
  context: { gameName: 'Test Game' }
});
console.log(`✅ Alert created with ID: ${alertId}\n`);

// Test 4: Alert rule evaluation (timer pause event)
// Note: Using system-level alert (no sessionId) since test sessions don't exist
console.log('4️⃣ Testing alert rule evaluation (timer_paused event)...');
try {
  evaluateAlertRules('timer_paused', {
    gameName: 'Pirate Mutiny',
    time: '15:32'
  });
  console.log('✅ Alert rule evaluated and alert created if rule matched\n');
} catch (error) {
  console.error('❌ Error evaluating alert rules:', error);
  throw error;
}

// Test 5: Alert rule evaluation (low time event)
console.log('5️⃣ Testing alert rule evaluation (low_time event)...');
try {
  evaluateAlertRules('timer_tick', {
    gameName: 'Haunted Manor',
    remaining_seconds: 250 // Less than 300 (5 minutes)
  });
  console.log('✅ Alert rule evaluated and alert created if threshold met\n');
} catch (error) {
  console.error('❌ Error evaluating alert rules:', error);
  throw error;
}

console.log('🎉 All tests completed! Check the following:');
console.log('   - apps/escapeplan-api/logs/ directory for Winston log files');
console.log('   - system_logs table in database');
console.log('   - alerts table in database');
console.log('\n📊 Query examples:');
console.log('   sqlite3 apps/escapeplan-api/data/escapeplan.db "SELECT * FROM system_logs LIMIT 5;"');
console.log('   sqlite3 apps/escapeplan-api/data/escapeplan.db "SELECT * FROM alerts LIMIT 5;"');
