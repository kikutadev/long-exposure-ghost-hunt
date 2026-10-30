#!/usr/bin/env bash
# Publish the checked production build directly to gh-pages.
# No GitHub Actions: Pages reads the branch root.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build
origin="$(git remote get-url origin)"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git clone --quiet --single-branch --depth 1 --branch gh-pages "$origin" "$temp"
  find "$temp" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git -C "$temp" init -q -b gh-pages
  git -C "$temp" remote add origin "$origin"
fi
cp -R dist/. "$temp/"
touch "$temp/.nojekyll"
git -C "$temp" add -A
if ! git -C "$temp" diff --cached --quiet; then
  git -C "$temp" -c user.name="kikutadev" -c user.email="23694929+kikutadev@users.noreply.github.com" commit -qm "Deploy LONG EXPOSURE static build"
  git -C "$temp" push origin HEAD:gh-pages
fi
echo "Published static build on origin/gh-pages"
