# -*- coding: utf-8 -*-
"""生成 teacher-scoreline/data.js：把 gaokao/data 里的山东五年投档线，
折算成「师范生源在同龄人中的位置」这一条可核查的实证线。

口径
  · 位次百分位 = 该专业投档最低位次 ÷ 当年山东一段线上人数 × 100
      数值越小 = 位次越靠前 = 生源越好。这是本页唯一贯穿全页的量纲。
  · 提前批公费师范（11 所，site.js）与常规批（td*.js）分开统计，不混算。
  · 年度比较一律「配对法」：只比同校同专业名（含定向就业市）两年都出现的记录，
    避免某年多招几个冷门定向市把中位数拉低。

数据源：山东省教育招生考试院投档表 + 各校本科招生网（见 gaokao/data/*.js）
"""
import json
import os
import re
import statistics as st
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAO = os.path.join(ROOT, "gaokao", "data")
OUT = os.path.join(ROOT, "teacher-scoreline", "data.js")


def load_json(path, marker):
    s = open(path, encoding="utf-8").read()
    if marker:
        i = s.index(marker) + len(marker)
    else:
        i = s.index("{")
    return json.loads(s[i:s.rindex("}") + 1])


def load_td(y):
    s = open(os.path.join(GAO, "td%d.js" % y), encoding="utf-8").read()
    j = s.index("] =") + 3
    return json.loads(s[j:s.rindex("}") + 1])


def base_name(n):
    return re.sub(r"[（(].*?[）)]", "", n).strip()


META = load_json(os.path.join(GAO, "meta.js"), None)
SCH = META["schools"]
YEARS = META["years"]
TOT = {y: max(c for s, c in arr) for y, arr in META["bands"].items()}

# ---------------- 1. 提前批公费师范生 ----------------
SITE = load_json(os.path.join(GAO, "site.js"), None)
PROV = ["山东师范大学", "曲阜师范大学", "聊城大学", "临沂大学", "青岛大学", "鲁东大学", "济南大学"]
BU = ["北京师范大学", "华东师范大学", "东北师范大学", "华中师范大学", "西南大学", "陕西师范大学"]
# 六所部属师大现在都有数据，但年份不齐：北师大、陕西师大、西南大学各只有 2023—2025。
BU_MISSING = []


def site_rows(schools):
    for k in schools:
        if k not in SITE:
            continue
        for r in SITE[k]["rows"]:
            if r[6]:
                yield k, r[0], r[1], r[6]


def med_by_year(rows):
    d = defaultdict(list)
    for _, y, _, rk in rows:
        d[y].append(rk)
    return {str(y): round(st.median(v)) for y, v in sorted(d.items())}


def pairs(rows):
    """逐年配对：同校同专业名（含定向就业市）两年都出现的记录，位次变化中位数。"""
    by = defaultdict(dict)
    for k, y, m, rk in rows:
        by[(k, m)][y] = rk
    out = []
    for a, b in zip(YEARS, YEARS[1:]):
        ds = [v[b] - v[a] for v in by.values() if a in v and b in v]
        if not ds:
            continue
        out.append({
            "from": a, "to": b, "n": len(ds),
            "delta": round(st.median(ds)),
            "shareBetter": round(sum(1 for x in ds if x < 0) / len(ds) * 100),
        })
    return out


prov_rows = list(site_rows(PROV))
bu_rows = list(site_rows(BU))

prov_school = {}
for k in PROV:
    if k in SITE:
        prov_school[k] = {
            "years": sorted({r[0] for r in SITE[k]["rows"]}),
            "median": med_by_year(site_rows([k])),
            "n": {str(y): sum(1 for r in SITE[k]["rows"] if r[0] == y and r[6]) for y in YEARS},
            "src": SITE[k]["src"], "srcUrl": SITE[k]["srcUrl"],
        }
bu_school = {}
for k in BU:
    if k in SITE:
        bu_school[k] = {
            "years": sorted({r[0] for r in SITE[k]["rows"]}),
            "median": med_by_year(site_rows([k])),
            "n": {str(y): sum(1 for r in SITE[k]["rows"] if r[0] == y and r[6]) for y in YEARS},
            "src": SITE[k]["src"], "srcUrl": SITE[k]["srcUrl"],
        }

