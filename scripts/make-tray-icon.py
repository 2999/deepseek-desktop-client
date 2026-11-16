#!/usr/bin/env python3
"""Generate a macOS menu-bar (tray) icon from the DeepSeek logo.

- extracts the whale shape from the white-background app icon
- renders it as a pure-black TEMPLATE image: macOS tints it black in light
  mode and white in dark mode, matching the other menu-bar icons
- trims whitespace, centers the glyph on a 22pt canvas (16pt glyph)
- smooth anti-aliased edges, @2x Retina output
"""
from PIL import Image, ImageFilter

SRC = "assets/icon.png"
OUT_1X = "assets/tray.png"
OUT_2X = "assets/tray@2x.png"

src = Image.open(SRC).convert("RGB")
w, h = src.size
px = src.load()

# --- 1. Build alpha mask: blue-dominant pixels are the glyph ---------------
alpha = Image.new("L", (w, h), 0)
ap = alpha.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        # distance from white along the blue axis; full shape ≈ 150+
        d = b - r
        ap[x, y] = int(max(0.0, min(1.0, d / 140.0)) * 255)

# smooth the mask, then re-sharpen the threshold for clean edges
alpha = alpha.filter(ImageFilter.GaussianBlur(2))
ap = alpha.load()
for y in range(h):
    for x in range(w):
        v = ap[x, y]
        ap[x, y] = int(max(0.0, min(1.0, (v - 96) / 64.0)) * 255)
alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))

# --- 2. Trim to glyph bounding box -----------------------------------------
bbox = alpha.getbbox()
mask = alpha.crop(bbox)
gw, gh = mask.size

# --- 3. Scale mask to a 16pt glyph and center on a 22pt canvas --------------
# Only the grayscale mask is resized (RGB channels stay perfectly uniform).
SCALE = 2
GLYPH_H = 16 * SCALE
CANVAS = 22 * SCALE
ratio = GLYPH_H / gh
gw2 = max(1, round(gw * ratio))
glyph_mask = mask.resize((gw2, GLYPH_H), Image.LANCZOS)

alpha2 = Image.new("L", (CANVAS, CANVAS), 0)
alpha2.paste(glyph_mask, ((CANVAS - gw2) // 2, (CANVAS - GLYPH_H) // 2))


def black_template(alpha_l):
    """Pure black pixels + alpha: template images are tinted by macOS."""
    black = Image.new("L", alpha_l.size, 0)
    return Image.merge("RGBA", (black, black, black, alpha_l))


canvas = black_template(alpha2)
canvas.save(OUT_2X)

small = black_template(alpha2.resize((CANVAS // SCALE, CANVAS // SCALE), Image.LANCZOS))
small.save(OUT_1X)
print(f"saved {OUT_1X} ({small.size[0]}x{small.size[1]}) and {OUT_2X} ({canvas.size[0]}x{canvas.size[1]})")
