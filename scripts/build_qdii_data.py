# -*- coding: utf-8 -*-
# -*- coding: utf-8 -*-
"""生成 qdii-indices/data.js：境内跟踪海外指数的基金规模。

用法：python scripts/build_qdii_data.py            # 有缓存则用缓存
      python scripts/build_qdii_data.py --refresh  # 重新抓取（约 1,200 个基金档案）
数据源：天天基金（东方财富）基金档案接口，规模取各基金份额类别的净资产。
"""
import json, re, collections, os, sys, time
import urllib.request
import concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", "data", "qdii", "raw.json")
BASE = ("https://fundmobapi.eastmoney.com/FundMNewApi/FundMNNBasicInformation"
        "?FCODE={}&deviceid=1&plat=Android&product=EFund&version=1&appType=ttjj")


def _get(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout).read()


def fetch_raw():
    txt = _get("https://fund.eastmoney.com/js/fundcode_search.js").decode("utf-8-sig")
    arr = json.loads(txt.split("=", 1)[1].strip().rstrip(";"))
    cands = [x for x in arr
             if ("QDII" in x[3] or "海外" in x[3])
             or (x[3] == "指数型-股票" and any(k in x[2] for k in ["恒生", "港股通", "中概", "香港"]))]
    seen, codes = set(), []
    for x in cands:
        if x[0] not in seen:
            seen.add(x[0]); codes.append((x[0], x[2], x[3]))

    def one(item):
        code, name, typ = item
        for _ in range(2):
            try:
                d = json.loads(_get(BASE.format(code), 12).decode("utf-8")).get("Datas") or {}
                return {"code": code, "name": d.get("SHORTNAME") or name, "type": typ,
                        "idx_code": d.get("INDEXCODE"), "idx_name": d.get("INDEXNAME"),
                        "endnav": d.get("ENDNAV"), "navdate": d.get("FEGMRQ"),
                        "status": d.get("SGZT"), "company": d.get("JJGS")}
            except Exception:
                time.sleep(0.3)
        return {"code": code, "name": name, "type": typ, "err": True}

    out = []
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        for r in ex.map(one, codes):
            out.append(r)
    return out


if os.path.exists(CACHE) and "--refresh" not in sys.argv:
    raw = json.load(open(CACHE, encoding="utf-8"))
