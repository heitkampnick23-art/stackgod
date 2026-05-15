#!/usr/bin/env bash
# Render iOS template into ./build/<APP_TYPE>/ from environment vars.
# Vars: APP_NAME, APP_TYPE, BUNDLE_ID, TEAM_ID, APP_URL.
# Optional: ICON_URL (defaults to APP_URL/icon.png) — downloaded into the asset
# catalog so AppIcon is real, not a placeholder. Falls back to a flame square.
set -euo pipefail

: "${APP_NAME:?}" "${APP_TYPE:?}" "${BUNDLE_ID:?}" "${TEAM_ID:?}" "${APP_URL:?}"
ICON_URL="${ICON_URL:-${APP_URL%/}/icon.png}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/build/${APP_TYPE}"
rm -rf "$OUT"
mkdir -p "$OUT/Sources"
mkdir -p "$OUT/Resources/Assets.xcassets/AppIcon.appiconset"

substitute() {
  sed \
    -e "s|{{APP_NAME}}|${APP_NAME}|g" \
    -e "s|{{APP_TYPE}}|${APP_TYPE}|g" \
    -e "s|{{BUNDLE_ID}}|${BUNDLE_ID}|g" \
    -e "s|{{TEAM_ID}}|${TEAM_ID}|g" \
    -e "s|{{APP_URL}}|${APP_URL}|g"
}

substitute < "$HERE/template/project.yml.tmpl"        > "$OUT/project.yml"
substitute < "$HERE/template/Sources/App.swift.tmpl"  > "$OUT/Sources/${APP_TYPE}App.swift"
substitute < "$HERE/template/ExportOptions.plist.tmpl" > "$OUT/ExportOptions.plist"

# Empty entitlements stub — xcodegen fills it from project.yml entitlements block.
cat > "$OUT/Sources/${APP_TYPE}.entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
PLIST

# AppIcon.appiconset — iOS 14+ single-size manifest. 1024x1024 source covers all sizes.
ICON_DST="$OUT/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
if curl -fsSL --max-time 30 "$ICON_URL" -o "$ICON_DST" 2>/dev/null; then
  echo "icon: downloaded from $ICON_URL"
  # Force RGB (no alpha) — Apple rejects PNGs with alpha for AppIcon.
  if command -v sips >/dev/null 2>&1; then
    sips -s format png -s formatOptions normal --setProperty hasAlpha NO "$ICON_DST" --out "$ICON_DST" >/dev/null 2>&1 || true
  fi
else
  echo "icon: download failed, generating flame fallback"
  python3 - "$ICON_DST" <<'PY'
import sys, struct, zlib
path = sys.argv[1]; size = 1024
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
sig = b'\x89PNG\r\n\x1a\n'
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
row = b'\x00' + (b'\xff\x5b\x1f' * size)
raw = row * size
idat = chunk(b'IDAT', zlib.compress(raw))
iend = chunk(b'IEND', b'')
open(path, 'wb').write(sig + ihdr + idat + iend)
PY
fi

cat > "$OUT/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json" <<'JSON'
{
  "images": [
    { "filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" }
  ],
  "info": { "author": "stakgod", "version": 1 }
}
JSON
cat > "$OUT/Resources/Assets.xcassets/Contents.json" <<'JSON'
{ "info": { "author": "stakgod", "version": 1 } }
JSON

echo "rendered → $OUT"
