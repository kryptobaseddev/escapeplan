#!/bin/bash

# Simple validation test script
# Tests improved error messages

API_URL="http://localhost:4000/api"

echo "Testing improved validation error messages..."
echo "=============================================="
echo ""

echo "1. Test Game Validation (missing pricing)"
curl -s -X POST "$API_URL/admin/games" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Game",
    "slug": "test-game",
    "description": "Test",
    "durationMinutes": 60
  }' | jq '.message, .fields.pricing' 2>/dev/null || echo "API not running or no jq installed"

echo ""
echo "2. Test User Validation (short password)"
curl -s -X POST "$API_URL/admin/users" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test",
    "name": "Test User",
    "role": "game_master",
    "password": "short"
  }' | jq '.message, .fields.password' 2>/dev/null || echo "API not running or no jq installed"

echo ""
echo "3. Test Network Validation (missing ssid)"
curl -s -POST "$API_URL/admin/network/client" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "testpass"
  }' | jq '.message, .fields.ssid' 2>/dev/null || echo "API not running or no jq installed"

echo ""
echo "=============================================="
echo "Validation tests complete!"
