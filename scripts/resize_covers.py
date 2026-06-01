#!/usr/bin/env python3
"""Resize cover images to 120px wide, 70% quality JPEG."""
from PIL import Image
import pathlib
import sys

d = pathlib.Path(r'd:\AI Related\Claws\Jillax-github-io\data\covers')
n = 0
for f in d.iterdir():
    if f.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    try:
        img = Image.open(f)
        if img.width <= 120:
            continue
        ratio = 120 / img.width
        new_h = int(img.height * ratio)
        img = img.resize((120, new_h), Image.LANCZOS)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        f_jpg = f.with_suffix('.jpg')
        img.save(f_jpg, 'JPEG', quality=70, optimize=True)
        if f != f_jpg and f.exists():
            f.unlink()
        n += 1
    except Exception as e:
        print(f'SKIP {f.name}: {e}', file=sys.stderr)

print(f'Resized {n} images')
