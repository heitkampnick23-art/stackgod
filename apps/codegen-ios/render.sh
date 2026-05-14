#!/usr/bin/env bash
# Render iOS template into ./build/<APP_TYPE>/ from environment vars.
# Vars: APP_NAME, APP_TYPE, BUNDLE_ID, TEAM_ID, APP_URL.
set -euo pipefail

: "${APP_NAME:?}" "${APP_TYPE:?}" "${BUNDLE_ID:?}" "${TEAM_ID:?}" "${APP_URL:?}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/build/${APP_TYPE}"
rm -rf "$OUT"
mkdir -p "$OUT/Sources"

substitute() {
  sed \
    -e "s|{{APP_NAME}}|${APP_NAME}|g" \
    -e "s|{{APP_TYPE}}|${APP_TYPE}|g" \
    -e "s|{{BUNDLE_ID}}|${BUNDLE_ID}|g" \
    -e "s|{{TEAM_ID}}|${TEAM_ID}|g" \
    -e "s|{{APP_URL}}|${APP_URL}|g"
}

substitute < "$HERE/template/project.yml.tmpl"             > "$OUT/project.yml"
substitute < "$HERE/template/Sources/App.swift.tmpl"        > "$OUT/Sources/${APP_TYPE}App.swift"
substitute < "$HERE/template/ExportOptions.plist.tmpl"      > "$OUT/ExportOptions.plist"

# Empty entitlements stub — xcodegen fills it from project.yml entitlements block.
cat > "$OUT/Sources/${APP_TYPE}.entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
PLIST

echo "rendered → $OUT"
