"""Compose Chrome Web Store screenshots — v2, "Quiet Confidence" philosophy.

Reference: docs/handoff/design-philosophy.md
Outputs: samples/screenshots/sc-{1..4}-final.png (1280x800 PNG)

v2 changes over v1 (compose-sc.py):
- 60:40 split (screenshot dominant on left)
- Pseudo macOS browser chrome on screenshot
- Focal spotlight (1.04x crop with blue ring + glow)
- Reflection under screenshot
- Caption accent bar (4px blue gradient)
- Progress indicator "NN / 04"
- Hue-shifted background per slide for series rhythm

This script is invoked manually; not wired into CI. Run with:
    python scripts/compose-sc-v2.py            # SC1 only (prototype mode)
    python scripts/compose-sc-v2.py --all      # all 4 slides
"""

from __future__ import annotations

import argparse
import colorsys
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SC_DIR = ROOT / "samples" / "screenshots"
CANVAS_W, CANVAS_H = 1280, 800

JP_FONT_CANDIDATES = [
    "C:/Windows/Fonts/YuGothB.ttc",
    "C:/Windows/Fonts/meiryob.ttc",
    "C:/Windows/Fonts/YuGothM.ttc",
    "C:/Windows/Fonts/meiryo.ttc",
]
EN_FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoeuisb.ttf",  # Semibold
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
EN_REGULAR_CANDIDATES = [
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
]

# (slug, jp, en, focal_rects, hue_shift_deg, kind)
# kind="shot": screenshot-based slide (uses sc-{n}-base-958.png)
# kind="card": typography-only summary card (no base image needed)
# focal_rects: list of (x, y, w, h) in base-image relative coords [0..1].
#              [] means "no spotlight, the whole view is the subject".
#              Multiple rects let one slide guide the eye through 2 hotspots.
SLIDES = [
    ("sc-1", "保存した投稿を一覧で見返す", "Browse what you saved",
     [], 0, "shot"),
    ("sc-2", "ワンクリックで保存", "One click to save",
     [(0.228, 0.270, 0.146, 0.108)], 8, "shot"),
    ("sc-3", "連投はスレッドのまま保管", "Threads stay together",
     [], 16, "shot"),
    ("sc-4", "キーワードで素早く検索", "Find it again in seconds",
     # Three hotspots: the search bar and both places the matched word
     # appears in the result list.
     # Same font in both posts ⇒ same pixel width (~89px) for "コーヒー";
     # we widen the focal rect to ~105px (~8px padding each side) so the
     # characters sit comfortably inside the ring.
     [(0.000, 0.000, 1.00, 0.072),     # search bar — full width
      # Both "コーヒー" rects are centered on the measured text bbox
      # (90x20 in base coords, identical in both posts) with equal 14px
      # padding on all four sides → identical 118x48 focal rect.
      #   1st: text bbox (69,271)-(158,290), center (113.5, 280.5)
      #   2nd: text bbox (165,620)-(254,639), center (209.5, 629.5)
      (0.0569, 0.2717, 0.1232, 0.0508),  # 1st post コーヒー (centered)
      (0.1571, 0.6414, 0.1232, 0.0508)], # 2nd post コーヒー (centered)
     24, "shot"),
    ("sc-5", "ずっと手元に残せる場所", "Built to last, offline first",
     [], 32, "card"),
]

# SC5 (card) bullets: jp, en pairs. Kept to five items, sparse and essential.
# Offline / OSS are NOT here — they're elevated to the eyebrow badges so the
# top of the card immediately signals the two structural selling points.
CARD_BULLETS = [
    ("いいね・ブックマーク時に自動保存", "Auto-save on Like or Bookmark"),
    ("いいね・ブックマーク欄から一括取得", "Bulk import from Likes & Bookmarks"),
    ("タグ付け・フィルター対応", "Tag & filter your archive"),
    ("投稿時点の表示を再現", "Preserves the post as it was"),
    ("全データを zip でバックアップ・復元", "Backup & restore as one zip file"),
]

# Eyebrow badges shown above the SC5 heading (the two structural attributes).
EYEBROW_BADGES = [
    ("offline", "100% Offline"),
    ("oss", "MIT · Open Source"),
]