def agg_by_school(schools_dict, names):
    """每所学校先取自己的中位位次，再对这些中位数取中位（一校一票）。
    直接池化所有记录会让投放专业多的学校（如西南大学）主导结果。"""
    agg, n = {}, {}
    for y in YEARS:
        vals = [schools_dict[k]["median"][str(y)] for k in names
                if k in schools_dict and schools_dict[k]["median"].get(str(y))]
        agg[str(y)] = round(st.median(vals)) if vals else None
        n[str(y)] = len(vals)
    return agg, n


def balanced_panel(schools_dict, names):
    """连续五年都有数据的学校子集——用固定面板复算一遍，排除「今年谁报了数据」的组成效应。"""
    keep = [k for k in names if k in schools_dict
            and all(schools_dict[k]["median"].get(str(y)) for y in YEARS)]
    agg, _ = agg_by_school({k: schools_dict[k] for k in keep}, keep)
    return {"schools": keep, "median": agg}


prov_agg, prov_n = agg_by_school(prov_school, PROV)
bu_agg, bu_n = agg_by_school(bu_school, BU)


# ---------------- 2. 常规批：师范院校 ----------------
rows_pct = []          # (year, code, type, tier, 院校位次百分位中位)
sp_vs_np = defaultdict(lambda: {"sp": [], "np": []})
sdn_pairs = defaultdict(dict)   # 山东师大 同底名配对
sdn_pct = defaultdict(lambda: {"sp": [], "np": []})

for y in YEARS:
    D = load_td(y)
    for code, items in D.items():
        info = SCH.get(code, {})
        typ, tier = info.get("type", ""), info.get("tier", "")
        ranks = [it[2] for it in items if it[2]]
        if len(ranks) < 3:
            continue
        rows_pct.append((y, code, typ, tier, round(st.median(ranks) / TOT[str(y)] * 100, 2)))
        if typ != "师范":
            continue
        plain, sp = defaultdict(list), defaultdict(list)
        for it in items:
            if not it[2]:
                continue
            key = "sp" if "师范" in it[1] else "np"
            (sp if key == "sp" else plain)[base_name(it[1])].append(it[2])
            sp_vs_np[y][key].append(it[2] / TOT[str(y)] * 100)
            if info.get("n") == "山东师范大学":
                sdn_pct[y][key].append(it[2] / TOT[str(y)] * 100)
        if info.get("n") == "山东师范大学":
            for b, rs in sp.items():
                if b in plain:
                    a, c = st.median(rs), st.median(plain[b])
                    sdn_pairs[y][b] = [round(a), round(c), round(a - c)]


def pct_line(pool, key):
    return {str(y): (round(st.median(pool[y][key]), 2) if pool[y][key] else None) for y in YEARS}


school_pct = {}
for y in YEARS:
    for typ in ["师范", "综合", "理工", "财经", "医药"]:
        v = [r[4] for r in rows_pct if r[0] == y and r[2] == typ]
        school_pct.setdefault(typ, {})[str(y)] = round(st.median(v), 2) if v else None
    for tier in ["985", "211", "双一流", "普通"]:
        v = [r[4] for r in rows_pct if r[0] == y and r[2] == "师范" and r[3] == tier]
        school_pct.setdefault("师范-" + tier, {})[str(y)] = round(st.median(v), 2) if v else None

