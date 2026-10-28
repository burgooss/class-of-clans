#!/usr/bin/env bash
# Compila el APK de la app (versión release, firmada con tu clave) y lo deja en dist/.
#
# Uso:  npm run build:apk
# Requisitos y detalles: docs/apk.md
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
KEYS="$HOME/.clash-builders/keystore.properties"

if [ ! -d "$ANDROID_HOME" ]; then
  echo "No se encontró el Android SDK en $ANDROID_HOME (define ANDROID_HOME)." >&2
  exit 1
fi
if [ ! -f "$KEYS" ]; then
  echo "Falta $KEYS: crea la clave de firma primero (ver docs/apk.md)." >&2
  exit 1
fi

VERSION="$(node -p "require('./app.json').expo.version")"
CODE="$(node -p "require('./app.json').expo.android.versionCode")"

# Regenera la carpeta android/ desde app.json (está en .gitignore; nunca se edita a mano).
npx expo prebuild --platform android --clean --no-install
# prebuild cambia el script "android" de package.json; se deja como estaba.
npm pkg set scripts.android="expo start --android" >/dev/null

(cd android && ./gradlew assembleRelease)

mkdir -p dist
APK="dist/clash-builders-${VERSION}-${CODE}.apk"
cp android/app/build/outputs/apk/release/app-release.apk "$APK"
echo
echo "APK listo: $(pwd)/$APK ($(du -h "$APK" | cut -f1))"