def find_font(candidates: list[str]) -> str:
    for c in candidates:
        if Path(c).exists():
            return c
    raise SystemExit(f"No font found in candidates: {candidates}")


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def hue_shift(rgb: tuple[int, int, int], degrees: float) -> tuple[int, int, int]:
    r, g, b = (v / 255.0 for v in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + degrees / 360.0) % 1.0
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (round(r * 255), round(g * 255), round(b * 255))


def make_background(seed: int, hue_deg: float) -> Image.Image:
    top_left = hue_shift((10, 20, 40), hue_deg)
    bottom_right = hue_shift((26, 35, 71), hue_deg)
    side_blue = hue_shift((37, 99, 235), hue_deg)

    bg = Image.new("RGB", (CANVAS_W, CANVAS_H))
    px = bg.load()
    for y in range(CANVAS_H):
        y_t = y / (CANVAS_H - 1)
        for x in range(CANVAS_W):
            x_t = x / (CANVAS_W - 1)
            diag = (x_t + y_t) / 2
            r = lerp(top_left[0], bottom_right[0], diag)
            g = lerp(top_left[1], bottom_right[1], diag)
            b = lerp(top_left[2], bottom_right[2], diag)
            px[x, y] = (r, g, b)

    # Left-top micro glow
    glow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-180, -220, 560, 520), fill=(*side_blue, 30))
    glow = glow.filter(ImageFilter.GaussianBlur(110))

    composed = bg.convert("RGBA")
    composed.alpha_composite(glow)

    # Vignette
    vignette = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-100, -120, CANVAS_W + 100, CANVAS_H + 120), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(40))
    dark = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 50))
    composed = Image.composite(composed, Image.alpha_composite(composed, dark), vignette)

    # Subtle film grain
    rng = Random(seed)
    noise = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    npx = noise.load()
    for y in range(CANVAS_H):
        for x in range(CANVAS_W):
            if rng.random() < 0.10:
                v = rng.choice((255, 0))
                npx[x, y] = (v, v, v, rng.randint(2, 6))
    composed.alpha_composite(noise)
    return composed


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return m


def add_browser_chrome(shot: Image.Image) -> Image.Image:
    """Extend the screenshot upward by a LIGHT chrome strip matching the
    light-mode UI inside. Does NOT overlay/hide original screenshot pixels."""
    w, h = shot.size
    chrome_h = 32
    new = Image.new("RGBA", (w, h + chrome_h), (236, 240, 246, 255))
    new.paste(shot, (0, chrome_h))

    od = ImageDraw.Draw(new)
    cy = chrome_h // 2
    cx = 16
    for color in ((255, 95, 87), (254, 188, 46), (40, 200, 64)):
        od.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(*color, 255))
        cx += 20

    pill_left = 120
    pill_right = w - 120
    od.rounded_rectangle(
        (pill_left, cy - 9, pill_right, cy + 9),
        radius=9, fill=(255, 255, 255, 255),
        outline=(218, 222, 230, 255), width=1,
    )
    # Hairline divider between chrome and screenshot content
    od.line(((0, chrome_h - 1), (w, chrome_h - 1)), fill=(218, 222, 230, 255), width=1)
    return new


