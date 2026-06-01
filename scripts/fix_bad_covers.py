#!/usr/bin/env python3
"""Re-download covers that are corrupted (HTML error pages saved as .jpg)."""
import json, os, re, time, requests
from pathlib import Path
from PIL import Image

DATA_DIR = Path(r'd:\AI Related\Claws\Jillax-github-io\data')
COVERS_DIR = DATA_DIR / 'covers'
DATA_FILE = DATA_DIR / 'bookshelf.json'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://book.douban.com/',
}

def is_valid_image(path):
    try:
        img = Image.open(path)
        img.verify()
        return True
    except:
        return False

def sanitize_filename(name):
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    return name.strip('. ')[:80]

def get_extension(url):
    path = url.split('?')[0]
    if '.' in path.split('/')[-1]:
        ext = '.' + path.split('/')[-1].split('.')[-1]
        if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            return ext
    return '.jpg'

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

fixed = 0
failed = 0
for cat in ['books', 'movies', 'music', 'games']:
    for item in data.get(cat, []):
        lc = item.get('_localCover', '')
        if not lc:
            continue
        local_path = Path(r'd:\AI Related\Claws\Jillax-github-io') / lc
        if not local_path.exists():
            continue
        if local_path.stat().st_size >= 200 and is_valid_image(local_path):
            continue
        # Re-download
        url = item.get('cover', '')
        if not url:
            continue
        print(f'Fixing: {item.get("title", "?")} ...')
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            with open(local_path, 'wb') as f:
                f.write(resp.content)
            # Resize
            if local_path.stat().st_size > 200:
                img = Image.open(local_path)
                ratio = 120 / img.width
                new_h = int(img.height * ratio)
                img = img.resize((120, new_h), Image.LANCZOS)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(local_path.with_suffix('.jpg'), 'JPEG', quality=70, optimize=True)
                if local_path != local_path.with_suffix('.jpg'):
                    local_path.unlink(missing_ok=True)
                item['_localCover'] = str(local_path.with_suffix('.jpg')).replace('\\', '/').replace(
                    str(Path(r'd:\AI Related\Claws\Jillax-github-io')).replace('\\', '/') + '/', '')
            fixed += 1
            time.sleep(0.3)
        except Exception as e:
            print(f'  FAIL: {e}')
            failed += 1

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\nDone! Fixed: {fixed}, Failed: {failed}')
