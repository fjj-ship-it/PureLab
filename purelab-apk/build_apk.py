# -*- coding: utf-8 -*-
"""PureLab APK 本地重打包（纯 Python 驱动，不依赖 bash / cmd）。

为什么不用 build_local.sh：
    本机 `bash` 会被安全策略拦到 WSL、`cmd.exe` 也被拦，脚本里的 grep/cut/tr/cygpath 用不了。
    这里直接用 JDK 的 java 驱动 build-tools 里的 d8.jar / apksigner.jar，
    aapt2 / zipalign 本身是 exe，直接调用 —— 完全不经过 shell。

链路：javac -> d8 -> aapt2 compile -> aapt2 link -> 注入 classes.dex -> zipalign -> apksigner sign

用法：
    python build_apk.py
产物：
    purelab-apk/PureLab-v{版本名}-release.apk（versionCode 每次构建自增）
"""
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SDK = r"C:\Users\willion\AppData\Local\Android\Sdk"
TOOLS = r"C:\Users\willion\WorkBuddy\2026-09-01-10-27-48\purelab-apk\tools"
BT = os.path.join(SDK, "build-tools", "35.0.0")
PLAT = os.path.join(SDK, "platforms", "android-35", "android.jar")
JDK = os.path.join(TOOLS, "jdk-17.0.20.1+1", "bin")
PY = r"D:\work Buddy\WorkBuddyData\.workbuddy\binaries\python\versions\3.13.12\python.exe"

JAVAC = os.path.join(JDK, "javac.exe")
JAVA = os.path.join(JDK, "java.exe")
KEYTOOL = os.path.join(JDK, "keytool.exe")
D8_JAR = os.path.join(BT, "lib", "d8.jar")
APKSIGNER_JAR = os.path.join(BT, "lib", "apksigner.jar")
AAPT2 = os.path.join(BT, "aapt2.exe")
ZIPALIGN = os.path.join(BT, "zipalign.exe")

BUILD = os.path.join(ROOT, "build")
OBJ = os.path.join(BUILD, "obj")
VERFILE = os.path.join(ROOT, "app", "version.properties")
KEYSTORE = os.path.join(BUILD, "purelab.keystore")
KS_PASS = "purelab123"
KS_ALIAS = "purelab"


def run(step, args, cwd=None):
    print("\n[%s]" % step)
    print("  " + " ".join('"%s"' % a if " " in a else a for a in args))
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    out = (p.stdout or "") + (p.stderr or "")
    out = out.strip()
    if out:
        print("  " + out.replace("\n", "\n  "))
    if p.returncode != 0:
        raise SystemExit("\n构建失败：%s 退出码 %d" % (step, p.returncode))
    return out


def read_version():
    txt = open(VERFILE, encoding="utf-8").read() if os.path.exists(VERFILE) else ""
    vc = re.search(r"^VERSION_CODE=(\d+)", txt, re.M)
    vn = re.search(r"^VERSION_NAME=([\d.]+)", txt, re.M)
    if not vc or not vn:
        raise SystemExit("version.properties 缺少 VERSION_CODE / VERSION_NAME：%s" % VERFILE)
    return int(vc.group(1)), vn.group(1)


