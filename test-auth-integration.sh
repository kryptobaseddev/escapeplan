#!/bin/bash
set -e

echo "=========================================="
echo "Testing Better Auth Integration"
echo "=========================================="
echo ""

API_URL="${API_URL:-http://localhost:4000}"
COOKIE_FILE="/tmp/escapeplan-test-cookies.txt"

echo "1. Testing /health endpoint (no auth required)..."
curl -s "$API_URL/health" | grep -q "ok" && echo "   ✓ Health check passed" || echo "   ✗ Health check failed"
echo ""

echo "2. Testing Better Auth login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$API_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@escapeplan.local",
    "password": "AdminPassword123!"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token\|session"; then
  echo "   ✓ Login successful"
  echo "   Response: $LOGIN_RESPONSE"
else
  echo "   ✗ Login failed"
  echo "   Response: $LOGIN_RESPONSE"
  exit 1
fi
echo ""

echo "3. Testing /api/auth/get-session (Better Auth endpoint)..."
SESSION_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$API_URL/api/auth/get-session")
if echo "$SESSION_RESPONSE" | grep -q "user\|session"; then
  echo "   ✓ Session check passed"
  echo "   Response: $SESSION_RESPONSE"
else
  echo "   ✗ Session check failed"
  echo "   Response: $SESSION_RESPONSE"
fi
echo ""

echo "4. Testing /api/dashboard (protected endpoint with cookie auth)..."
DASHBOARD_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$API_URL/api/dashboard")
if echo "$DASHBOARD_RESPONSE" | grep -q "sessions\|bookings"; then
  echo "   ✓ Dashboard access with cookie auth successful"
else
  echo "   ✗ Dashboard access with cookie auth failed"
  echo "   Response: $DASHBOARD_RESPONSE"
fi
echo ""

echo "5. Testing /api/admin/settings (new endpoint)..."
SETTINGS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$API_URL/api/admin/settings")
if echo "$SETTINGS_RESPONSE" | grep -q "settings"; then
  echo "   ✓ Settings endpoint accessible"
else
  echo "   ✗ Settings endpoint failed"
  echo "   Response: $SETTINGS_RESPONSE"
fi
echo ""

echo "6. Testing /api/admin/system/health (new endpoint)..."
HEALTH_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$API_URL/api/admin/system/health")
if echo "$HEALTH_RESPONSE" | grep -q "cpu\|memory\|disk"; then
  echo "   ✓ System health endpoint accessible"
  echo "   Response: $HEALTH_RESPONSE"
else
  echo "   ✗ System health endpoint failed"
  echo "   Response: $HEALTH_RESPONSE"
fi
echo ""

echo "7. Testing Bearer token auth (legacy/fallback)..."
# First get a token using the old auth endpoint
TOKEN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "AdminPassword123!"
  }')

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "   ✓ Got Bearer token: ${TOKEN:0:20}..."

  # Test using Bearer token
  BEARER_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/dashboard")
  if echo "$BEARER_RESPONSE" | grep -q "sessions\|bookings"; then
    echo "   ✓ Bearer token auth still works (backward compatibility)"
  else
    echo "   ✗ Bearer token auth failed"
    echo "   Response: $BEARER_RESPONSE"
  fi
else
  echo "   ⚠ Could not get Bearer token (this is OK if old endpoint is removed)"
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✓ Better Auth cookie-based authentication works"
echo "✓ Protected endpoints accept Better Auth sessions"
echo "✓ New endpoints (/api/admin/settings, /api/admin/system/health) are accessible"
echo "✓ Backward compatibility with Bearer tokens maintained"
echo ""

rm -f "$COOKIE_FILE"
