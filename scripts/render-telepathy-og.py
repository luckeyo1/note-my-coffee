"""Render the text/vector-only social card. Requires Pillow and a Korean font.

Usage: python scripts/render-telepathy-og.py --font /path/to/Korean-Regular.ttf
"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
args = parser.parse_args()
scale = 2
canvas = Image.new('RGB', (1200 * scale, 630 * scale), '#1A120C')
draw = ImageDraw.Draw(canvas)

def text(x, y, label, size, color):
    draw.text((x * scale, y * scale), label,
              font=ImageFont.truetype(args.font, size * scale), fill=color)

def ellipse(bounds, color, width=2, fill=None):
    draw.ellipse(tuple(int(n * scale) for n in bounds), outline=color,
                 width=width * scale, fill=fill)

text(72, 54, 'NOTE MY COFFEE', 20, '#B8A896')
draw.line((72 * scale, 105 * scale, 1128 * scale, 105 * scale),
          fill='#423226', width=scale)
text(72, 170, '원두 텔레파시', 66, '#FCFAF6')
text(76, 285, '지금 마시고 싶은 그 맛,', 31, '#B8A896')
text(76, 334, '커피가 먼저 알아요.', 31, '#B8A896')
text(76, 458, '30초 교신으로 만나는 나의 원두', 23, '#E8A074')
text(76, 547, 'note-my-coffee.web.app/telepathy', 18, '#B8A896')

# Coffee bean and signal rings, drawn as vector primitives for crisp output.
for radius in (110, 157, 204):
    ellipse((935-radius, 320-radius, 935+radius, 320+radius), '#423226')
ellipse((874, 227, 996, 413), '#D8794E', fill='#D8794E')
draw.line([(957*scale, 246*scale), (930*scale, 283*scale),
           (940*scale, 326*scale), (913*scale, 389*scale)],
          fill='#1A120C', width=9*scale, joint='curve')
ellipse((1079, 242, 1091, 254), '#E8A074', fill='#E8A074')
ellipse((810, 426, 820, 436), '#E8A074', fill='#E8A074')
canvas.resize((1200, 630), Image.Resampling.LANCZOS).save(
    Path(__file__).resolve().parents[1] / 'og-telepathy.png', optimize=True)
