#!/usr/bin/env bash
set -euo pipefail

HOST=${ESCAPEPLAN_PI_HOST:-}
USER=${ESCAPEPLAN_PI_USER:-escapeplan}
SSH_OPTS=${ESCAPEPLAN_SSH_OPTS:-"-o BatchMode=yes -o StrictHostKeyChecking=no"}

if [[ -z "$HOST" ]]; then
  cat <<'MSG' >&2
ESCAPEPLAN_PI_HOST is not set. Skipping hardware validation.
Provide the IP/hostname of a Raspberry Pi running the EscapePlan image, e.g.:
  export ESCAPEPLAN_PI_HOST=escapeplan.local
  export ESCAPEPLAN_PI_USER=escapeplan
Then re-run this script.
MSG
  exit 0
fi

ssh_cmd=(ssh $SSH_OPTS "${USER}@${HOST}")

run_remote() {
  local cmd="$1"
  "${ssh_cmd[@]}" "$cmd"
}

echo "Checking remote systemd services on ${HOST}..."

run_remote 'sudo systemctl is-enabled escapeplan-platform-init.service'
run_remote 'sudo systemctl is-active escapeplan-platform-init.service || true'
run_remote 'sudo systemctl is-enabled hostapd.service'
run_remote 'sudo systemctl is-active hostapd.service'
run_remote 'sudo systemctl is-enabled dnsmasq.service'
run_remote 'sudo systemctl is-active dnsmasq.service'
run_remote 'sudo systemctl is-enabled nginx.service'
run_remote 'sudo systemctl is-active nginx.service'
run_remote 'sudo systemctl is-enabled escapeplan-api.service || true'
run_remote 'sudo systemctl is-enabled escapeplan-web.service || true'

ip_info=$(run_remote "ip -o addr show wlan0" || true)
echo "wlan0 addresses: ${ip_info}"

echo "Hardware validation completed."
