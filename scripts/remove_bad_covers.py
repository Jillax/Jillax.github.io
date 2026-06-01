#!/usr/bin/env python3
"""Delete corrupted cover files and remove their _localCover refs so JS falls back to proxy."""
import json
from pathlib import Path
from PIL import Image

D = Path(r'd:\AI Related\Claws\Jillax-github-io')
COVERS_DIR = D / 'data' / 'covers'
DATA_FILE = D / 'data' / 'bookshelf.json'

def is_valid_image(path):
    try:
        img = Image.open(path)
        img.verify()
        return True
    except:
        return False

# Delete corrupted files
bad_files = set()
for f in COVERS_DIR.iterdir():
    if f.is_file() and (f.stat().st_size < 200 or not is_valid_image(f)):
        bad_files.add(str(f).replace('\\', '/'))
        f.unlink()
print(f'Deleted {len(bad_files)} corrupted files')

# Remove _localCover refs for deleted files
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

prefix = str(D).replace('\\', '/') + '/'
removed = 0
for cat in ['books', 'movies', 'music', 'games']:
    for item in data.get(cat, []):
        lc = item.get('_localCover', '')
        if not lc:
            continue
        full_path = prefix + lc
        if full_path in bad_files or not Path(full_path).exists():
            del item['_localCover']
            removed += 1

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

remaining = len(list(COVERS_DIR.iterdir()))
print(f'Removed {removed} _localCover refs')
print(f'Remaining good covers: {remaining}')