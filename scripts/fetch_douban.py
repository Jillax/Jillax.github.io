#!/usr/bin/env python3
"""
豆瓣书影音数据抓取脚本
从豆瓣用户公开页面抓取书籍、电影、音乐的标记数据，
保存为 JSON 文件供静态网站使用。

用法:
    python scripts/fetch_douban.py

环境变量:
    DOUBAN_COOKIE: 豆瓣登录 Cookie（可选，不提供则只抓取用户主页最近条目）
    DOUBAN_USER_ID: 豆瓣用户 ID（默认 233706855）
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ===== 配置 =====
USER_ID = os.environ.get("DOUBAN_USER_ID", "233706855")
COOKIE = os.environ.get("DOUBAN_COOKIE", "")
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILE = DATA_DIR / "bookshelf.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)
if COOKIE:
    SESSION.headers.update({"Cookie": COOKIE})

# 评分映射
RATING_MAP = {
    "rating1-t": 1,
    "rating2-t": 2,
    "rating3-t": 3,
    "rating4-t": 4,
    "rating5-t": 5,
}

# 推荐语映射（豆瓣收藏页的文本）
RATING_TEXT_MAP = {
    "很差": 1,
    "较差": 2,
    "还行": 3,
    "推荐": 4,
    "力荐": 5,
}

# 状态映射
STATUS_MAP = {
    "collect": "collect",
    "wish": "wish",
    "do": "do",
}


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def fetch_page(url, max_retries=3):
    """获取页面内容，带重试"""
    for attempt in range(max_retries):
        try:
            resp = SESSION.get(url, timeout=30)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code == 403:
                log(f"  403 Forbidden: {url}")
                return None
            else:
                log(f"  HTTP {resp.status_code}: {url}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2)
        except requests.RequestException as e:
            log(f"  请求失败: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(2)
    return None


def parse_collection_page(html, category):
    """解析豆瓣收藏页（grid 模式）的 HTML，返回条目列表"""
    soup = BeautifulSoup(html, "html.parser")
    items = []

    for item in soup.select(".item"):
        try:
            # 封面图片
            img_el = item.select_one(".pic img.cover")
            if not img_el:
                continue
            cover = img_el.get("src", "").strip()
            # 处理缩略图 -> 大图
            cover = re.sub(r"/s_ratio_poster/", "/l_ratio_poster/", cover)
            cover = re.sub(r"/s/public/", "/l/public/", cover)
            cover = re.sub(r"/s_ratio_poster$", "/l_ratio_poster", cover)

            # 链接和 ID
            link_el = item.select_one(".pic a")
            url = link_el.get("href", "").strip() if link_el else ""
            item_id = ""
            id_match = re.search(r"/subject/(\d+)/", url)
            if id_match:
                item_id = id_match.group(1)

            # 标题
            title_el = item.select_one(".title a")
            title = title_el.get_text(strip=True) if title_el else ""

            # 作者/艺术家信息
            author_el = item.select_one(".author")
            author = unescape(author_el.get_text(strip=True)) if author_el else ""

            # 评分
            rating_el = item.select_one(".rating")
            rating = 0
            if rating_el:
                for cls, val in RATING_MAP.items():
                    if rating_el.select_one(f".{cls}"):
                        rating = val
                        break

            # 日期
            date = ""
            if rating_el:
                date_el = rating_el.select_one(".date")
                if date_el:
                    date = date_el.get_text(strip=True)

            # 标签
            tags = []
            tags_el = item.select_one(".tags")
            if tags_el:
                tags_text = tags_el.get_text(strip=True).replace("标签:", "").strip()
                tags = [t.strip() for t in tags_text.split() if t.strip()]

            # 评论
            comment = ""
            comment_el = item.select_one(".comment")
            if comment_el:
                comment = comment_el.get_text(strip=True)

            items.append({
                "id": item_id,
                "title": title,
                "author": author,
                "cover": cover,
                "url": url,
                "rating": rating,
                "tags": tags,
                "comment": comment,
                "date": date,
            })
        except Exception as e:
            log(f"  解析条目出错: {e}")
            continue

    return items


def fetch_category_collections(category, statuses):
    """抓取某个分类下所有状态的收藏"""
    domains = {
        "book": "book.douban.com",
        "movie": "movie.douban.com",
        "music": "music.douban.com",
    }
    domain = domains.get(category, f"{category}.douban.com")
    all_items = []

    for status in statuses:
        page = 0
        while True:
            url = f"https://{domain}/people/{USER_ID}/{status}?start={page}&sort=time&rating=all&filter=all&mode=grid"
            log(f"  抓取 {category}/{status} (start={page})...")
            html = fetch_page(url)
            if not html:
                break

            items = parse_collection_page(html, category)
            if not items:
                break

            for item in items:
                item["status"] = status
                item["category"] = category
            all_items.extend(items)
            log(f"    本页 {len(items)} 条，累计 {len(all_items)} 条")

            page += 15
            # 限制最大页数
            if page >= 300:
                break

    return all_items


def fetch_recent_from_homepage():
    """从用户主页抓取最近的书影音条目（无需 Cookie）"""
    log("  从用户主页抓取最近条目...")
    url = f"https://www.douban.com/people/{USER_ID}/"
    html = fetch_page(url)
    if not html:
        return {"books": [], "movies": [], "music": []}

    soup = BeautifulSoup(html, "html.parser")
    result = {"books": [], "movies": [], "music": []}
    cat_map = {"book": "books", "movie": "movies", "music": "music"}

    for category in ["book", "movie", "music"]:
        section = soup.select_one(f"#{category}")
        if not section:
            continue

        items = section.select("a[href*='/subject/']")
        seen = set()
        for a in items:
            href = a.get("href", "")
            title = a.get("title", "") or a.get_text(strip=True)
            # 清理标题：取第一行（去掉中英双语换行）
            title = title.split("\n")[0].strip()
            if not title or not href:
                continue
            if href in seen:
                continue
            seen.add(href)

            item_id = ""
            id_match = re.search(r"/subject/(\d+)/", href)
            if id_match:
                item_id = id_match.group(1)

            result[cat_map[category]].append({
                "id": item_id,
                "title": title,
                "url": href,
                "cover": "",
                "author": "",
                "rating": 0,
                "status": "collect",
                "tags": [],
                "comment": "",
                "date": "",
            })

    return result


def main():
    log(f"=== 豆瓣书影音数据抓取 ===")
    log(f"用户 ID: {USER_ID}")
    log(f"Cookie: {'已提供' if COOKIE else '未提供（仅抓取主页最近条目）'}")
    log(f"输出: {DATA_FILE}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if COOKIE:
        # 有 Cookie：抓取完整收藏
        all_data = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "books": [],
            "movies": [],
            "music": [],
        }

        log("\n--- 书籍 ---")
        all_data["books"] = fetch_category_collections("book", ["collect"])

        log("\n--- 电影 ---")
        all_data["movies"] = fetch_category_collections("movie", ["collect"])

        log("\n--- 音乐 ---")
        all_data["music"] = fetch_category_collections("music", ["collect"])

        log(f"\n总计: 书籍 {len(all_data['books'])} 条, "
             f"电影 {len(all_data['movies'])} 条, "
             f"音乐 {len(all_data['music'])} 条")
    else:
        # 无 Cookie：从主页抓取最近条目
        log("\n无 Cookie，从主页抓取最近条目...")
        recent = fetch_recent_from_homepage()
        all_data = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "books": recent.get("books", []),
            "movies": recent.get("movies", []),
            "music": recent.get("music", []),
        }
        log(f"主页条目: 书籍 {len(all_data['books'])} 条, "
             f"电影 {len(all_data['movies'])} 条, "
             f"音乐 {len(all_data['music'])} 条")

    # 写入 JSON
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    log(f"\n== 数据已保存到 {DATA_FILE}")
    log(f"文件大小: {DATA_FILE.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()