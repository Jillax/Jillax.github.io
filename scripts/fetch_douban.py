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
from http.cookies import SimpleCookie
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ===== 配置 =====
USER_ID = os.environ.get("DOUBAN_USER_ID", "233706855")
COOKIE_STR = os.environ.get("DOUBAN_COOKIE", "")
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
if COOKIE_STR:
    # 用 cookie jar 方式设置，避免豆瓣反爬拦截
    c = SimpleCookie(COOKIE_STR)
    for key, morsel in c.items():
        SESSION.cookies.set(key, morsel.value, domain=".douban.com")

# 评分映射
RATING_MAP = {
    "rating1-t": 1,
    "rating2-t": 2,
    "rating3-t": 3,
    "rating4-t": 4,
    "rating5-t": 5,
}

# 游戏评分映射（豆瓣游戏页用 allstar 类名）
GAME_RATING_MAP = {
    "allstar10": 1,
    "allstar20": 2,
    "allstar30": 3,
    "allstar40": 4,
    "allstar50": 5,
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


def parse_game_page(soup):
    """解析豆瓣游戏收藏页（结构完全不同：.common-item + .rating-star allstar*）"""
    items = []
    item_els = soup.select(".common-item")

    for item in item_els:
        try:
            # 封面图片
            img_el = item.select_one(".pic img")
            if not img_el:
                continue
            cover = img_el.get("src", "").strip()
            cover = re.sub(r"/s_ratio_poster/", "/l_ratio_poster/", cover)
            cover = re.sub(r"/s/public/", "/l/public/", cover)
            cover = re.sub(r"/s_ratio_poster$", "/l_ratio_poster", cover)

            # 链接和 ID（游戏页 URL 是 /game/ 而非 /subject/）
            link_el = item.select_one(".pic a")
            url = link_el.get("href", "").strip() if link_el else ""
            item_id = ""
            for id_pattern in [r"/game/(\d+)/", r"/subject/(\d+)/"]:
                id_match = re.search(id_pattern, url)
                if id_match:
                    item_id = id_match.group(1)
                    break

            # 标题
            title_el = item.select_one(".title a")
            title = title_el.get_text(strip=True) if title_el else ""

            # 作者/开发商信息（游戏页没有单独的 author 字段，混在 .desc 里）
            author = ""

            # 评分（游戏页用 .rating-star.allstar50 这样的类名）
            rating = 0
            star_el = item.select_one(".rating-star")
            if star_el:
                for cls in star_el.get("class", []):
                    if cls in GAME_RATING_MAP:
                        rating = GAME_RATING_MAP[cls]
                        break

            # 日期
            date_el = item.select_one(".date")
            date = ""
            if date_el:
                raw = date_el.get_text(strip=True)
                date = raw.split("\n")[0].strip() if raw else ""

            # 标签（留空）
            tags = []

            # 评论（游戏页的评论文本在 .desc 后面的 div 里）
            comment = ""
            desc_el = item.select_one(".desc")
            if desc_el:
                comment_el = desc_el.find_next_sibling("div")
                if comment_el and "user-operation" not in " ".join(comment_el.get("class", [])):
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
            log(f"  解析游戏条目出错: {e}")
            continue

    return items


def parse_collection_page(html, category):
    """解析豆瓣收藏页的 HTML，返回条目列表"""
    soup = BeautifulSoup(html, "html.parser")
    items = []

    # 书籍用 .subject-item（新版），电影/音乐用 .item（旧版）
    # 游戏用 .common-item（完全不同结构，单独处理）
    if category == "game":
        return parse_game_page(soup)

    if category == "book":
        item_els = soup.select(".subject-item")
    else:
        item_els = soup.select(".item")

    for item in item_els:
        try:
            # 封面图片
            img_el = item.select_one(".pic img")
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
            if category == "book":
                title_el = item.select_one(".info h2 a")
                title = title_el.get("title", "") or title_el.get_text(strip=True) if title_el else ""
            else:
                title_el = item.select_one(".title a em")
                title = title_el.get_text(strip=True) if title_el else ""

            # 作者/艺术家信息
            if category == "book":
                pub_el = item.select_one(".pub")
                author = unescape(pub_el.get_text(strip=True)) if pub_el else ""
            else:
                intro_el = item.select_one(".intro")
                author = unescape(intro_el.get_text(strip=True)) if intro_el else ""

            # 评分
            rating = 0
            for cls, val in RATING_MAP.items():
                if item.select_one(f".{cls}"):
                    rating = val
                    break

            # 日期（清理多余文本，如 "2026-01-01\n      读过"）
            date_el = item.select_one(".date")
            date = ""
            if date_el:
                raw = date_el.get_text(strip=True)
                date = raw.split("\n")[0].strip() if raw else ""

            # 标签（收藏页不显示标签，留空）
            tags = []

            # 评论
            comment_el = item.select_one(".comment")
            comment = comment_el.get_text(strip=True) if comment_el else ""

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
        "game": "www.douban.com",
    }
    domain = domains.get(category, f"{category}.douban.com")
    all_items = []

    for status in statuses:
        page = 0
        while True:
            # 游戏页的 URL 结构完全不同，且需要区分玩过/想玩/在玩
            if category == "game":
                url = f"https://{domain}/people/{USER_ID}/games?action={status}&start={page}"
            else:
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
            # 安全上限（200页 = 3000条，正常不会达到）
            if page >= 3000:
                break

    return all_items


