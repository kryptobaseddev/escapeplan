#!/bin/bash
# Test script for graceful shutdown fix
# Run this on the production server at 10.0.10.138

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Graceful Shutdown Fix - Test Script"
echo "========================================="
echo

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $message"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC}: $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $message"
    else
        echo "$message"
    fi
}

# Test 1: Check if service is running
echo "Test 1: Checking service status..."
if systemctl is-active --quiet escapeplan-api; then
    print_status "PASS" "Service is running"
else
    print_status "FAIL" "Service is not running"
    exit 1
fi
echo

# Test 2: Measure shutdown time
echo "Test 2: Measuring shutdown time..."
echo "Restarting service..."

START_TIME=$(date +%s)
sudo systemctl restart escapeplan-api
END_TIME=$(date +%s)
SHUTDOWN_TIME=$((END_TIME - START_TIME))

echo "Shutdown time: ${SHUTDOWN_TIME} seconds"

if [ $SHUTDOWN_TIME -lt 10 ]; then
    print_status "PASS" "Shutdown completed in ${SHUTDOWN_TIME}s (< 10s target)"
else
    print_status "FAIL" "Shutdown took ${SHUTDOWN_TIME}s (> 10s target)"
fi
echo

# Test 3: Check logs for graceful shutdown messages
echo "Test 3: Checking logs for graceful shutdown messages..."
LOGS=$(sudo journalctl -u escapeplan-api -n 50 --no-pager)

if echo "$LOGS" | grep -q "SIGTERM received"; then
    print_status "PASS" "Found 'SIGTERM received' message"
else
    print_status "FAIL" "Missing 'SIGTERM received' message"
fi

if echo "$LOGS" | grep -q "Closing Socket.IO connections"; then
    print_status "PASS" "Found 'Closing Socket.IO connections' message"
else
    print_status "FAIL" "Missing 'Closing Socket.IO connections' message"
fi

if echo "$LOGS" | grep -q "Socket.IO closed"; then
    print_status "PASS" "Found 'Socket.IO closed' message"
else
    print_status "FAIL" "Missing 'Socket.IO closed' message"
fi

if echo "$LOGS" | grep -q "Graceful shutdown complete"; then
    print_status "PASS" "Found 'Graceful shutdown complete' message"
else
    print_status "FAIL" "Missing 'Graceful shutdown complete' message"
fi
echo

# Test 4: Check for SIGKILL messages
echo "Test 4: Checking for SIGKILL messages..."
if echo "$LOGS" | grep -iq "killing\|sigkill"; then
    print_status "FAIL" "Found SIGKILL or Killing messages in logs"
    echo "$LOGS" | grep -i "killing\|sigkill"
else
    print_status "PASS" "No SIGKILL or Killing messages found"
fi
echo

# Test 5: Verify service is running after restart
echo "Test 5: Verifying service is running after restart..."
sleep 2  # Give service time to fully start

if systemctl is-active --quiet escapeplan-api; then
    print_status "PASS" "Service is running after restart"
else
    print_status "FAIL" "Service failed to start after restart"
    sudo systemctl status escapeplan-api
    exit 1
fi
echo

# Test 6: Check for errors in logs
echo "Test 6: Checking for errors in logs..."
if echo "$LOGS" | grep -iq "error"; then
    print_status "WARN" "Found error messages in logs"
    echo "$LOGS" | grep -i "error" | tail -5
else
    print_status "PASS" "No error messages in recent logs"
fi
echo

# Test 7: Test API connectivity
echo "Test 7: Testing API connectivity..."
if curl -f -s http://localhost:4000/health > /dev/null 2>&1; then
    print_status "PASS" "API health check passed"
else
    print_status "FAIL" "API health check failed"
fi
echo

echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Shutdown time: ${SHUTDOWN_TIME}s (target: <10s)"
echo
echo "Review the results above. All tests should pass."
echo "If any tests failed, check the logs with:"
echo "  sudo journalctl -u escapeplan-api -n 100"
echo
