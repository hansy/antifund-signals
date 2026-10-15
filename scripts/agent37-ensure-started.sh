#!/bin/sh
# Installed root-owned, mode 0700. Repeated boot requests cannot spawn duplicates.
set -eu
cd /root/signals-worker
exec 9>launch.lock
flock -n 9 || exit 75
if flock -n process.lock true; then
  rm -f ready.json
  nohup ./start.sh </dev/null >/dev/null 2>&1 9>&- &
  sleep 1
fi
# Readiness is written only after remote-response reconciliation and lease acquisition.
if ! flock -n process.lock true && test -s ready.json; then
  exit 0
fi
exit 75
