#!/usr/bin/env bash
set -euo pipefail

on_chroot <<'IN_CHROOT'
set -euo pipefail
NODE_MAJOR=22
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor >/usr/share/keyrings/nodesource.gpg
cat <<'REPO' >/etc/apt/sources.list.d/nodesource.list
deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main
REPO
apt-get update
apt-get install -y nodejs build-essential python3 python3-pip
corepack enable
corepack prepare pnpm@10.12.4 --activate
npm config set update-notifier false
npm config set fund false
IN_CHROOT
