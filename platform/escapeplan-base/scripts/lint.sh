#!/usr/bin/env bash
set -euo pipefail

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "shellcheck not found; skipping lint. Install with 'sudo apt install shellcheck' for full coverage." >&2
  exit 0
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

mapfile -t SHELL_FILES < <(find "${ROOT_DIR}" \
  -type f \
  \( -name '*.sh' -o -path '*/usr/local/sbin/*' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/work/*' \
  -not -path '*/deploy/*')

if [[ ${#SHELL_FILES[@]} -eq 0 ]]; then
  echo "No shell files detected."
  exit 0
fi

declare -A CHECKED

for file in "${SHELL_FILES[@]}"; do
  if [[ -n "${CHECKED[$file]:-}" ]]; then
    continue
  fi
  if [[ "$file" == *.sh ]] || head -n1 "$file" | grep -q '#!/usr/bin/env bash'; then
    shellcheck "$file"
    CHECKED[$file]=1
  fi
done

echo "shellcheck completed successfully."
