#!/bin/sh
# Installed as the Agent37 post-restart hook. Config contains ONLY a start capability.
set -eu
config=/home/node/.agent37/signals-boot.curl
deadline=$(( $(date +%s) + 240 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if curl --config "$config" --request POST --fail --silent --show-error \
    --connect-timeout 5 --max-time 20 --output /dev/null; then
    echo 'Research worker ready.'
    exit 0
  fi
  sleep 5
done
echo 'Research worker did not become ready; check its startup log.' >&2
exit 1