else:
    raw = fetch_raw()
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(raw, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
def f(x):
    try: return float(x)
    except: return 0.0

def clean(n):
    s = re.sub(r"[（(](QDII-LOF|QDII|LOF)[)）]", "", n)
    s = re.sub(r"(人民币|美元现汇|美元现钞|美元汇|美元|现汇|现钞|美钞|美汇)", "", s)
    s = re.sub(r"[A-Z]$", "", s)
    s = s.replace("指数", "")
    return s.strip()

GROUPS = [
    ("core",   "美股宽基", "把钱押在美国大盘上"),
    ("sector", "美股行业", "同一条标普，切成一格一格"),
    ("global", "全球行业", "不押国家，押行业"),
    ("region", "国别与区域", "单一市场的纯度"),
    ("reit",   "海外REITs", "收租型资产"),
    ("hk",     "中国香港", "境外市场里的中国资产"),
]
GROUP_IDS = {"NDX100":"core","SPX":"core","SP500EWTR":"core","SPOEXEUT":"core","NDXTMC":"core","DJIA":"core","750108":"core",
 "SBI":"sector","SP50035":"sector","SPSIBI":"sector","NBI":"sector","SPCDSSI":"sector","SP5CSSUP":"sector","SPSIOP":"sector","DJSOEP":"sector",
 "SPG120035":"global","SPGOGUP":"global","IN0003":"global",
 "N225":"region","TPX":"region","GDAXI":"region","FCHI":"region","FTSE":"region","FISAULMU":"region","BVSP":"region","ASIATECP":"region","IMIT50":"region","INDIA":"region","VN30":"region",
 "DWRTF":"reit","UNGL":"reit","RMS":"reit",
 "HSTECH":"hk","HSI":"hk","HSCEI":"hk"}

META = {
"NDX100": ("纳斯达克100", "NASDAQ-100", "纳斯达克交易所市值最大的 100 家非金融公司，修正市值加权。科技约占六成，不含金融股，是境内 QDII 里最拥挤的一条线。",
           "只买非金融，所以它更像“科技+消费”而不是全市场。"),
"SPX": ("标普500", "S&P 500", "美国 500 家大型公司，流通市值加权，覆盖美股约八成总市值。行业分布比纳指 100 均衡，通常被当作美股底仓。",
        "同样是美股，它比纳指 100 多了金融、工业、能源。"),
"SP500EWTR": ("标普500等权", "S&P 500 Equal Weight", "同一批 500 只股票，每只权重约 0.2%，把巨头的权重摊平。历史上小盘和价值风格占优时跑赢市值加权版。",
              "境内只有大成一家的份额，且长期限购。"),
"SPOEXEUT": ("标普100等权", "S&P 100 Equal Weight", "标普 100（美国超大盘蓝筹，含金融）的等权版本，成分约 100 只；等权后金融、工业、医疗的权重明显高于市值加权。",
              "小众到只有长信一只产品，常年暂停申购。"),
"NDXTMC": ("纳斯达克科技", "NASDAQ Tech Market Cap Weighted", "从纳指 100 里再筛出科技行业，按市值加权。等于把英伟达、微软、苹果的权重再放大一档。",
            "它是纳指 100 的“加强版科技”，不是另一条独立指数。"),
"DJIA": ("道琼斯工业平均", "Dow Jones Industrial Average", "30 只美国蓝筹，价格加权——股价越高权重越大。编制方式古老，行业代表性弱于标普 500，但名义年龄最老。",
          "价格加权让高股价公司天然占优，这是它和标普最大的区别。"),
"750108": ("MSCI美国50", "MSCI USA 50", "MSCI 美国指数中市值最大的 50 只，超大盘集中，前十大权重过半。",
            "比标普 500 更集中，等于只买美国最大的 50 家。"),
"SBI": ("标普500信息科技", "S&P 500 Information Technology", "标普 500 里的软件、硬件与半导体，约 70 只，权重高度集中在英伟达、微软、苹果。",
         "和纳指 100 走势高度相似，但成分只取标普里的科技股。"),
"SP50035": ("标普500医疗保健等权", "S&P 500 Health Care Equal Weight", "标普 500 医疗股的等权版本，约 60 只。等权削弱了礼来、联合健康这些巨头，中小型器械与服务公司权重更高。",
             "规模已缩到 1.4 亿，且暂停申购，实际是“看得见买不到”。"),
"SPSIBI": ("标普生物科技精选", "S&P Biotechnology Select Industry", "标普全市场里的生物科技子行业，约 120 只等权，XBI 同门。中小市值创新药为主，单只权重小，波动极大。",
            "赌的是临床数据，不是估值。"),
"NBI": ("纳斯达克生物科技", "NASDAQ Biotechnology", "纳斯达克上市的生物科技与制药公司，市值加权。安进、吉利德、再生元等大市值公司主导，比 XBI 稳一些。",
         "同一赛道，XBI 偏小、NBI 偏大，波动差一个量级。"),
"SPCDSSI": ("标普美国品质消费", "S&P 500 Consumer Discretionary (IXY)", "标普 500 可选消费板块，亚马逊、特斯拉、家得宝等。名为消费，实际被电商和新能源车带出了科技属性。",
             "它和 A 股消费不是一个东西：这里是可选消费+平台经济。"),
"SP5CSSUP": ("标普500消费精选", "S&P 500 Consumer Select", "从标普 500 消费板块再精选，成分更集中，可选与必需消费龙头混合。",
              "2024 年才落地的场内品种，规模不到 10 亿。"),
"SPSIOP": ("标普油气上游", "S&P Oil & Gas E&P Select Industry", "标普全市场中的油气勘探与生产子行业，约 50—60 只等权，XOP 同门。纯上游，油价弹性直接。",
            "等权让中小页岩油公司也有存在感，波动比综合油企大。"),
"DJSOEP": ("道琼斯美国石油", "Dow Jones US Oil & Gas E&P", "道琼斯美国油气开发与生产指数，约 30 余只，比 SPSIOP 更集中在大市值综合油企。",
            "同一条油价逻辑，这只更偏大公司。"),
"SPG120035": ("标普全球1200医疗保健", "S&P Global 1200 Health Care", "23 个市场、约 1200 家大中盘里的医疗保健行业，成分 100 只上下。美股约七成，另有瑞士、英国、日本、丹麦的龙头。",
               "境内唯一一条“全球行业”指数基金，波动小于纯美股医药。"),
"SPGOGUP": ("标普全球石油", "S&P Global Oil", "全球石油天然气公司，含美欧亚的综合油企，比美股上游更偏大市值一体化。",
             "想买“全球油企”而不是“美国页岩”，看这条。"),
"IN0003": ("标普全球高端消费品", "S&P Global Luxury", "标普全球 BMI 中 80 家奢侈品与高端消费公司：LVMH、爱马仕、法拉利、欧莱雅、历峰。欧洲权重高，日元、欧元、美元都影响净值。",
            "境内唯一一条奢侈品指数，且是指数增强。"),
"N225": ("日经225", "Nikkei 225", "东京交易所 225 只，价格加权。工业、消费、科技为主，受日元汇率影响很大。",
          "价格加权 + 日元，是它和 TOPIX 的两处差别。"),
"TPX": ("东证TOPIX", "TOPIX", "东证 Prime 全市场市值加权，覆盖比日经 225 宽得多，金融与内需权重更高。",
         "想买“日本整体”而不是“225 只”，选这条。"),
"GDAXI": ("德国DAX", "DAX 40", "法兰克福 40 只大盘（2021 年从 30 扩到 40），工业、软件、保险、汽车。",
           "欧洲最像“制造业指数”的一条。"),
"FCHI": ("法国CAC40", "CAC 40", "巴黎 40 只：奢侈品、能源、金融、医药、工业。股息率长期高于多数发达市场。",
          "买法国等于买奢侈品+能源+银行三件事。"),
"FTSE": ("英国富时100", "FTSE 100", "伦敦 100 只，老经济为主：能源、金融、医药、消费。收入高度海外化，英镑计价。",
          "它更像“全球收入、英镑报价”的组合。"),
"FISAULMU": ("富时沙特阿拉伯", "FTSE Saudi Arabia", "沙特交易所大盘，阿美石油权重极高，本质是油价 + 沙特主权基金叙事。",
              "单一资源型市场，不是“海外分散”。"),
"BVSP": ("巴西IBOVESPA", "IBOVESPA", "巴西交易所约 80 余只，淡水河谷、巴西石油、银行占大头。资源 + 金融 + 本币三重波动。",
          "雷亚尔和铁矿石价格，比公司业绩更能决定人民币收益。"),
"ASIATECP": ("东南亚科技", "iEdge Pan-SEA Tech", "新加坡、印尼、越南、泰国、马来西亚的科技与互联网公司，Sea、Grab 等在列。",
              "区域科技篮子，不是单一国家。"),
"IMIT50": ("新兴亚洲50", "iEdge Emerging Asia Select 50", "印度、印尼、泰国、马来西亚等新兴亚洲的 50 只，区域篮子而非单一国家。",
            "2.6 亿的迷你产品，流动性和溢价都要留意。"),
"INDIA": ("印度市场", "CIS India ETP", "不是标准指数基金：工银印度是一只 FOF，穿透一篮子海外上市的印度 ETF，底层接近 MSCI 印度。费率比普通指数基金高。",
           "境内没有直接跟踪 MSCI 印度的被动产品，这是最接近的替代。"),
"VN30": ("越南VN30", "VN30", "胡志明交易所市值与流动性最好的 30 只，金融与地产占一半以上。天弘越南是主动选股，以 VN30 为业绩基准。",
          "境内唯一一只主要投越南的基金，但不是纯被动。"),
"DWRTF": ("道琼斯美国精选REIT", "Dow Jones US Select REIT", "美国约 100 只权益型 REIT，覆盖零售、工业、数据中心、住宅、医疗。",
           "唯一能在场内买的海外 REITs 品种。"),
"UNGL": ("富时发达市场REITs", "FTSE EPRA/NAREIT Developed", "发达市场 REIT，美国约七成，其余澳大利亚、日本、英国、法国、新加坡。",
          "比纯美国 REIT 多了一层地域分散。"),
"RMS": ("MSCI美国REIT", "MSCI US REIT", "覆盖美国约 99% 的 REIT 市值，市值加权，大盘 REIT 主导。",
         "和道琼斯那条高度重合，规模只有 1.3 亿。"),
"HSTECH": ("恒生科技", "Hang Seng TECH", "香港上市的 30 只最大科技公司：阿里、腾讯、美团、小米、比亚迪电子。中国资产、港元计价。",
            "它是港股，不是美股；波动来源是中国的政策与盈利。"),
"HSI": ("恒生指数", "Hang Seng Index", "香港蓝筹约 80 只，金融、地产、科技为主，是港股基准。",
         "比恒生科技稳，但长期跑输科技。"),
"HSCEI": ("恒生中国企业", "Hang Seng China Enterprises", "在港上市的中国内地企业（H 股、红筹、民企），旧称国企指数。",
           "和恒生指数最大的区别是“不含香港本地股”。"),
}

def build(ic):
    rs = [r for r in raw if r.get("idx_code") == ic and "联接" not in r["name"] and "连接" not in r["name"]]
    bykey = collections.defaultdict(list)
    for r in rs:
        bykey[(r["company"], clean(r["name"]))].append(r)
    funds = []
    for (co, nm), v in bykey.items():
        vals = []
        for x in sorted(v, key=lambda y: -f(y["endnav"])):
            val = f(x["endnav"])
            if val and not any(abs(val - y) / max(val, 1) < 0.01 for y in vals):
                vals.append(val)
        tot = sum(vals)
        if tot <= 0: continue
        rep = sorted(v, key=lambda m: (0 if "ETF" in m["name"] else (1 if "LOF" in m["name"] else 2)))[0]
        ch = "场内" if "ETF" in rep["name"] else ("LOF" if "LOF" in rep["name"] else "场外")
        sts = [m.get("status") or "" for m in v]
        st = "场内" if ch == "场内" else ("暂停" if "暂停申购" in sts and "限大额" not in sts else ("限大额" if "限大额" in sts else "开放"))
        codes = []
        for m in sorted(v, key=lambda y: y["code"]):
            if m["code"] not in codes: codes.append(m["code"])
        funds.append({"n": nm, "c": "/".join(codes[:2]), "s": round(tot / 1e8, 2), "st": st, "ch": ch})
    funds.sort(key=lambda x: -x["s"])
    return round(sum(x["s"] for x in funds), 1), funds

items = []
for ic, (cn, en, intro, note) in META.items():
    if ic == "INDIA":
        total, funds = 18.9, [{"n": "工银印度基金", "c": "164824", "s": 18.9, "st": "限大额", "ch": "LOF"}]
    elif ic == "VN30":
        total, funds = 36.3, [{"n": "天弘越南市场", "c": "008763/008764", "s": 36.3, "st": "限大额", "ch": "场外"}]
    else:
        total, funds = build(ic)
    items.append({"id": ic, "cn": cn, "en": en, "group": GROUP_IDS[ic],
                  "total": total, "n": len(funds), "intro": intro, "note": note,
                  "funds": funds})

order = [g[0] for g in GROUPS]
items.sort(key=lambda x: (order.index(x["group"]), -x["total"]))
data = {"asof": "2026-09-30", "groups": [{"id": g, "name": n, "desc": d} for g, n, d in GROUPS], "items": items}
out = "window.QDII_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
open(os.path.join(ROOT, "qdii-indices", "data.js"), "w", encoding="utf-8").write(out)

overseas = sum(i["total"] for i in items if i["group"] != "hk")
print("指数", len(items), "基金", sum(i["n"] for i in items))
print("合计", round(sum(i["total"] for i in items), 1), "亿；境外", round(overseas, 1), "亿；港股", round(sum(i["total"] for i in items if i["group"]=="hk"),1))
for i in items:
    print(f"{i['group']:7s} {i['total']:9.1f} {i['n']:3d} {i['cn']}")
