# -*- coding: utf-8 -*-
"""
生成 shandong-fiscal/map-data.js：山东省 16 个地级市的内联 SVG 路径。

原始边界来源：阿里云 DataV.GeoAtlas（geo.datav.aliyun.com），
370000_full.json（含 16 个地级市子区域，adcode 370100—371700）。

处理流程：
  1. 等距圆柱投影（经度按全省平均纬度压缩）到像素坐标；
  2. Douglas–Peucker 抽稀（像素空间，容差 TOL_PX）；
  3. 丢弃面积小于 MIN_RING 的碎小岛屿环；
  4. 以最大环的质心为标签锚点（手工偏移见 LABEL_SHIFT）。

用法：
  python scripts/build_shandong_map.py
    首次运行会下载 GeoJSON 并缓存到 scripts/data/shandong_370000_full.json。

输出：
  shandong-fiscal/map-data.js   —— window.SDMAP = { viewBox, cities: {名: {d, cx, cy}} }
"""

import json
import math
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE_DIR = os.path.join(HERE, "data")
CACHE = os.path.join(CACHE_DIR, "shandong_370000_full.json")
OUT = os.path.join(ROOT, "shandong-fiscal", "map-data.js")
URL = "https://geo.datav.aliyun.com/areas_v3/bound/370000_full.json"

# 全省范围（370000_full.json 实测），投影参数
LON0, LON1 = 114.6, 123.0
LAT0, LAT1 = 34.2, 38.6
MAP_W = 1000.0

TOL_PX = 1.8        # 抽稀容差（像素）；页面渲染约为 viewBox 的一半宽，屏上误差 <1px
MIN_RING = 30.0     # 小于该面积（平方像素）的环丢弃——去小岛，保留主要岛屿


def fetch():
    os.makedirs(CACHE_DIR, exist_ok=True)
    if os.path.exists(CACHE):
        with open(CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    with open(CACHE, "wb") as f:
        f.write(data)
    return json.loads(data.decode("utf-8"))


def build_projector():
    lat_r = math.radians((LAT0 + LAT1) / 2)
    span_x = (LON1 - LON0) * math.cos(lat_r)
    k = MAP_W / span_x

    def proj(lon, lat):
        return (lon - LON0) * math.cos(lat_r) * k, (LAT1 - lat) * k

    return proj


def ring_area(pts):
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def centroid(pts):
    a = cx = cy = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a /= 2
    if a == 0:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    return cx / (6 * a), cy / (6 * a)


def simplify(pts, tol):
    """Douglas–Peucker，输入输出均为 [(x, y), ...]，闭合环按首尾相接处理。"""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True

    def seg_dist(p, a, b):
        ax, ay = a
        bx, by = b
        px, py = p
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        if L == 0:
            return math.hypot(px - ax, py - ay)
        t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    stack = [(0, len(pts) - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1:
            continue
        dmax, imax = 0.0, -1
        for i in range(i0 + 1, i1):
            d = seg_dist(pts[i], pts[i0], pts[i1])
            if d > dmax:
                dmax, imax = d, i
        if dmax > tol:
            keep[imax] = True
            stack.append((i0, imax))
            stack.append((imax, i1))
    return [p for p, k in zip(pts, keep) if k]


# 标签锚点手工微调：(dx, dy)，在自动质心基础上挪，避免压线或出界
LABEL_SHIFT = {
    "滨州": (0, -6),
    "东营": (10, 6),
    "日照": (6, 4),
    "枣庄": (0, 6),
    "济南": (6, 0),
}


def main():
    gj = fetch()
    proj = build_projector()

    cities = {}
    xs, ys = [], []
    for feat in gj["features"]:
        name = feat["properties"]["name"].replace("市", "")
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]

        rings = []
        for poly in polys:
            r = [proj(x, y) for x, y in poly[0]]
            if ring_area(r) >= MIN_RING:
                rings.append(r)
        if not rings:
            continue

        subpaths = []
        for r in rings:
            for x, y in r:
                xs.append(x)
                ys.append(y)
            s = simplify(r + [r[0]], TOL_PX)
            if len(s) < 4:
                continue
            subpaths.append("M" + " ".join("%.1f %.1f" % p for p in s) + "Z")

        big = max(rings, key=ring_area)
        cx, cy = centroid(big)
        dx, dy = LABEL_SHIFT.get(name, (0, 0))
        cities[name] = {
            "d": "".join(subpaths),
            "cx": round(cx + dx, 1),
            "cy": round(cy + dy, 1),
        }

    pad = 10
    vb = [round(min(xs) - pad), round(min(ys) - pad),
          round(max(xs) - min(xs) + 2 * pad), round(max(ys) - min(ys) + 2 * pad)]

    js = (
        "/* 由 scripts/build_shandong_map.py 生成，请勿手工编辑。 */\n"
        "/* 边界来源：阿里云 DataV.GeoAtlas 370000_full.json，抽稀容差 %.1fpx，丢弃 <%.0fpx² 小岛。 */\n"
        "window.SDMAP = {\n"
        '  "viewBox": [%d, %d, %d, %d],\n'
        '  "cities": {\n' % (TOL_PX, MIN_RING, vb[0], vb[1], vb[2], vb[3])
    )
    for name, c in cities.items():
        js += '    "%s": {"d": "%s", "cx": %s, "cy": %s},\n' % (
            name, c["d"], c["cx"], c["cy"])
    js = js.rstrip(",\n") + "\n  }\n};\n"

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    n_pts = sum(c["d"].count(" ") for c in cities.values())
    print("wrote %s  (%.1f KB, %d cities, ~%d pts, viewBox %s)" % (
        os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024, len(cities), n_pts, vb))


if __name__ == "__main__":
    main()
