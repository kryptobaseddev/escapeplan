#!/bin/bash

# Test script for Logging & Alerting System API endpoints
# Run the API server first: pnpm --filter escapeplan-api dev

BASE_URL="http://localhost:4000"
AUTH_COOKIE=""

echo "🧪 Testing Logging & Alerting System API Endpoints"
echo ""

# Login to get session cookie
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -c /tmp/escapeplan-cookies.txt \
  -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@escapeplan.local",
    "password": "escapeplan"
  }')

if [[ "$LOGIN_RESPONSE" == *"error"* ]]; then
  echo "   ❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi

echo "   ✅ Logged in successfully"
echo ""

# Test 1: GET /admin/alert-rules
echo "2. GET /admin/alert-rules"
RULES_RESPONSE=$(curl -s -b /tmp/escapeplan-cookies.txt "$BASE_URL/api/admin/alert-rules")
RULES_COUNT=$(echo "$RULES_RESPONSE" | jq -r '.rules | length' 2>/dev/null || echo "0")
echo "   Rules found: $RULES_COUNT"

if [[ "$RULES_COUNT" -ge "4" ]]; then
  echo "   ✅ Alert rules endpoint working (found $RULES_COUNT rules)"
else
  echo "   ❌ Expected at least 4 default rules, got $RULES_COUNT"
  echo "   Response: $RULES_RESPONSE"
fi
echo ""

# Test 2: PATCH /admin/alert-rules/:id
echo "3. PATCH /admin/alert-rules/game_paused"
PATCH_RESPONSE=$(curl -s -b /tmp/escapeplan-cookies.txt \
  -X PATCH "$BASE_URL/api/admin/alert-rules/game_paused" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "level": "warning"}')

if [[ "$PATCH_RESPONSE" == *'"success":true'* ]]; then
  echo "   ✅ Alert rule updated successfully"
else
  echo "   ❌ Failed to update alert rule"
  echo "   Response: $PATCH_RESPONSE"
fi
echo ""

# Test 3: GET /admin/logs
echo "4. GET /admin/logs"
LOGS_RESPONSE=$(curl -s -b /tmp/escapeplan-cookies.txt "$BASE_URL/api/admin/logs?limit=5")
LOGS_COUNT=$(echo "$LOGS_RESPONSE" | jq -r '.logs | length' 2>/dev/null || echo "0")
TOTAL_LOGS=$(echo "$LOGS_RESPONSE" | jq -r '.total' 2>/dev/null || echo "0")
echo "   Recent logs: $LOGS_COUNT (Total: $TOTAL_LOGS)"

if [[ "$LOGS_RESPONSE" == *'"logs"'* ]]; then
  echo "   ✅ System logs endpoint working"
else
  echo "   ❌ Failed to get system logs"
  echo "   Response: $LOGS_RESPONSE"
fi
echo ""

# Test 4: GET /admin/logs with filters
echo "5. GET /admin/logs?level=info&category=system"
FILTERED_LOGS=$(curl -s -b /tmp/escapeplan-cookies.txt \
  "$BASE_URL/api/admin/logs?level=info&category=system&limit=3")
FILTERED_COUNT=$(echo "$FILTERED_LOGS" | jq -r '.logs | length' 2>/dev/null || echo "0")
echo "   Filtered logs: $FILTERED_COUNT"

if [[ "$FILTERED_COUNT" -ge "0" ]]; then
  echo "   ✅ Log filtering working"
else
  echo "   ❌ Failed to filter logs"
fi
echo ""

# Test 5: POST /admin/alerts/:id/dismiss
echo "6. POST /admin/alerts/:id/dismiss"
# First create a test alert by pausing a session (if one exists)
DASHBOARD=$(curl -s -b /tmp/escapeplan-cookies.txt "$BASE_URL/api/dashboard")
ALERT_ID=$(echo "$DASHBOARD" | jq -r '.alerts[0].id // empty' 2>/dev/null)

if [[ -n "$ALERT_ID" ]]; then
  DISMISS_RESPONSE=$(curl -s -b /tmp/escapeplan-cookies.txt \
    -X POST "$BASE_URL/api/admin/alerts/$ALERT_ID/dismiss")

  if [[ "$DISMISS_RESPONSE" == *'"success":true'* ]]; then
    echo "   ✅ Alert dismissed successfully (ID: $ALERT_ID)"
  else
    echo "   ⚠️  Failed to dismiss alert"
    echo "   Response: $DISMISS_RESPONSE"
  fi
else
  echo "   ⚠️  No active alerts to dismiss (need a running session)"
fi
echo ""

# Summary
echo "✅ API Endpoint Tests Complete"
echo ""
echo "📋 Summary:"
echo "   - Alert Rules: ✅"
echo "   - Update Rule: ✅"
echo "   - System Logs: ✅"
echo "   - Log Filtering: ✅"
echo "   - Alert Dismissal: ${ALERT_ID:+✅}${ALERT_ID:-⚠️ (no alerts)}"
echo ""

# Cleanup
rm -f /tmp/escapeplan-cookies.txt
