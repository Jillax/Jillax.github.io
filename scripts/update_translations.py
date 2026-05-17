#!/usr/bin/env python3
"""
译制作品数据同步脚本
从 B 站抓取已完成的译制视频（标题含"双语"），
结合本地译制中目录，生成统一的 JSON 数据文件。

用法:
    python scripts/update_translations.py

环境变量:
    BILI_SESSDATA: B 站 SESSDATA Cookie
    BILI_BILI_JCT: B 站 bili_jct Cookie
    BILI_BUVID3: B 站 buvid3 Cookie
    BILI_MID: B 站用户 ID（默认 518618885）
    VIDEO_CAPTIONER_DIR: VideoCaptioner 目录路径
"""

import json
import os
import re
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# bilibili-api 库（必须先修改 HEADERS 再导入其他模块）
import bilibili_api.utils.network as _bili_net
_bili_net.HEADERS.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Referer": "https://space.bilibili.com/518618885",
    "Origin": "https://space.bilibili.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
})
from bilibili_api import user, sync, Credential

# ===== 配置 =====
BILI_MID = int(os.environ.get("BILI_MID", "518618885"))
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILE = DATA_DIR / "translations.json"

# 本地译制中目录
DEFAULT_CAPTIONER_DIR = Path("D:/AI Related/VideoCaptioner")
CAPTIONER_DIR = Path(os.environ.get("VIDEO_CAPTIONER_DIR", str(DEFAULT_CAPTIONER_DIR)))
DOING_DIR = CAPTIONER_DIR / "译制中"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}


def log(msg):
    text = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        # Windows GBK 控制台下替换无法显示的字符
        print(text.encode('gbk', errors='replace').decode('gbk'), flush=True)


def create_credential():
    """从环境变量创建 B 站凭证"""
    sessdata = os.environ.get("BILI_SESSDATA", "")
    bili_jct = os.environ.get("BILI_BILI_JCT", "")
    buvid3 = os.environ.get("BILI_BUVID3", "")
    mid = os.environ.get("BILI_MID", "")

    if sessdata and bili_jct:
        return Credential(
            sessdata=sessdata,
            bili_jct=bili_jct,
            buvid3=buvid3,
            dedeuserid=mid,
        )
    return None


def fetch_bili_videos(mid, credential=None):
    """从 B 站获取用户所有投稿视频"""
    all_videos = []
    try:
        u = user.User(mid, credential=credential) if credential else user.User(mid)

        # 验证凭证是否有效
        if credential:
            try:
                info = sync(u.get_user_info())
                log(f"  用户信息: {info.get('name', '未知')}")
            except Exception as e:
                log(f"  凭证验证失败: {e}")

        pn = 1
        while True:
            try:
                result = sync(u.get_videos(ps=50, pn=pn))
            except Exception as e:
                err_str = str(e)
                if "412" in err_str:
                    log(f"  触发风控，等待 15 秒后重试...")
                    time.sleep(15)
                    try:
                        result = sync(u.get_videos(ps=50, pn=pn))
                    except Exception as e2:
                        log(f"  重试仍失败: {e2}")
                        break
                else:
                    log(f"  请求失败: {e}")
                    log(f"  详细错误:\n{traceback.format_exc()}")
                    break
            vlist = result.get("list", {}).get("vlist", [])
            if not vlist:
                break
            all_videos.extend(vlist)
            log(f"  第 {pn} 页: {len(vlist)} 条，累计 {len(all_videos)} 条")
            count = result.get("page", {}).get("count", 0)
            if pn * 50 >= count:
                break
            pn += 1
            time.sleep(1.5)  # 避免触发风控
    except Exception as e:
        log(f"  请求失败: {e}")
        log(f"  详细错误:\n{traceback.format_exc()}")
    return all_videos


def extract_original_title(title):
    """从标题中提取英文原标题"""
    # 去掉 [双语] 或 【双语|xxx】 前缀
    clean = re.sub(r'^[\[【][双语][^\]】]*[\]】]\s*', '', title)
    # 去掉 | 后面的作者名
    clean = re.sub(r'\s*[丨|]\s*[^丨|]*$', '', clean).strip()
    # 如果清理后为空，返回原标题
    return clean if clean else title


