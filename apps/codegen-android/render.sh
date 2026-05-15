#!/usr/bin/env bash
# Renders the Android template into build/{APP_TYPE}/ with substitutions.
# Required env vars: APP_NAME, APP_TYPE, PACKAGE_NAME, APP_URL
set -euo pipefail

: "${APP_NAME:?APP_NAME required}"
: "${APP_TYPE:?APP_TYPE required}"
: "${PACKAGE_NAME:?PACKAGE_NAME required}"
: "${APP_URL:?APP_URL required}"

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/template"
OUT="$ROOT/build/$APP_TYPE"

rm -rf "$OUT"
mkdir -p "$OUT"

# Convert package name like com.acme.myapp to com/acme/myapp for source dirs.
PACKAGE_PATH="${PACKAGE_NAME//.//}"

# Copy non-templated files first.
cp "$SRC/settings.gradle.kts"          "$OUT/settings.gradle.kts"
cp "$SRC/build.gradle.kts"             "$OUT/build.gradle.kts"
cp "$SRC/gradle.properties"            "$OUT/gradle.properties"

# Render templated files via sed.
mkdir -p "$OUT/app"
sed -e "s|{{APP_NAME}}|$APP_NAME|g" -e "s|{{APP_TYPE}}|$APP_TYPE|g" -e "s|{{PACKAGE_NAME}}|$PACKAGE_NAME|g" -e "s|{{APP_URL}}|$APP_URL|g" \
  "$SRC/app/build.gradle.kts.tmpl" > "$OUT/app/build.gradle.kts"

mkdir -p "$OUT/app/src/main"
sed -e "s|{{APP_NAME}}|$APP_NAME|g" -e "s|{{APP_TYPE}}|$APP_TYPE|g" -e "s|{{PACKAGE_NAME}}|$PACKAGE_NAME|g" -e "s|{{APP_URL}}|$APP_URL|g" \
  "$SRC/app/src/main/AndroidManifest.xml.tmpl" > "$OUT/app/src/main/AndroidManifest.xml"

mkdir -p "$OUT/app/src/main/java/$PACKAGE_PATH"
sed -e "s|{{APP_NAME}}|$APP_NAME|g" -e "s|{{APP_TYPE}}|$APP_TYPE|g" -e "s|{{PACKAGE_NAME}}|$PACKAGE_NAME|g" -e "s|{{APP_URL}}|$APP_URL|g" \
  "$SRC/app/src/main/java/MainActivity.kt.tmpl" > "$OUT/app/src/main/java/$PACKAGE_PATH/MainActivity.kt"

mkdir -p "$OUT/app/src/main/res/values"
sed -e "s|{{APP_NAME}}|$APP_NAME|g" -e "s|{{APP_TYPE}}|$APP_TYPE|g" -e "s|{{PACKAGE_NAME}}|$PACKAGE_NAME|g" -e "s|{{APP_URL}}|$APP_URL|g" \
  "$SRC/app/src/main/res/values/strings.xml.tmpl" > "$OUT/app/src/main/res/values/strings.xml"
cp "$SRC/app/src/main/res/values/themes.xml" "$OUT/app/src/main/res/values/themes.xml"

mkdir -p "$OUT/app/src/main/res/xml"
cp "$SRC/app/src/main/res/xml/network_security_config.xml" "$OUT/app/src/main/res/xml/network_security_config.xml"

# Launcher icons: try to download the AI-generated icon from apps.stakgod.com
# and resize via ImageMagick. Fall back to a solid flame square if download or
# convert is unavailable.
ICON_URL="${ICON_URL:-${APP_URL%/}/icon.png}"
SRC_ICON="$(mktemp -t stakgod-icon-XXXXXX).png"
HAS_REAL_ICON=0
if curl -fsSL --max-time 30 "$ICON_URL" -o "$SRC_ICON" 2>/dev/null && command -v convert >/dev/null 2>&1; then
  HAS_REAL_ICON=1
  echo "icon: downloaded from $ICON_URL, will resize via ImageMagick"
fi

flame_square() {
  local out="$1" size="$2"
  python3 - "$out" "$size" <<'PY'
import sys, struct, zlib
path, size = sys.argv[1], int(sys.argv[2])
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
sig = b'\x89PNG\r\n\x1a\n'
ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
row = b'\x00' + (b'\xff\x5b\x1f' * size)
raw = row * size
idat = chunk(b'IDAT', zlib.compress(raw))
iend = chunk(b'IEND', b'')
open(path,'wb').write(sig+ihdr+idat+iend)
PY
}
make_icon() {
  local out="$1" size="$2"
  if [ "$HAS_REAL_ICON" = "1" ]; then
    convert "$SRC_ICON" -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" "$out"
  else
    flame_square "$out" "$size"
  fi
}
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  density="${d%:*}"; size="${d#*:}"
  mkdir -p "$OUT/app/src/main/res/mipmap-$density"
  make_icon "$OUT/app/src/main/res/mipmap-$density/ic_launcher.png"       "$size"
  make_icon "$OUT/app/src/main/res/mipmap-$density/ic_launcher_round.png" "$size"
done
rm -f "$SRC_ICON"

echo "rendered $OUT"
