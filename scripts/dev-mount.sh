#!/usr/bin/env bash
# One-time local fix for developing on a CIFS/SMB mounted workspace.
#
# Problem: Node's async fs (libuv threadpool) randomly returns EINVAL when
# reading files freshly written on a CIFS mount (cache=strict). This breaks
# tsc / vite / vitest on every run.
#
# Fix: keep the real repo on local ext4 (/home/ted/ritedown) and bind-mount it
# over the CIFS workspace path. All tool IO then hits ext4.
#
# Usage: sudo ./scripts/dev-mount.sh
set -euo pipefail

LOCAL_DIR="/home/ted/ritedown"
MOUNT_POINT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "run with sudo"; exit 1
fi

mkdir -p "$LOCAL_DIR"

if ! mountpoint -q "$MOUNT_POINT/node_modules" 2>/dev/null; then
  :
fi

if mountpoint -q "$MOUNT_POINT"; then
  echo "already mounted"; exit 0
fi

# seed local dir from the CIFS copy if empty
if [ -z "$(ls -A "$LOCAL_DIR")" ]; then
  rsync -a --exclude node_modules --exclude dist "$MOUNT_POINT/" "$LOCAL_DIR/"
fi

mount --bind "$LOCAL_DIR" "$MOUNT_POINT"
echo "bind mounted $LOCAL_DIR -> $MOUNT_POINT"
echo "note: does not survive reboot; rerun after restart"
