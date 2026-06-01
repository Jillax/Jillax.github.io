#!/usr/bin/env python3
"""Delete corrupted cover files and clean up _localCover refs."""
import json
from pathlib import Path

d = Path(r'd:\AI Related\Claws\Jillax-github-io\data\covers')
DATA_FILE = Path(r'd:\AI Related\Claws\Jillax-github-io\data\bookshelf.json')

# Delete files < 200 bytes (corrupted HTML responses)
deleted = 0
for f in d.iterdir():
    if f.is_file() and f.stat().st_size < 200:
        f.unlink()
        deleted += 1
print(f'Deleted {deleted} corrupted files')

# Clean up _localCover refs for files that don't exist
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

cleaned = 0
for cat in ['books', 'movies', 'music', 'games']:
    for item in data.get(cat, []):
        lc = item.get('_localCover', '')
        if lc and not (Path(r'd:\AI Related\Claws\Jillax-github-io') / lc).exists():
            del item['_localCover']
            cleaned += 1

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Cleaned {cleaned} missing _localCover refs')
print(f'Remaining covers: {len(list(d.iterdir()))}')