# ---------------- 3. 长期时代分段（文献重建，非实测） ----------------
# 区间 = 该时代师范生源在同届同龄人中的大致位置（前百分之几），给的是区间而不是点值。
ERAS = [
    {
        "id": "e1", "from": 1977, "to": 1985, "tone": "high",
        "title": "恢复高考·稀缺期",
        "lead": "包分配到人，师范是农村子弟最稳的一条上升通道",
        "tracks": {"zhongshi": [2, 4], "benke": [6, 12], "gongfei": None},
        "evidence": [
            "1980 年全国小学教师 549.3 万人，其中 275 万多人未达标——师资缺口巨大，师范院校与中师吸纳的是「能考上就包分配」的一批人。",
            "1977 年高考录取率只有 4.7%，1980 年前后也不过 8%——本科师范生本身即同龄人中的前 10% 上下；当时师范院校多与综合大学同批录取，包分配是它最硬的筹码。"
        ],
        "conf": "文献",
        "src": [{"t": "中国教育报《中师教育崛起与衰落的理性审视》", "u": "http://www.jyb.cn/rmtzgjsb/202307/t20230704_2111064844.html"}],
    },
    {
        "id": "e2", "from": 1986, "to": 1995, "tone": "peak",
        "title": "中师黄金期·初中起点的掐尖",
        "lead": "「一类学生上中师，二类学生上高中」",
        "tracks": {"zhongshi": [0.8, 2], "benke": [8, 15], "gongfei": None},
        "evidence": [
            "中师录取线普遍比当地重点高中高 30—50 分；有的县一年只有 28 个公费中师名额，分给全县约一万名中考生。",
            "中师免学费、发生活费、包分配、转城镇户口、干部身份——对农村考生是「跳农门」的最快路径；中师在校生从 1983 年 45.4 万人增至 1995 年 84.9 万人。",
            "同期本科师范院校并非最热：高分考生优先综合大学与理工科，师范本科在同批录取者中属中上而非顶尖。"
        ],
        "conf": "文献",
        "src": [
            {"t": "中国教育报《中师教育崛起与衰落的理性审视》", "u": "http://www.jyb.cn/rmtzgjsb/202307/t20230704_2111064844.html"},
            {"t": "《广东教育》中师生回忆（梅州师范：录取线比县最好高中高四五十分，全县 28 个名额）", "u": "http://ebook.gdjy.cn/sdqzb/html/2020-09/05/content_71224_16187409.htm"},
        ],
    },
    {
        "id": "e3", "from": 1996, "to": 2002, "tone": "fall",
        "title": "并轨·断奶",
        "lead": "收费并轨、扩招、停止包分配，三件事同时发生",
        "tracks": {"zhongshi": [2, 6], "benke": [15, 25], "gongfei": None},
        "evidence": [
            "1997 年高校收费并轨，师范院校的免费优惠陆续淡出；1999 年高校扩招，本科文凭迅速贬值。",
            "2000 年起师范生取消免费，2002 年起师范毕业生「一刀切」停止分配——师范与「铁饭碗」的绑定被解除。",
            "1999 年教育部要求三级师范过渡到二级师范，中师开始停招、改制、升格，中师这条通道退出历史。"
        ],
        "conf": "文献",
        "src": [
            {"t": "南京师范大学《老照片勾起的回忆》", "u": "https://news.njnu.edu.cn/info/1025/66170.htm"},
            {"t": "中国教育报《一所省属师范院校的「回归」》", "u": "http://www.jyb.cn/rmtzgjyb/201904/t20190425_228644.html"},
        ],
    },
    {
        "id": "e4", "from": 2003, "to": 2007, "tone": "trough",
        "title": "谷底·被当成保底志愿",
        "lead": "师范类院校在平行志愿里沦为「兜底选项」",
        "tracks": {"zhongshi": [4, 10], "benke": [28, 40], "gongfei": None},
        "evidence": [
            "2003 年海南中招：3000 个师范专业计划空档 600 多个，已录取生源质量不如往年；「考师范等于捧饭碗」的历史不复存在。",
            "2007 年两会，启东中学校长王生称「2000 年起取消免费，2004、2005 年以后招到的老师素质直线下滑」；江苏省人大代表褚庆前称师范院校生源较差，实行平行志愿后「仅被考生当作保底」。",
            "2009 年调查：不再包分配后师范生源质量急剧下滑，一批中考两三百分的学生进入师范学校。"
        ],
        "conf": "文献",
        "src": [
            {"t": "新华网海南频道 2003-08-05", "u": "http://www.hq.xinhuanet.com/news/2003-08/05/content_783092.htm"},
            {"t": "中国新闻网 2007-03-07《师范生取消免费致教师素质下滑 或恢复提前录取》", "u": "https://www.chinanews.com.cn/edu/zkzx/news/2007/03-07/885419.shtml"},
            {"t": "中国法院网 2009-03《中等师范教育萎缩严重》", "u": "http://www.chinacourt.cn/article/detail/2009/03/id/349658.shtml"},
        ],
    },
    {
        "id": "e5", "from": 2008, "to": 2017, "tone": "repair",
        "title": "政策修复·从免费到公费",
        "lead": "国家用「免学费 + 包入编」把优质生源重新买回来",
        "tracks": {"zhongshi": None, "benke": [18, 28], "gongfei": [2, 6]},
        "evidence": [
            "2007 年国务院在六所部属师大重启师范生免费教育（国办发〔2007〕34 号），提前批录取、免学费住宿费、补助生活费、保证入编入岗。",
            "截至 2017 年累计招收免费师范生 10.1 万人；带动 28 个省份实施地方师范生免费教育。",
            "2012 年教师资格改为全国统考，2015 年起师范生也要考证上讲台，教师入口收紧；2018 年免费教育升级为公费教育，履约期 6 年。"
        ],
        "conf": "政策",
        "src": [
            {"t": "教育部《师范生公费教育实施办法》答记者问（2018-08）", "u": "https://www.gov.cn/zhengce/2018-08/11/content_5313177.htm"},
            {"t": "国办发〔2018〕75 号", "u": "https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/201808/t20180810_345023.html"},
        ],
    },
    {
        "id": "e6", "from": 2018, "to": 2023, "tone": "peak",
        "title": "第二高点·教资热与公费师范热",
        "lead": "教资报名从 65 万涨到 1144 万，公费师范提前批位次整体前移",
        "tracks": {"zhongshi": None, "benke": [10, 18], "gongfei": [1, 4]},
        "evidence": [
            "教师资格考试报名人数：2012 年 17.2 万 → 2016 年 260 万 → 2018 年 651 万 → 2021/2022 年 1144.2 万，其中约 800 万是非师范生。",
            "2022 年华东师大教务处长称：浙江、山东、湖北、内蒙古提前批次录取位次较 2021 年提升 1000 多名；四川六所部属师大招 559 人，一志愿 8460 人，约 1:15。",
            "2022 年重庆渝中区教师招聘 98 个岗位 1.57 万人报名，平均 161:1，最热小学英语岗 827:1。"
        ],
        "conf": "实证+文献",
        "src": [
            {"t": "央广网 2022-10-31", "u": "https://news.cnr.cn/rebang/20221031/t20221031_526046445.shtml"},
            {"t": "光明日报《「教资热」的背后》2022-10-29", "u": "https://epaper.gmw.cn/wzb/html/2022-10/29/nw.D110000wzb_20221029_2-01.htm"},
            {"t": "七一网《人才要闻》", "u": "https://www.12371.gov.cn/web/column/col5010931_22.html"},
        ],
    },
    {
        "id": "e7", "from": 2024, "to": 2026, "tone": "split",
        "title": "高位分化·带编的涨，不带编的退",
        "lead": "同一所师范院校里，「师范类」标签开始变成减分项",
        "tracks": {"zhongshi": None, "benke": [14, 24], "gongfei": [0.5, 7]},
        "evidence": [
            "山东实测：省属公费师范生（有编有岗）同专业配对位次连续三年大幅前移，2024→2025 中位前移 5548 位、88% 的专业变热。",
            "同一时期，部属师大公费师范生在 7000—11000 位之间震荡，没有趋势——顶尖段已见顶。",
            "师范院校常规批（非公费）整体位次百分位从 2023 年 22.8 退到 2026 年 25.8；山东师大 2026 年校内同专业对照，5 个「师范类」全部比同名非师范专业更冷，数学与应用数学差 10780 位。",
            "2025 年全国出生人口 792 万，首次跌破 800 万；2024 年小学招生 1616.63 万，比 2023 年峰值少 261.25 万；2024 年专任教师总数首次下降，江西教师招聘计划同比减少 54.7%。"
        ],
        "conf": "实测（山东）",
        "src": [
            {"t": "教育部《2024 年全国教育事业发展统计公报》", "u": "https://www.moe.gov.cn/jyb_sjzl/sjzl_fztjgb/202506/t20250611_1193760.html"},
            {"t": "《财经》《不需要那么多小学老师了，他们都去做什么？》", "u": "https://news.caijingmobile.com/article/detail/555617?source_id=40"},
        ],
    },
]

