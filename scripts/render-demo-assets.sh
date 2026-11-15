#!/usr/bin/env bash
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
cd "$(dirname "$0")/.."
mkdir -p assets/demo
for f in scripts/demo-assets/*.html; do
  n=$(basename "$f" .html)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=390,844 --screenshot="assets/demo/$n.png" "file://$PWD/$f" >/dev/null 2>&1
  sips -Z 1280 "assets/demo/$n.png" >/dev/null
done
cp assets/demo/*.png convex/ai/fixtures/