def main():
    for p in (JAVAC, JAVA, D8_JAR, APKSIGNER_JAR, AAPT2, ZIPALIGN, PLAT):
        if not os.path.exists(p):
            raise SystemExit("找不到构建依赖：%s" % p)

    os.makedirs(OBJ, exist_ok=True)
    vc, vn = read_version()
    apk_out = os.path.join(ROOT, "PureLab-v%s-release.apk" % vn)
    print("== build versionCode=%d versionName=%s -> %s ==" % (vc, vn, os.path.basename(apk_out)))

    run("1/8 javac", [JAVAC, "-source", "1.8", "-target", "1.8", "-nowarn", "-encoding", "UTF-8",
                      "-classpath", PLAT, "-d", OBJ,
                      os.path.join(ROOT, "app", "src", "com", "purelab", "app", "MainActivity.java")])

    # v43 关键修复：必须把**全部** class 文件交给 d8。
    # 之前只传 MainActivity.class，内部类（MainActivity$1 匿名 WebChromeClient、
    # $2、$Bridge JS 桥）没进 dex → 启动 onCreate 一 new WebChromeClient 就
    # NoClassDefFoundError 闪退（所有 APK 从 v2.8.0 起都带此病）。
    class_files = sorted(glob.glob(os.path.join(OBJ, "com", "purelab", "app", "*.class")))
    if not class_files:
        raise SystemExit("javac 未产出任何 class 文件：%s" % OBJ)
    print("  待打包 class: %d 个 -> %s" % (len(class_files),
          ", ".join(os.path.basename(c) for c in class_files)))
    run("2/8 d8", [JAVA, "-cp", D8_JAR, "com.android.tools.r8.D8", "--release",
                   "--lib", PLAT, "--output", BUILD] + class_files)

    run("3/8 aapt2 compile", [AAPT2, "compile", "--dir", os.path.join(ROOT, "app", "res"),
                              "-o", os.path.join(BUILD, "res.zip")])

    run("4/8 aapt2 link", [AAPT2, "link",
                           "-o", os.path.join(BUILD, "app-unsigned.apk"),
                           "-I", PLAT,
                           "--manifest", os.path.join(ROOT, "app", "AndroidManifest.xml"),
                           "-A", os.path.join(ROOT, "app", "assets"),
                           "--min-sdk-version", "24", "--target-sdk-version", "35",
                           "--version-code", str(vc), "--version-name", vn,
                           "--auto-add-overlay",
                           os.path.join(BUILD, "res.zip")])

    run("5/8 inject classes.dex", [PY, os.path.join(ROOT, "add_dex.py"),
                                   os.path.join(BUILD, "app-unsigned.apk"),
                                   os.path.join(BUILD, "classes.dex")])

    run("6/8 zipalign", [ZIPALIGN, "-f", "4",
                         os.path.join(BUILD, "app-unsigned.apk"),
                         os.path.join(BUILD, "app-aligned.apk")])

    print("\n[7/8 keystore]")
    if not os.path.exists(KEYSTORE):
        run("7/8 keytool", [KEYTOOL, "-genkeypair", "-v",
                            "-keystore", KEYSTORE, "-storetype", "PKCS12",
                            "-storepass", KS_PASS, "-keypass", KS_PASS, "-alias", KS_ALIAS,
                            "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
                            "-dname", "CN=PureLab, OU=Lab, O=PureLab, L=Wuhan, ST=Hubei, C=CN"])
    else:
        print("  已存在，复用 %s" % KEYSTORE)

    run("8/8 apksigner sign", [JAVA, "-jar", APKSIGNER_JAR, "sign",
                               # v43 兼容性修复：显式启用 v1（JAR）签名。
                               # 之前只签了 v2+v3，部分国产 ROM / 下载器安装流程对
                               # v2-only 包会报「解析失败」，v1 缺失是最可疑的硬伤。
                               "--v1-signing-enabled", "true",
                               "--v2-signing-enabled", "true",
                               "--v3-signing-enabled", "true",
                               "--ks", KEYSTORE, "--ks-pass", "pass:" + KS_PASS,
                               "--ks-key-alias", KS_ALIAS,
                               "--out", apk_out,
                               os.path.join(BUILD, "app-aligned.apk")])

    # versionCode 落盘自增，供下次构建使用
    with open(VERFILE, "w", encoding="utf-8", newline="\n") as f:
        f.write("VERSION_CODE=%d\nVERSION_NAME=%s\n" % (vc + 1, vn))

    certs = run("verify", [JAVA, "-jar", APKSIGNER_JAR, "verify", "--print-certs", apk_out])

    size = os.path.getsize(apk_out)
    print("\nDONE -> %s" % apk_out)
    print("  大小        %s 字节 (%s KB)" % (size, round(size / 1024, 1)))
    print("  versionCode %d / versionName %s（下次构建用 %d）" % (vc, vn, vc + 1))
    if certs:
        print("  签名        " + (certs.splitlines()[0] if certs.splitlines() else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