EVENTS = [
    {"y": 1977, "t": "恢复高考", "d": "师范院校与综合大学同批录取，毕业生国家分配。"},
    {"y": 1980, "t": "师资缺口见底", "d": "小学教师 549.3 万人，275 万人未达标。"},
    {"y": 1995, "t": "中师在校生峰值", "d": "84.9 万人；此后黄金期褪色。"},
    {"y": 1997, "t": "高校收费并轨", "d": "师范免费优惠逐步淡出。"},
    {"y": 1999, "t": "高校扩招 + 三级师范转二级", "d": "中师停招、改制、升格。"},
    {"y": 2000, "t": "师范生取消免费", "d": "「铁饭碗」绑定开始松动。"},
    {"y": 2002, "t": "停止包分配", "d": "师范毕业生「一刀切」进入市场。"},
    {"y": 2003, "t": "师范生源谷底", "d": "海南 3000 个师范计划空档 600 多个。"},
    {"y": 2007, "t": "部属师大免费师范生", "d": "六校提前批、免学费、包入编。"},
    {"y": 2012, "t": "教资国考", "d": "教师资格考试报名 17.2 万人。"},
    {"y": 2015, "t": "师范生也要考证", "d": "教师入口全面收紧。"},
    {"y": 2018, "t": "公费师范生办法", "d": "免费教育升级为公费教育，履约 6 年。"},
    {"y": 2022, "t": "教资报名 1144 万", "d": "约为同年高考报名人数的 1.06 倍。"},
    {"y": 2024, "t": "小学招生拐点", "d": "招生 1616.63 万，比上年少 261.25 万。"},
    {"y": 2025, "t": "出生人口跌破 800 万", "d": "792 万；多地小学停招、教师转岗。"},
]

