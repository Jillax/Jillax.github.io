# -*- coding: utf-8 -*-
"""重建画廊索引。

    python scripts/build_gallery_index.py            # 仅重建 index.json
    python scripts/build_gallery_index.py --convert  # 先把 PNG/JPG 转 WebP，再重建

索引只收录 .webp，原图不进发布目录；新增图片后跑一遍即可，无需改动 share.html。
"""
import os
import sys
import json
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHARE = os.path.join(ROOT, 'assets', 'Image-Share')
RASTER = ('.png', '.jpg', '.jpeg')
WEBP = '.webp'
MAX_SIDE = 1600
QUALITY = 82


def convert_images():
    try:
        from PIL import Image
    except ImportError:
        sys.exit('需要 Pillow：pip install pillow')

    changed = []
    for fn in sorted(os.listdir(SHARE)):
        if not fn.lower().endswith(RASTER):
            continue
        src = os.path.join(SHARE, fn)
        dst = os.path.join(SHARE, os.path.splitext(fn)[0] + WEBP)
        im = Image.open(src)
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGB')
        w, h = im.size
        if max(w, h) > MAX_SIDE:
            scale = MAX_SIDE / max(w, h)
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=QUALITY, method=6)
        changed.append((fn, os.path.getsize(src), os.path.getsize(dst)))
    return changed


def build_index():
    files = [{'name': fn, 'type': 'file', 'size': os.path.getsize(os.path.join(SHARE, fn))}
             for fn in sorted(os.listdir(SHARE)) if fn.lower().endswith(WEBP)]
    today = datetime.date.today().isoformat()

    with open(os.path.join(SHARE, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'updated': today, 'files': files}, f, ensure_ascii=False, indent=2)

    with open(os.path.join(ROOT, 'assets', 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'updated': today, 'files': [{'name': 'Image-Share', 'type': 'dir'}]},
                  f, ensure_ascii=False, indent=2)
    return files


def main():
    if '--convert' in sys.argv:
        changed = convert_images()
        before = sum(b for _, b, _ in changed)
        after = sum(a for _, _, a in changed)
        for fn, b, a in changed:
            print(f'  {fn}: {b/1024/1024:.2f} MB -> {a/1024/1024:.2f} MB')
        if before:
            print(f'  合计 {len(changed)} 张，-{100 * (1 - after / before):.0f}%')

    files = build_index()
    total = sum(f['size'] for f in files)
    print(f'  索引已更新：{len(files)} 个文件，共 {total/1024/1024:.2f} MB')


if __name__ == '__main__':
    main()
