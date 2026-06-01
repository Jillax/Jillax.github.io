#!/usr/bin/env python3
"""
Download all cover images from bookshelf.json
Saves covers locally to data/covers/ and updates bookshelf.json paths.

Usage:
    python scripts/download_covers.py
"""

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILE = DATA_DIR / "bookshelf.json"
COVERS_DIR = DATA_DIR / "covers"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://book.douban.com/",
}


def sanitize_filename(name):
    """Convert a string to a safe filename."""
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = name.strip('. ')
    return name[:80]  # limit length


def get_extension(url):
    """Extract file extension from URL."""
    path = url.split('?')[0]
    if '.' in path.split('/')[-1]:
        ext = '.' + path.split('/')[-1].split('.')[-1]
        if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
            return ext
    return '.jpg'


def download_cover(url, save_path):
    """Download a cover image."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, stream=True)
        resp.raise_for_status()
        with open(save_path, 'wb') as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f'  FAIL: {e}')
        return False


def main():
    if not DATA_FILE.exists():
        print('bookshelf.json not found')
        sys.exit(1)

    COVERS_DIR.mkdir(exist_ok=True)

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    categories = ['books', 'movies', 'music', 'games']
    total = 0
    downloaded = 0
    skipped = 0
    failed = 0

    for cat in categories:
        items = data.get(cat, [])
        for item in items:
            if not item.get('cover'):
                continue

            total += 1
            title = item.get('title', 'unknown')
            item_id = item.get('id', '')
            ext = get_extension(item['cover'])
            filename = sanitize_filename(f"{item_id}_{title}") + ext
            local_path = COVERS_DIR / filename
            rel_path = f"data/covers/{filename}"

            # Skip if already downloaded
            if local_path.exists() and local_path.stat().st_size > 100:
                item['_localCover'] = rel_path
                skipped += 1
                continue

            print(f'Downloading: {title} ...')
            if download_cover(item['cover'], local_path):
                item['_localCover'] = rel_path
                downloaded += 1
            else:
                failed += 1

            # Be polite to servers
            time.sleep(0.3)

    # Save updated JSON
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'\nDone! Total: {total}, Downloaded: {downloaded}, Skipped: {skipped}, Failed: {failed}')
    print(f'Covers saved to: {COVERS_DIR}')


if __name__ == '__main__':
    main()
