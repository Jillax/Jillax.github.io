# -*- coding: utf-8 -*-
"""合并 history-songs/data/*.json 为 history-songs/data.js。

用法：
    python scripts/build_history_songs.py

数据修改流程：编辑 history-songs/data/ 下对应册子的 JSON，然后重新运行本脚本。
"""
import json
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "history-songs", "data")
OUT = os.path.join(ROOT, "history-songs", "data.js")

BOOK_ORDER = ["q7a", "q7b", "q8a", "q8b", "q9a", "q9b", "gz-sx", "gz-xx"]
LABELS = {
    "q7a": "七上", "q7b": "七下", "q8a": "八上", "q8b": "八下",
    "q9a": "九上", "q9b": "九下", "gz-sx": "纲要上", "gz-xx": "纲要下",
}


def load_books():
    books = []
    for book in BOOK_ORDER:
        path = os.path.join(DATA_DIR, book + ".json")
        if not os.path.exists(path):
            sys.exit(f"缺少 {path}")
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if d.get("book") != book:
            sys.exit(f"{path} 里 book 字段是 {d.get('book')!r}，和文件名不符")
        d["label"] = LABELS[book]
        d["song_count"] = sum(len(l.get("songs", [])) for l in d["lessons"])
        d["fav_count"] = sum(
            1 for l in d["lessons"] for s in l.get("songs", []) if s.get("src") == "fav"
        )
        books.append(d)
    return books


def main():
    books = load_books()
    payload = {
        "updated": date.today().isoformat(),
        "books": books,
    }
    total_lessons = sum(len(b["lessons"]) for b in books)
    total_songs = sum(b["song_count"] for b in books)
    total_fav = sum(b["fav_count"] for b in books)

    body = json.dumps(payload, ensure_ascii=False, indent=2)
    header = (
        "/* 由 scripts/build_history_songs.py 自动生成 —"
        " 请编辑 history-songs/data/*.json 后重新生成，不要手改本文件。 */\n"
    )
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        f.write("window.HISTORY_SONGS = ")
        f.write(body)
        f.write(";\n")

    print(f"已生成 data.js：{len(books)} 册 / {total_lessons} 课 / {total_songs} 首"
          f"（收藏夹 {total_fav} 首）")


if __name__ == "__main__":
    main()
