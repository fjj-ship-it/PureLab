#!/bin/bash
# PureLab APK 无 Gradle 构建链：javac -> d8 -> aapt2 -> 注 dex -> zipalign -> keytool -> apksigner
set -e

ROOT="/c/Users/willion/WorkBuddy/2026-09-01-10-27-48/purelab-apk"
SDK="/c/Users/willion/AppData/Local/Android/Sdk"
BT="$SDK/build-tools/35.0.0"
PLAT="$SDK/platforms/android-35/android.jar"
JDK="$ROOT/tools/jdk-17.0.20.1+1/bin"

export PATH="$JDK:$PATH"
cd "$ROOT"
mkdir -p build/obj

# Windows 原生工具需要 C:\ 风格路径
W_PLAT="$(cygpath -w "$PLAT")"

echo "[1/8] javac ..."
javac -source 1.8 -target 1.8 -nowarn -encoding UTF-8 \
  -classpath "$W_PLAT" \
  -d build/obj app/src/com/purelab/app/MainActivity.java

echo "[2/8] d8 ..."
cd build/obj && "$BT/d8.bat" --release --lib "$W_PLAT" --output .. com/purelab/app/*.class && cd ../..

echo "[3/8] aapt2 compile ..."
"$BT/aapt2.exe" compile --dir app/res -o build/res.zip

echo "[4/8] aapt2 link ..."
"$BT/aapt2.exe" link -o build/app-unsigned.apk -I "$W_PLAT" \
  --manifest app/AndroidManifest.xml \
  -A app/assets \
  --min-sdk-version 24 --target-sdk-version 35 \
  --auto-add-overlay \
  build/res.zip

echo "[5/8] inject classes.dex ..."
python "$(cygpath -w "$ROOT/add_dex.py")" "$(cygpath -w "$ROOT/build/app-unsigned.apk")" "$(cygpath -w "$ROOT/build/classes.dex")"

echo "[6/8] zipalign ..."
"$BT/zipalign.exe" -f 4 build/app-unsigned.apk build/app-aligned.apk

echo "[7/8] keytool ..."
if [ ! -f build/purelab.keystore ]; then
  keytool -genkeypair -v \
    -keystore build/purelab.keystore -storetype PKCS12 \
    -storepass purelab123 -keypass purelab123 -alias purelab \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=PureLab, OU=Lab, O=PureLab, L=Wuhan, ST=Hubei, C=CN"
fi

echo "[8/8] apksigner sign ..."
"$BT/apksigner.bat" sign \
  --ks build/purelab.keystore --ks-pass pass:purelab123 --ks-key-alias purelab \
  --out PureLab-v1.0-debug.apk build/app-aligned.apk

"$BT/apksigner.bat" verify --print-certs PureLab-v1.0-debug.apk

echo ""
echo "DONE -> $ROOT/PureLab-v1.0-debug.apk"
ls -la PureLab-v1.0-debug.apk
