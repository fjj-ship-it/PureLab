# -*- coding: utf-8 -*-
"""把 build/classes.dex 注入 aapt2 link 产物 build/app-unsigned.apk"""
import sys
import zipfile

src, dex = sys.argv[1], sys.argv[2]

with zipfile.ZipFile(src, "a") as z:
    z.write(dex, "classes.dex", compress_type=zipfile.ZIP_DEFLATED)

print("injected", dex, "->", src)
