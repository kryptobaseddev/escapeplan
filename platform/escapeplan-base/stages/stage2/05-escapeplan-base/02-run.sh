#!/usr/bin/env bash
set -euo pipefail

on_chroot <<'IN_CHROOT'
set -euo pipefail

if ! id escapeplan >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/escapeplan --shell /usr/sbin/nologin escapeplan
fi
usermod -a -G video,audio escapeplan || true

install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan
install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/assets
install -d -o escapeplan -g escapeplan -m 0755 /var/lib/escapeplan/hls
install -d -o escapeplan -g escapeplan -m 0750 /var/lib/escapeplan/backups
install -d -o escapeplan -g escapeplan -m 0755 /var/log/escapeplan
install -d -o escapeplan -g escapeplan -m 0755 /opt/escapeplan
install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan
install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/certs
install -d -o escapeplan -g escapeplan -m 0755 /etc/escapeplan/templates

for bin in escapeplan-platform-init escapeplan-certgen escapeplan-config-apply; do
  if [ -f "/usr/local/sbin/${bin}" ]; then
    chmod 0755 "/usr/local/sbin/${bin}"
  fi
done

rm -f /etc/systemd/system/multi-user.target.wants/hostapd.service
rm -f /etc/systemd/system/multi-user.target.wants/dnsmasq.service
rm -f /etc/systemd/system/multi-user.target.wants/nginx.service

ln -sf /etc/systemd/system/escapeplan-platform-init.service \
  /etc/systemd/system/multi-user.target.wants/escapeplan-platform-init.service
ln -sf /etc/systemd/system/escapeplan-certgen.service \
  /etc/systemd/system/multi-user.target.wants/escapeplan-certgen.service

printf 'version=%s\n' '0.1.0-dev' >/etc/escapeplan/version
IN_CHROOT
