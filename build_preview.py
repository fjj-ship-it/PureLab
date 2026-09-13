# -*- coding: utf-8 -*-
"""把 PureLab 打包成一个「自包含单文件」手机壳预览页。

做什么：
    读  app/assets/www/{index.html, app.css, app.js}
    →  把 <link>/<script> 换成内联的 <style>/<script>
    →  整体 base64 编码，填进 preview_shell.html 的 __APP_B64__ 占位符
    →  写出 preview.html（自包含，可直接在 WorkBuddy 侧边栏预览）

为什么不用 iframe src 指向 index.html：
    预览页与 App 必须同源才能跳屏、注入安全区；而 srcdoc 装载的内联文档
    天然与父页同源，所以 file:// / http:// / 侧边栏预览三种环境都能直接用，不必起服务。

用法：
    python build_preview.py            # 生成/刷新 preview.html
"""
import base64
import datetime
import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(HERE, "purelab-apk", "app", "assets", "www")
SHELL = os.path.join(HERE, "preview_shell.html")
OUT = os.path.join(HERE, "preview.html")


def read(name):
    p = os.path.join(WWW, name)
    if not os.path.exists(p):
        raise SystemExit("找不到源文件：%s" % p)
    return io.open(p, encoding="utf-8").read()


def inline(html, css, js):
    """把外链的 css/js 换成内联，返回单文件 HTML。"""
    # <link rel="stylesheet" href="app.css?v=38">  ->  <style>…</style>
    n1 = 0

    def repl_link(m):
        nonlocal n1
        n1 += 1
        return "<style>\n" + css + "\n</style>"

    html = re.sub(r'<link[^>]*href="app\.css[^"]*"[^>]*>', repl_link, html, count=1)

    # <script src="app.js?v=38"></script>  ->  <script>…</script>
    n2 = 0
    # 防止脚本内容里的 </script> 提前闭合（换成等价的转义写法）
    safe_js = js.replace("</script>", "<\\/script>")

    def repl_script(m):
        nonlocal n2
        n2 += 1
        return "<script>\n" + safe_js + "\n</script>"

    html = re.sub(r'<script[^>]*src="app\.js[^"]*"[^>]*>\s*</script>', repl_script, html, count=1)

    if n1 != 1:
        raise SystemExit('index.html 里没找到 <link href="app.css...">，内联失败')
    if n2 != 1:
        raise SystemExit('index.html 里没找到 <script src="app.js...">，内联失败')
    return html


def main():
    idx = read("index.html")
    css = read("app.css")
    js = read("app.js")

    single = inline(idx, css, js)

    b64 = base64.b64encode(single.encode("utf-8")).decode("ascii")
    digest = hashlib.sha1(single.encode("utf-8")).hexdigest()[:8]
    stamp = datetime.datetime.now().strftime("%m-%d %H:%M")

    shell = io.open(SHELL, encoding="utf-8").read()
    for token in ("__APP_B64__", "__SRC_INFO__"):
        c = shell.count(token)
        if c != 1:
            # 出现 0 次 = 模板被改坏；出现多次 = 会被替换多遍、文件体积翻倍
            raise SystemExit("外壳模板里 %s 应恰好出现 1 次，实际 %d 次：%s" % (token, c, SHELL))

    out = shell.replace("__APP_B64__", b64).replace("__SRC_INFO__", "%s · %s" % (stamp, digest))
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(out)

    print("已生成 %s" % OUT)
    print("  内联后 App 单文件 %s 字节" % len(single.encode("utf-8")))
    print("  base64 载荷      %s 字节" % len(b64))
    print("  输出预览页       %s 字节" % len(out.encode("utf-8")))
    print("  源码快照         %s · %s" % (stamp, digest))
    return 0


if __name__ == "__main__":
    sys.exit(main())
