# -*- coding: utf-8 -*-
"""PureLab 启动图标：深绿 #2F3A31 圆角方底 + 米色 #F9F2EA 锥形瓶剪影 + 暖棕 #C0A381 液面带"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "res")

BG = (47, 58, 49, 255)      # 2F3A31
CREAM = (249, 242, 234, 255)  # F9F2EA
WARM = (192, 163, 129, 255)   # C0A381

SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def make_icon(size):
    # 4x 超采样抗锯齿
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角方底（半径约 22%）
    r = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=BG)

    cx = S / 2
    # 锥形瓶：瓶口窄、瓶身锥形展开
    neck_w = S * 0.14      # 瓶口半宽
    neck_top = S * 0.24    # 瓶口 y
    neck_bot = S * 0.44    # 瓶颈底 y
    body_w = S * 0.30      # 瓶底半宽
    body_bot = S * 0.76    # 瓶底 y
    line_w = max(2, int(S * 0.035))

    # 瓶身轮廓（两条斜线）+ 瓶口横线
    d.line([(cx - neck_w, neck_top), (cx - neck_w, neck_bot)], fill=CREAM, width=line_w)
    d.line([(cx + neck_w, neck_top), (cx + neck_w, neck_bot)], fill=CREAM, width=line_w)
    d.line([(cx - neck_w, neck_bot), (cx - body_w, body_bot)], fill=CREAM, width=line_w)
    d.line([(cx + neck_w, neck_bot), (cx + body_w, body_bot)], fill=CREAM, width=line_w)
    d.line([(cx - body_w, body_bot), (cx + body_w, body_bot)], fill=CREAM, width=line_w)
    d.line([(cx - neck_w * 1.5, neck_top), (cx + neck_w * 1.5, neck_top)], fill=CREAM, width=line_w)

    # 液面带：梯形，位于瓶身下部
    liq_top = S * 0.58
    frac_top = (liq_top - neck_bot) / (body_bot - neck_bot)  # 0..1
    liq_half_top = neck_w + (body_w - neck_w) * frac_top
    d.polygon([
        (cx - liq_half_top, liq_top),
        (cx + liq_half_top, liq_top),
        (cx + body_w - line_w / 2, body_bot - line_w / 2),
        (cx - body_w + line_w / 2, body_bot - line_w / 2),
    ], fill=WARM)

    # 液面上小圆点（气泡感）：两颗米色小点
    dot_r = max(2, int(S * 0.022))
    d.ellipse([cx - S * 0.06 - dot_r, liq_top + S * 0.045 - dot_r,
               cx - S * 0.06 + dot_r, liq_top + S * 0.045 + dot_r], fill=CREAM)
    d.ellipse([cx + S * 0.05 - dot_r, liq_top + S * 0.02 - dot_r,
               cx + S * 0.05 + dot_r, liq_top + S * 0.02 + dot_r], fill=CREAM)

    return img.resize((size, size), Image.LANCZOS)


def main():
    for dpi, size in SIZES.items():
        folder = os.path.join(OUT, "mipmap-%s" % dpi)
        os.makedirs(folder, exist_ok=True)
        img = make_icon(size)
        path = os.path.join(folder, "ic_launcher.png")
        img.save(path)
        print("OK", dpi, size, "->", path)


if __name__ == "__main__":
    main()