def fetch_recent_from_homepage():
    """从用户主页抓取最近的书影音条目（无需 Cookie）"""
    log("  从用户主页抓取最近条目...")
    url = f"https://www.douban.com/people/{USER_ID}/"
    html = fetch_page(url)
    if not html:
        return {"books": [], "movies": [], "music": [], "games": []}

    soup = BeautifulSoup(html, "html.parser")
    result = {"books": [], "movies": [], "music": [], "games": []}
    cat_map = {"book": "books", "movie": "movies", "music": "music", "game": "games"}

    for category in ["book", "movie", "music", "game"]:
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
    log(f"Cookie: {'已提供' if COOKIE_STR else '未提供（仅抓取主页最近条目）'}")
    log(f"输出: {DATA_FILE}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if COOKIE_STR:
        # 有 Cookie：抓取完整收藏
        all_data = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "books": [],
            "movies": [],
            "music": [],
            "games": [],
        }

        log("\n--- 书籍 ---")
        all_data["books"] = fetch_category_collections("book", ["collect"])

        log("\n--- 电影 ---")
        all_data["movies"] = fetch_category_collections("movie", ["collect"])

        log("\n--- 音乐 ---")
        all_data["music"] = fetch_category_collections("music", ["collect"])

        log("\n--- 游戏 ---")
        all_data["games"] = fetch_category_collections("game", ["wish", "do", "collect"])

        log(f"\n总计: 书籍 {len(all_data['books'])} 条, "
             f"电影 {len(all_data['movies'])} 条, "
             f"音乐 {len(all_data['music'])} 条, "
             f"游戏 {len(all_data['games'])} 条")
    else:
        # 无 Cookie：从主页抓取最近条目
        log("\n无 Cookie，从主页抓取最近条目...")
        recent = fetch_recent_from_homepage()
        all_data = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "books": recent.get("books", []),
            "movies": recent.get("movies", []),
            "music": recent.get("music", []),
            "games": recent.get("games", []),
        }
        log(f"主页条目: 书籍 {len(all_data['books'])} 条, "
             f"电影 {len(all_data['movies'])} 条, "
             f"音乐 {len(all_data['music'])} 条, "
             f"游戏 {len(all_data['games'])} 条")

    # 写入 JSON
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    log(f"\n== 数据已保存到 {DATA_FILE}")
    log(f"文件大小: {DATA_FILE.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()