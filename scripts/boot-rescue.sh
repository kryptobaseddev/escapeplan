#!/bin/bash
# EscapePlan Boot Rescue Service
# Prevents boot loops by tracking consecutive boot failures and entering rescue mode

set -euo pipefail

# Configuration
BOOT_COUNT_FILE="/var/lib/escapeplan/.boot-count"
RESCUE_MODE_FILE="/var/lib/escapeplan/.rescue-mode"
MAX_BOOT_FAILURES=3
UPTIME_SUCCESS_THRESHOLD=300  # 5 minutes in seconds
DATA_DIR="/var/lib/escapeplan"

# Logging function
log() {
    echo "[boot-rescue] $1" | systemd-cat -t escapeplan-rescue -p info
}

log_error() {
    echo "[boot-rescue] ERROR: $1" | systemd-cat -t escapeplan-rescue -p err
}

# Ensure data directory exists
if [ ! -d "${DATA_DIR}" ]; then
    log "Creating data directory: ${DATA_DIR}"
    mkdir -p "${DATA_DIR}"
    chown escapeplan:escapeplan "${DATA_DIR}"
fi

# Initialize boot count file if it doesn't exist
if [ ! -f "${BOOT_COUNT_FILE}" ]; then
    log "Initializing boot counter"
    echo "0" > "${BOOT_COUNT_FILE}"
    chown escapeplan:escapeplan "${BOOT_COUNT_FILE}"
fi

# Read current boot count
BOOT_COUNT=$(cat "${BOOT_COUNT_FILE}")
log "Current boot count: ${BOOT_COUNT}"

# Increment boot count
BOOT_COUNT=$((BOOT_COUNT + 1))
echo "${BOOT_COUNT}" > "${BOOT_COUNT_FILE}"
log "Incremented boot count to: ${BOOT_COUNT}"

# Check if we've exceeded the failure threshold
if [ ${BOOT_COUNT} -ge ${MAX_BOOT_FAILURES} ]; then
    log_error "Boot failure threshold exceeded (${BOOT_COUNT} >= ${MAX_BOOT_FAILURES})"
    log_error "Entering rescue mode to prevent boot loop"

    # Create rescue mode flag
    touch "${RESCUE_MODE_FILE}"
    chown escapeplan:escapeplan "${RESCUE_MODE_FILE}"

    # Disable escapeplan services to prevent boot loop
    log "Disabling escapeplan-api.service"
    systemctl disable escapeplan-api.service || true

    log "Disabling escapeplan-web.service"
    systemctl disable escapeplan-web.service || true

    # Log instructions for recovery
    log_error "=========================================="
    log_error "RESCUE MODE ACTIVATED"
    log_error "=========================================="
    log_error "EscapePlan services have been disabled to prevent boot loops."
    log_error ""
    log_error "To diagnose the issue:"
    log_error "  1. Check system logs: journalctl -u escapeplan-api -u escapeplan-web --since today"
    log_error "  2. Check health status: /opt/escapeplan/scripts/health-check.sh"
    log_error "  3. Review installation log: /tmp/escapeplan-postinst.log"
    log_error ""
    log_error "To exit rescue mode after fixing the issue:"
    log_error "  1. Remove rescue flag: rm ${RESCUE_MODE_FILE}"
    log_error "  2. Reset boot counter: echo 0 > ${BOOT_COUNT_FILE}"
    log_error "  3. Re-enable services: systemctl enable escapeplan-api escapeplan-web"
    log_error "  4. Start services: systemctl start escapeplan-api escapeplan-web"
    log_error "=========================================="

    exit 0
fi

log "Boot count within acceptable range (${BOOT_COUNT}/${MAX_BOOT_FAILURES})"
log "Starting success monitor in background (will reset counter after ${UPTIME_SUCCESS_THRESHOLD}s uptime)"

# Background process to reset counter after successful uptime
(
    sleep ${UPTIME_SUCCESS_THRESHOLD}

    # Check if boot counter still exists (system may have rebooted)
    if [ -f "${BOOT_COUNT_FILE}" ]; then
        CURRENT_COUNT=$(cat "${BOOT_COUNT_FILE}")
        if [ "${CURRENT_COUNT}" -eq "${BOOT_COUNT}" ]; then
            log "System stable for ${UPTIME_SUCCESS_THRESHOLD}s - resetting boot counter"
            echo "0" > "${BOOT_COUNT_FILE}"

            # Remove rescue mode file if it exists
            if [ -f "${RESCUE_MODE_FILE}" ]; then
                log "Removing rescue mode flag"
                rm -f "${RESCUE_MODE_FILE}"
            fi
        else
            log "Boot count changed (${CURRENT_COUNT} != ${BOOT_COUNT}), skipping reset"
        fi
    fi
) &

log "Boot rescue check complete - system allowed to continue"
exit 0