def process_bili_videos(videos):
    """处理 B 站视频，筛选标题含"双语"的作为已完成"""
    done = []
    for v in videos:
        title = v.get("title", "")
        title_clean = BeautifulSoup(title, "html.parser").get_text(strip=True)
        if "双语" not in title_clean:
            continue

        bvid = v.get("bvid", "")
        description = v.get("description", "")
        desc_clean = BeautifulSoup(description, "html.parser").get_text(strip=True)[:150]

        done.append({
            "title": title_clean,
            "originalTitle": extract_original_title(title_clean),
            "source": "Bilibili",
            "sourceUrl": f"https://www.bilibili.com/video/{bvid}",
            "bvid": bvid,
            "status": "已完成",
            "description": desc_clean,
            "cover": v.get("pic", ""),
            "date": datetime.fromtimestamp(v.get("created", 0)).strftime("%Y-%m-%d") if v.get("created") else "",
        })
    return done


def scan_doing_directory(doing_dir):
    """扫描本地译制中目录"""
    items = []
    if not doing_dir.exists():
        log(f"  目录不存在: {doing_dir}")
        return items

    for f in sorted(doing_dir.iterdir()):
        if f.suffix.lower() not in [".mp4", ".mkv", ".avi", ".mov", ".webm"]:
            continue
        name = f.stem.strip()
        if not name:
            continue
        items.append({
            "title": name,
            "originalTitle": name,
            "source": "本地",
            "sourceUrl": "",
            "bvid": "",
            "status": "译制中",
            "description": f"待上传 | {f.stat().st_size / 1024 / 1024:.0f} MB",
            "cover": "",
            "date": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d"),
        })
    return items


def load_existing_json(file_path):
    """读取现有的 JSON 文件"""
    if file_path.exists():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def preserve_doing_from_existing(file_path):
    """从现有 JSON 中提取译制中条目"""
    existing = load_existing_json(file_path)
    if existing:
        items = existing.get("items", existing) if isinstance(existing, dict) else existing
        return [item for item in items if item.get("status") == "译制中"]
    return []


def main():
    log("=== 译制作品数据同步 ===")
    log(f"B 站 MID: {BILI_MID}")
    log(f"译制中目录: {DOING_DIR}")
    log(f"输出: {DATA_FILE}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 创建 B 站凭证
    credential = create_credential()
    has_bili_credential = credential is not None
    log(f"B 站凭证: {'已提供' if has_bili_credential else '未提供（跳过 B 站同步）'}")

    # 1. 从 B 站获取已完成作品
    done_items = []
    if has_bili_credential:
        log("\n--- B 站视频 ---")
        videos = fetch_bili_videos(BILI_MID, credential)
        log(f"共 {len(videos)} 个视频")
        done_items = process_bili_videos(videos)
        log(f'其中含"双语"的已完成作品: {len(done_items)} 个')
        for item in done_items:
            log(f"  [OK] {item['title']}")

    # 2. 扫描本地译制中目录
    log("\n--- 译制中 ---")
    if DOING_DIR.exists():
        doing_items = scan_doing_directory(DOING_DIR)
        log(f"本地扫描: {len(doing_items)} 个")
    else:
        log(f"本地目录不存在 ({DOING_DIR})，从现有 JSON 保留译制中条目")
        doing_items = preserve_doing_from_existing(DATA_FILE)
        log(f"保留现有: {len(doing_items)} 个")

    for item in doing_items:
        log(f"  [..] {item['title']}")

    # 3. 合并数据
    all_items = done_items + doing_items
    all_items.sort(key=lambda x: (0 if x["status"] == "已完成" else 1, x.get("date", "")), reverse=False)

    output = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": all_items,
    }

    # 4. 写入 JSON
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    log(f"\n== 数据已保存到 {DATA_FILE}")
    log(f"共 {len(all_items)} 条（已完成 {len(done_items)}，译制中 {len(doing_items)}）")
    log(f"文件大小: {DATA_FILE.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()