def add_screenshot_with_chrome_and_reflection(
    canvas: Image.Image,
    source: Path,
    focal_rects: list[tuple[float, float, float, float]],
) -> tuple[int, int, int, int, Image.Image]:
    """Place screenshot at left with chrome + reflection + optional spotlights.

    `focal_rects` may contain zero, one, or many rectangles. Each rectangle is
    rendered as an independent spotlight (pop + ring + glow).
    Returns (sx, sy, sw, sh, resized_base) for downstream use.
    """
    base = Image.open(source).convert("RGB")
    target_w = 720
    base_h = round(base.height * (target_w / base.width))
    base_resized = base.resize((target_w, base_h), Image.Resampling.LANCZOS).convert("RGBA")
    shot = add_browser_chrome(base_resized)  # shot height = chrome_h + base_h
    chrome_h = shot.size[1] - base_h
    shot_h = shot.size[1]

    sx = 64
    sy = (CANVAS_H - shot_h) // 2 - 16
    radius = 14
    mask = rounded_mask(shot.size, radius)
    shot.putalpha(mask)

    # Shadow under screenshot
    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    shadow_shape = Image.new("RGBA", shot.size, (0, 0, 0, 170))
    shadow_shape.putalpha(mask)
    shadow.alpha_composite(shadow_shape, (sx, sy))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    canvas.alpha_composite(shadow, (0, 22))

    # Place shot
    canvas.alpha_composite(shot, (sx, sy))

    # Hairline outline
    outline = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    od = ImageDraw.Draw(outline)
    od.rounded_rectangle(
        (sx, sy, sx + target_w - 1, sy + shot_h - 1),
        radius=radius, outline=(255, 255, 255, 26), width=1,
    )
    canvas.alpha_composite(outline)

    # Reflection beneath (use the bottom slice of `shot`, which is base content)
    ref_h = 64
    ref = shot.crop((0, shot_h - ref_h, target_w, shot_h)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    # Build the combined mask: vertical fade (top->bottom: full->zero),
    # horizontal edge fade (left/right -> zero), and a rounded clip.
    side_fade_px = 40
    fade = Image.new("L", ref.size, 0)
    fd = fade.load()
    for y in range(ref_h):
        v = round(80 * (1 - y / (ref_h - 1)))
        for x in range(target_w):
            # horizontal falloff at left/right edges
            if x < side_fade_px:
                h_factor = x / side_fade_px
            elif x > target_w - side_fade_px:
                h_factor = (target_w - x) / side_fade_px
            else:
                h_factor = 1.0
            fd[x, y] = round(v * h_factor)
    ref.putalpha(fade)
    ref = ref.filter(ImageFilter.GaussianBlur(6))
    # AFTER blur: re-clip with a hard rounded mask so the corners stay
    # sharply rounded instead of blurring outward into rectangles.
    ref_round = rounded_mask(ref.size, radius)
    blurred_alpha = ref.split()[-1]
    final_alpha = Image.new("L", ref.size)
    fp = final_alpha.load()
    ba = blurred_alpha.load()
    rr = ref_round.load()
    for y in range(ref_h):
        for x in range(target_w):
            fp[x, y] = min(ba[x, y], rr[x, y])
    ref.putalpha(final_alpha)
    canvas.alpha_composite(ref, (sx, sy + shot_h + 6))

    # Zero or more focal spotlights (skip for "list" / "thread" SCs where the
    # whole view is the subject; use multiple to guide the eye on slides like
    # search where there are two related hotspots).
    for rect in focal_rects:
        fx0_in_shot = round(rect[0] * target_w)
        fy0_in_shot = chrome_h + round(rect[1] * base_h)
        fw = round(rect[2] * target_w)
        fh = round(rect[3] * base_h)
        add_focal_spotlight(canvas, shot, sx, sy, fx0_in_shot, fy0_in_shot, fw, fh)

    return sx, sy, target_w, shot_h, shot


def add_focal_spotlight(
    canvas: Image.Image,
    shot: Image.Image,
    sx: int,
    sy: int,
    rx: int,
    ry: int,
    rw: int,
    rh: int,
) -> None:
    """Crop a region from the screenshot, scale 1.04x, draw with blue ring + glow."""
    rx = max(0, rx)
    ry = max(0, ry)
    rw = min(shot.size[0] - rx, rw)
    rh = min(shot.size[1] - ry, rh)
    if rw <= 0 or rh <= 0:
        return
    crop = shot.crop((rx, ry, rx + rw, ry + rh))
    scale = 1.04
    new_w = round(rw * scale)
    new_h = round(rh * scale)
    pop = crop.resize((new_w, new_h), Image.Resampling.LANCZOS)
    radius = 10
    pop.putalpha(rounded_mask(pop.size, radius))

    # Shadow + glow
    px = sx + rx - (new_w - rw) // 2
    py = sy + ry - (new_h - rh) // 2

    glow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle(
        (px - 12, py - 12, px + new_w + 12, py + new_h + 12),
        radius=radius + 8, fill=(59, 130, 246, 90),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(20))
    canvas.alpha_composite(glow)

    # Drop shadow
    sh = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    sh_shape = Image.new("RGBA", pop.size, (0, 0, 0, 180))
    sh_shape.putalpha(rounded_mask(pop.size, radius))
    sh.alpha_composite(sh_shape, (px + 4, py + 12))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(sh)

    # The popped crop itself
    canvas.alpha_composite(pop, (px, py))

    # Blue ring (2px)
    ring = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.rounded_rectangle(
        (px, py, px + new_w - 1, py + new_h - 1),
        radius=radius, outline=(96, 165, 250, 230), width=2,
    )
    canvas.alpha_composite(ring)


def draw_progress(
    canvas: Image.Image,
    progress_label: str,
    en_reg_path: str,
) -> None:
    """Bottom-right area: progress indicator only. The Offline/OSS selling
    points are surfaced on SC5's eyebrow badges instead of a hard-to-read
    micro-tag on every slide."""
    draw = ImageDraw.Draw(canvas)
    pg_font = ImageFont.truetype(en_reg_path, 13)
    pw = draw.textbbox((0, 0), progress_label, font=pg_font)[2]
    draw.text(
        (CANVAS_W - 56 - pw, CANVAS_H - 38),
        progress_label, fill=(170, 195, 230, 140), font=pg_font,
    )


def draw_badge_icon(canvas: Image.Image, kind: str, cx: int, cy: int, size: int) -> None:
    """Hand-drawn 'icon' for the eyebrow badges. Pillow has no SVG support,
    so we compose primitives. Kept intentionally simple to read at 1280x800."""
    r = size // 2
    accent = (96, 165, 250, 235)
    ring = Image.new("RGBA", (size + 4, size + 4), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse((1, 1, size + 1, size + 1), outline=accent, width=2)
    canvas.alpha_composite(ring, (cx - r - 2, cy - r - 2))

    od = ImageDraw.Draw(canvas)
    if kind == "offline":
        # Cloud silhouette + diagonal slash (= "no cloud / no network").
        cw, ch = size - 8, size - 12
        cx0 = cx - cw // 2
        cy0 = cy - ch // 2 + 2
        od.rounded_rectangle(
            (cx0, cy0 + ch // 3, cx0 + cw, cy0 + ch),
            radius=ch // 2, fill=accent,
        )
        od.ellipse((cx0 + 1, cy0, cx0 + cw // 2 + 2, cy0 + ch - 2), fill=accent)
        # Slash across the icon
        od.line(
            ((cx - r + 2, cy + r - 2), (cx + r - 2, cy - r + 2)),
            fill=(255, 90, 90, 240), width=2,
        )
    elif kind == "oss":
        # "</>" rendered with three short line segments — language-agnostic,
        # universally read as "code".
        thickness = 2
        # Left chevron '<'
        od.line(((cx - 6, cy), (cx - 2, cy - 5)), fill=accent, width=thickness)
        od.line(((cx - 6, cy), (cx - 2, cy + 5)), fill=accent, width=thickness)
        # Right chevron '>'
        od.line(((cx + 6, cy), (cx + 2, cy - 5)), fill=accent, width=thickness)
        od.line(((cx + 6, cy), (cx + 2, cy + 5)), fill=accent, width=thickness)
        # Diagonal '/'
        od.line(((cx - 2, cy + 6), (cx + 2, cy - 6)), fill=accent, width=thickness)


def draw_eyebrow_badges(
    canvas: Image.Image,
    x: int,
    y: int,
    en_font_path: str,
) -> int:
    """Draw the Offline + OSS badges horizontally starting at (x, y).
    Returns the bottom-y of the badge row so callers can stack content under it."""
    draw = ImageDraw.Draw(canvas)
    label_font = ImageFont.truetype(en_font_path, 15)
    icon_size = 22
    pad_x_inner = 14
    icon_label_gap = 10
    badge_h = 36
    gap_between = 14
    cur_x = x
    for kind, label in EYEBROW_BADGES:
        text_w = draw.textbbox((0, 0), label, font=label_font)[2]
        badge_w = pad_x_inner + icon_size + icon_label_gap + text_w + pad_x_inner
        # Pill background
        bg = Image.new("RGBA", (badge_w, badge_h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bg)
        bd.rounded_rectangle(
            (0, 0, badge_w - 1, badge_h - 1),
            radius=badge_h // 2,
            fill=(40, 60, 110, 140),
            outline=(96, 165, 250, 180),
            width=1,
        )
        canvas.alpha_composite(bg, (cur_x, y))
        # Icon
        icon_cx = cur_x + pad_x_inner + icon_size // 2
        icon_cy = y + badge_h // 2
        draw_badge_icon(canvas, kind, icon_cx, icon_cy, icon_size)
        # Label (vertically centered with a tiny optical offset)
        label_x = cur_x + pad_x_inner + icon_size + icon_label_gap
        label_y = y + (badge_h - 18) // 2 - 1
        draw.text((label_x, label_y), label, fill=(230, 238, 250), font=label_font)
        cur_x += badge_w + gap_between
    return y + badge_h


def draw_caption(
    canvas: Image.Image,
    jp: str,
    en: str,
    progress_label: str,
    jp_font_path: str,
    en_font_path: str,
    en_reg_path: str,
) -> None:
    draw = ImageDraw.Draw(canvas)
    jp_font = ImageFont.truetype(jp_font_path, 42)
    en_font = ImageFont.truetype(en_font_path, 19)

    text_x = 810
    max_width = 440
    jp_lines = wrap_text_jp(jp, jp_font, max_width)
    jp_line_h = 54
    en_gap = 26
    en_bbox = draw.textbbox((0, 0), en, font=en_font)
    en_h = en_bbox[3] - en_bbox[1]
    total_h = len(jp_lines) * jp_line_h + en_gap + en_h
    start_y = (CANVAS_H - total_h) // 2

    # Accent bar (4px) on left of heading
    bar_x = text_x - 22
    bar_y0 = start_y + 4
    bar_y1 = start_y + len(jp_lines) * jp_line_h - 6
    bar_h = bar_y1 - bar_y0
    bar = Image.new("RGBA", (4, max(bar_h, 1)), (0, 0, 0, 0))
    bp = bar.load()
    for y in range(bar.size[1]):
        t = y / max(bar.size[1] - 1, 1)
        r = lerp(59, 96, t)
        g = lerp(130, 165, t)
        b = lerp(246, 250, t)
        for x in range(4):
            bp[x, y] = (r, g, b, 235)
    canvas.alpha_composite(bar, (bar_x, bar_y0))

    for i, line in enumerate(jp_lines):
        draw.text((text_x, start_y + i * jp_line_h), line, fill=(245, 248, 255), font=jp_font)
    draw.text(
        (text_x, start_y + len(jp_lines) * jp_line_h + en_gap),
        en, fill=(170, 195, 230), font=en_font,
    )


def wrap_text_jp(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Japanese-aware wrap that breaks at the EARLIEST particle/punctuation
    that yields a head fitting within max_width.

    Slogan-style copy reads better with a short first line and a longer
    second line ("保存した投稿を" / "一覧で見返す") than the reverse.
    """
    break_after = set("をがにでとはのへもや、。!?！？")
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    def width(s: str) -> float:
        return draw.textlength(s, font=font)

    def split(s: str) -> list[str]:
        if width(s) <= max_width:
            return [s]
        # collect break candidates whose head still fits
        candidates: list[int] = []
        for i, ch in enumerate(s):
            if ch in break_after:
                head = s[: i + 1]
                if width(head) <= max_width:
                    candidates.append(i + 1)
        if not candidates:
            # no particle fits; fall back to character-level greedy
            line = ""
            out: list[str] = []
            for ch in s:
                cand = line + ch
                if line and width(cand) > max_width:
                    out.append(line)
                    line = ch
                else:
                    line = cand
            if line:
                out.append(line)
            return out
        pos = candidates[0]  # earliest particle that fits
        return [s[:pos]] + split(s[pos:])

    return split(text)


def draw_card(
    canvas: Image.Image,
    jp_heading: str,
    en_tagline: str,
    jp_font_path: str,
    en_font_path: str,
    en_reg_path: str,
) -> None:
    """SC5 layout: eyebrow badges + heading + tagline (left) and bullets (right)."""
    draw = ImageDraw.Draw(canvas)
    head_font = ImageFont.truetype(jp_font_path, 44)
    bullet_jp_font = ImageFont.truetype(jp_font_path, 22)
    bullet_en_font = ImageFont.truetype(en_reg_path, 14)
    tag_font = ImageFont.truetype(en_font_path, 19)

    left_x = 120
    right_x = 690

    # Heading wrap (left column)
    head_lines = wrap_text_jp(jp_heading, head_font, 480)
    head_line_h = 58
    head_total = len(head_lines) * head_line_h
    head_y = (CANVAS_H - head_total) // 2 - 30

    # Eyebrow badges above heading
    draw_eyebrow_badges(canvas, left_x - 4, head_y - 64, en_font_path)

    # Accent bar (4px) on left of heading
    bar_h = head_total - 12
    bar = Image.new("RGBA", (4, max(bar_h, 1)), (0, 0, 0, 0))
    bp = bar.load()
    for y in range(bar.size[1]):
        t = y / max(bar.size[1] - 1, 1)
        r = lerp(59, 96, t)
        g = lerp(130, 165, t)
        b = lerp(246, 250, t)
        for x in range(4):
            bp[x, y] = (r, g, b, 235)
    canvas.alpha_composite(bar, (left_x - 22, head_y + 6))

    for i, line in enumerate(head_lines):
        draw.text((left_x, head_y + i * head_line_h), line, fill=(245, 248, 255), font=head_font)

    # Tagline below heading
    tag_y = head_y + head_total + 18
    draw.text((left_x, tag_y), en_tagline, fill=(170, 195, 230), font=tag_font)

    # Bullets (right column), each as JP line + smaller EN sub
    bullet_gap = 56
    total_bullets_h = len(CARD_BULLETS) * bullet_gap
    bullets_y = (CANVAS_H - total_bullets_h) // 2 - 10

    for i, (b_jp, b_en) in enumerate(CARD_BULLETS):
        y = bullets_y + i * bullet_gap
        # Subtle bullet marker: small filled square
        draw.rectangle((right_x - 16, y + 12, right_x - 10, y + 18), fill=(96, 165, 250, 220))
        draw.text((right_x, y), b_jp, fill=(235, 240, 250), font=bullet_jp_font)
        draw.text((right_x, y + 30), b_en, fill=(140, 165, 200), font=bullet_en_font)


def compose(
    slug: str,
    jp: str,
    en: str,
    focal_rects: list[tuple[float, float, float, float]],
    hue_deg: float,
    index: int,
    total: int,
    kind: str,
    jp_font: str,
    en_font: str,
    en_reg: str,
) -> Path:
    canvas = make_background(seed=958 + index, hue_deg=hue_deg)
    progress = f"{index:02d} / {total:02d}"

    if kind == "card":
        draw_card(canvas, jp, en, jp_font, en_font, en_reg)
    else:
        src = SC_DIR / f"{slug}-base-958.png"
        if not src.exists():
            raise FileNotFoundError(src)
        add_screenshot_with_chrome_and_reflection(canvas, src, focal_rects)
        draw_caption(canvas, jp, en, progress, jp_font, en_font, en_reg)

    draw_progress(canvas, progress, en_reg)

    dst = SC_DIR / f"{slug}-final.png"
    canvas.convert("RGB").save(dst, "PNG", optimize=True)
    print(f"wrote {dst.relative_to(ROOT)} {Image.open(dst).size}")
    return dst


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--all", action="store_true", help="render all 4 slides (default: SC1 only)")
    args = p.parse_args()

    jp_font = find_font(JP_FONT_CANDIDATES)
    en_font = find_font(EN_FONT_CANDIDATES)
    en_reg = find_font(EN_REGULAR_CANDIDATES)

    targets = SLIDES if args.all else SLIDES[:1]
    total = len(SLIDES)
    for i, (slug, jp, en, focal, hue, kind) in enumerate(targets, start=1):
        compose(slug, jp, en, focal, hue, i, total, kind, jp_font, en_font, en_reg)


if __name__ == "__main__":
    main()
