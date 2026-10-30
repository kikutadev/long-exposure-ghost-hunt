#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
mkdir -p release
rm -f release/long-exposure-slapjam2.zip
(cd dist && zip -q -r ../release/long-exposure-slapjam2.zip .)
file release/long-exposure-slapjam2.zip
unzip -l release/long-exposure-slapjam2.zip | tail -3