DATA = {
    "updated": "2026-11-03",
    "scope": "山东省 2022—2026 年普通类投档数据 + 1977 年以来的政策与文献",
    "tot": {str(k): v for k, v in TOT.items()},
    "eras": ERAS,
    "events": EVENTS,
    "sd": {
        "years": YEARS,
        "prov": {"median": prov_agg, "pooled": med_by_year(prov_rows),
                 "nSchools": prov_n, "pairs": pairs(prov_rows),
                 "n": len(prov_rows), "schools": prov_school,
                 "panel": balanced_panel(prov_school, PROV)},
        "bu": {"median": bu_agg, "pooled": med_by_year(bu_rows),
               "nSchools": bu_n, "pairs": pairs(bu_rows),
               "n": len(bu_rows), "schools": bu_school, "missing": BU_MISSING,
               "panel": balanced_panel(bu_school, BU)},
        "normal": {"师范": school_pct["师范"], "综合": school_pct["综合"],
                   "理工": school_pct["理工"],
                   "师范-211": school_pct["师范-211"], "师范-普通": school_pct["师范-普通"]},
        "spvnp": {"sp": pct_line(sp_vs_np, "sp"), "np": pct_line(sp_vs_np, "np")},
        "sdn": {"sp": pct_line(sdn_pct, "sp"), "np": pct_line(sdn_pct, "np"),
                "pairs": {str(y): sdn_pairs[y] for y in YEARS if sdn_pairs[y]},
                "counts": {str(y): [len(sdn_pct[y]["sp"]), len(sdn_pct[y]["np"])] for y in YEARS}},
    },
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* 由 scripts/build_teacher_scoreline.py 自动生成，不要手改。\n"
            "   来源：山东省教育招生考试院投档表、各校本科招生网、教育部统计公报与政策文件。 */\n")
    f.write("window.TSCORE = ")
    json.dump(DATA, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("写入", OUT)
print("省属公费 各校中位的中位", DATA["sd"]["prov"]["median"], "校数", DATA["sd"]["prov"]["nSchools"])
print("部属公费 各校中位的中位", DATA["sd"]["bu"]["median"], "校数", DATA["sd"]["bu"]["nSchools"])
print("省属配对", DATA["sd"]["prov"]["pairs"])
print("部属配对", DATA["sd"]["bu"]["pairs"])
print("师范院校百分位", school_pct["师范"])
print("山东师大 sp/np", DATA["sd"]["sdn"]["sp"], DATA["sd"]["sdn"]["np"])
print("山东师大 2026 配对", DATA["sd"]["sdn"]["pairs"].get("2026"))
