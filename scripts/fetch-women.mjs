// 抓取世界银行性别指标，生成 women/data.js 与 women/world.js。
// 用法：node scripts/fetch-women.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://api.worldbank.org/v2";
const FIRST_YEAR = 1997;
const LAST_YEAR = 2025;
const UA = { "User-Agent": "jillax-github-io/1.0 (personal data page)" };

// 60 国样本：G20 全部 19 国 + 各区域代表。
const COUNTRIES = [
  { iso3: "USA", zh: "美国", region: "北美" },
  { iso3: "CAN", zh: "加拿大", region: "北美" },
  { iso3: "ARG", zh: "阿根廷", region: "拉美" },
  { iso3: "BRA", zh: "巴西", region: "拉美" },
  { iso3: "MEX", zh: "墨西哥", region: "拉美" },
  { iso3: "CHL", zh: "智利", region: "拉美" },
  { iso3: "COL", zh: "哥伦比亚", region: "拉美" },
  { iso3: "PER", zh: "秘鲁", region: "拉美" },
  { iso3: "URY", zh: "乌拉圭", region: "拉美" },
  { iso3: "CRI", zh: "哥斯达黎加", region: "拉美" },
  { iso3: "DEU", zh: "德国", region: "欧洲与中亚" },
  { iso3: "FRA", zh: "法国", region: "欧洲与中亚" },
  { iso3: "ITA", zh: "意大利", region: "欧洲与中亚" },
  { iso3: "GBR", zh: "英国", region: "欧洲与中亚" },
  { iso3: "ESP", zh: "西班牙", region: "欧洲与中亚" },
  { iso3: "NLD", zh: "荷兰", region: "欧洲与中亚" },
  { iso3: "SWE", zh: "瑞典", region: "欧洲与中亚" },
  { iso3: "NOR", zh: "挪威", region: "欧洲与中亚" },
  { iso3: "DNK", zh: "丹麦", region: "欧洲与中亚" },
  { iso3: "FIN", zh: "芬兰", region: "欧洲与中亚" },
  { iso3: "CHE", zh: "瑞士", region: "欧洲与中亚" },
  { iso3: "POL", zh: "波兰", region: "欧洲与中亚" },
  { iso3: "CZE", zh: "捷克", region: "欧洲与中亚" },
  { iso3: "IRL", zh: "爱尔兰", region: "欧洲与中亚" },
  { iso3: "AUT", zh: "奥地利", region: "欧洲与中亚" },
  { iso3: "PRT", zh: "葡萄牙", region: "欧洲与中亚" },
  { iso3: "RUS", zh: "俄罗斯", region: "欧洲与中亚" },
  { iso3: "TUR", zh: "土耳其", region: "欧洲与中亚" },
  { iso3: "KAZ", zh: "哈萨克斯坦", region: "欧洲与中亚" },
  { iso3: "CHN", zh: "中国", region: "东亚与太平洋" },
  { iso3: "JPN", zh: "日本", region: "东亚与太平洋" },
  { iso3: "KOR", zh: "韩国", region: "东亚与太平洋" },
  { iso3: "IDN", zh: "印度尼西亚", region: "东亚与太平洋" },
  { iso3: "THA", zh: "泰国", region: "东亚与太平洋" },
  { iso3: "VNM", zh: "越南", region: "东亚与太平洋" },
  { iso3: "PHL", zh: "菲律宾", region: "东亚与太平洋" },
  { iso3: "MYS", zh: "马来西亚", region: "东亚与太平洋" },
  { iso3: "SGP", zh: "新加坡", region: "东亚与太平洋" },
  { iso3: "AUS", zh: "澳大利亚", region: "东亚与太平洋" },
  { iso3: "NZL", zh: "新西兰", region: "东亚与太平洋" },
  { iso3: "IND", zh: "印度", region: "南亚" },
  { iso3: "PAK", zh: "巴基斯坦", region: "南亚" },
  { iso3: "BGD", zh: "孟加拉国", region: "南亚" },
  { iso3: "LKA", zh: "斯里兰卡", region: "南亚" },
  { iso3: "NPL", zh: "尼泊尔", region: "南亚" },
  { iso3: "SAU", zh: "沙特阿拉伯", region: "中东与北非" },
  { iso3: "ARE", zh: "阿联酋", region: "中东与北非" },
  { iso3: "QAT", zh: "卡塔尔", region: "中东与北非" },
  { iso3: "EGY", zh: "埃及", region: "中东与北非" },
  { iso3: "IRN", zh: "伊朗", region: "中东与北非" },
  { iso3: "ISR", zh: "以色列", region: "中东与北非" },
  { iso3: "MAR", zh: "摩洛哥", region: "中东与北非" },
  { iso3: "ZAF", zh: "南非", region: "撒哈拉以南非洲" },
  { iso3: "NGA", zh: "尼日利亚", region: "撒哈拉以南非洲" },
  { iso3: "ETH", zh: "埃塞俄比亚", region: "撒哈拉以南非洲" },
  { iso3: "KEN", zh: "肯尼亚", region: "撒哈拉以南非洲" },
  { iso3: "GHA", zh: "加纳", region: "撒哈拉以南非洲" },
  { iso3: "TZA", zh: "坦桑尼亚", region: "撒哈拉以南非洲" },
  { iso3: "UGA", zh: "乌干达", region: "撒哈拉以南非洲" },
  { iso3: "SEN", zh: "塞内加尔", region: "撒哈拉以南非洲" },
];

// window 指取“最新值”时接受的年份下限；每个国家的实际年份可能不同，页面上逐条标出。
const INDICATORS = {
  "SE.ENR.TERT.FM.ZS": {
    zh: "高等教育性别平等指数", short: "高教 GPI", unit: "", decimals: 2,
    direction: "parity", window: [2015, LAST_YEAR],
    note: "女性毛入学率 ÷ 男性毛入学率。1.00 为持平，高于 1 表示女性多于男性。",
  },
  "SE.TER.ENRR.FE": {
    zh: "女性高等教育毛入学率", short: "女性高教入学", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
  },
  "SE.SEC.ENRR.FE": {
    zh: "女性中等教育毛入学率", short: "女性中学入学", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
  },
  "SE.ADT.LITR.FE.ZS": {
    zh: "女性成人识字率", short: "女性识字率", unit: "%", decimals: 1,
    direction: "higher", window: [2005, LAST_YEAR], sparse: true,
    note: "识字率调查间隔长，多数国家的最新值停在 2010 年代；60 国样本中只有约三分之二有数据。",
  },
  "SL.TLF.ACTI.FE.ZS": {
    zh: "女性劳动参与率（15–64 岁）", short: "女性劳动参与", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
    note: "国际劳工组织模型估计，不是各国自己的登记数。",
  },
  "SL.TLF.ACTI.MA.ZS": {
    zh: "男性劳动参与率（15–64 岁）", short: "男性劳动参与", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
  },
  "SL.EMP.SMGT.FE.ZS": {
    zh: "女性在高级与中层管理岗位中的占比", short: "女性管理岗", unit: "%", decimals: 1,
    direction: "higher", window: [2010, LAST_YEAR],
    note: "占全部高级与中层管理岗位的比例，不是女性就业者中的比例。",
  },
  "FX.OWN.TOTL.FE.ZS": {
    zh: "女性银行或移动支付账户持有率", short: "女性账户", unit: "%", decimals: 1,
    direction: "higher", window: [2014, LAST_YEAR],
    note: "15 岁以上。来自全球金融普惠调查，各国调查年份不同。",
  },
  "FX.OWN.TOTL.MA.ZS": {
    zh: "男性银行或移动支付账户持有率", short: "男性账户", unit: "%", decimals: 1,
    direction: "higher", window: [2014, LAST_YEAR],
  },
  "SL.UEM.TOTL.FE.ZS": {
    zh: "女性失业率", short: "女性失业率", unit: "%", decimals: 1,
    direction: "lower", window: [2015, LAST_YEAR],
  },
  "SG.GEN.PARL.ZS": {
    zh: "国民议会中女性席位占比", short: "议会女性席位", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
    note: "各国议会联盟口径，按议席而非人口计算。",
  },
  "SG.GEN.MNST.ZS": {
    zh: "部长级职位中女性占比", short: "女性部长", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
    note: "部长级职位定义各国不完全一致，且政府改组会带来跳变。",
  },
  "SP.DYN.LE00.FE.IN": {
    zh: "女性出生时预期寿命", short: "女性预期寿命", unit: "岁", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
  },
  "SH.STA.MMRT": {
    zh: "孕产妇死亡率", short: "孕产妇死亡", unit: "/10 万活产", decimals: 0,
    direction: "lower", window: [2015, LAST_YEAR],
    note: "联合国机构联合模型估计，不是各国报告的登记数。",
  },
  "SP.ADO.TFRT": {
    zh: "青少年生育率", short: "青少年生育", unit: "/1000 名 15–19 岁女性", decimals: 1,
    direction: "lower", window: [2015, LAST_YEAR],
  },
  "SP.M18.2024.FE.ZS": {
    zh: "20–24 岁女性中 18 岁前结婚的比例", short: "18 岁前结婚", unit: "%", decimals: 1,
    direction: "lower", window: [2005, LAST_YEAR], sparse: true,
    note: "来自住户调查，只有部分国家有可比数据。",
  },
  "SG.VAW.1549.ZS": {
    zh: "过去 12 个月遭受伴侣暴力的女性比例（15–49 岁）", short: "伴侣暴力", unit: "%", decimals: 1,
    direction: "lower", window: [2005, LAST_YEAR], sparse: true,
    note: "调查口径与年份差异很大，只能读量级，不能精确排名。",
  },
  "IT.NET.USER.FE.ZS": {
    zh: "女性互联网使用率", short: "女性上网率", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
    note: "国际电信联盟估计，指最近三个月使用过互联网的人口比例。",
  },
  "IT.NET.USER.MA.ZS": {
    zh: "男性互联网使用率", short: "男性上网率", unit: "%", decimals: 1,
    direction: "higher", window: [2015, LAST_YEAR],
  },
  // 背景指标：不参与性别排名，只用于气泡大小、国家卡片和读法说明。
  "SP.POP.TOTL": {
    zh: "人口总数", short: "人口", unit: "人", decimals: 0, context: true, window: [2015, LAST_YEAR],
  },
  "NY.GDP.PCAP.PP.CD": {
    zh: "人均 GDP（购买力平价，国际元）", short: "人均 GDP（PPP）", unit: "国际元", decimals: 0,
    context: true, window: [2015, LAST_YEAR],
  },
};

const SAMPLE = new Set(COUNTRIES.map((c) => c.iso3));
const MALE_PAIR = {
  "SL.TLF.ACTI.FE.ZS": "SL.TLF.ACTI.MA.ZS",
  "FX.OWN.TOTL.FE.ZS": "FX.OWN.TOTL.MA.ZS",
  "IT.NET.USER.FE.ZS": "IT.NET.USER.MA.ZS",
};

function round(v, d) {
  const p = 10 ** d;
  return Math.round(v * p) / p;
}

async function fetchIndicator(id) {
  let page = 1;
  let pages = 1;
  let lastUpdated = null;
  const rows = [];
  do {
    const url = `${API}/country/all/indicator/${id}?format=json&per_page=20000&date=${FIRST_YEAR}:${LAST_YEAR}&page=${page}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${id} HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json) || !Array.isArray(json[1])) {
      throw new Error(`${id} 返回异常: ${JSON.stringify(json).slice(0, 200)}`);
    }
    lastUpdated = json[0].lastupdated || lastUpdated;
    pages = json[0].pages;
    rows.push(...json[1]);
    page += 1;
  } while (page <= pages);
  return { rows, lastUpdated };
}

function latestWithin(series, window) {
  if (!series || !series.length) return null;
  const [lo, hi] = window;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const [y] = series[i];
    if (y <= hi && y >= lo) return series[i];
  }
  return null;
}

async function buildData() {
  const series = {};
  for (const c of COUNTRIES) series[c.iso3] = {};
  const world = {};
  let lastUpdated = null;

  for (const id of Object.keys(INDICATORS)) {
    process.stdout.write(`取数 ${id} … `);
    const { rows, lastUpdated: lu } = await fetchIndicator(id);
    if (lu && (!lastUpdated || lu > lastUpdated)) lastUpdated = lu;
    let n = 0;
    for (const row of rows) {
      if (row.value == null) continue;
      const iso3 = row.countryiso3code;
      const year = Number(row.date);
      const value = round(Number(row.value), INDICATORS[id].decimals);
      if (!Number.isFinite(value) || !Number.isFinite(year)) continue;
      if (iso3 === "WLD") {
        (world[id] ||= []).push([year, value]);
      } else if (SAMPLE.has(iso3)) {
        (series[iso3][id] ||= []).push([year, value]);
        n += 1;
      }
    }
    for (const arr of Object.values(world)) arr.sort((a, b) => a[0] - b[0]);
    for (const c of Object.values(series)) {
      for (const arr of Object.values(c)) arr.sort((a, b) => a[0] - b[0]);
    }
    console.log(`${n} 个数据点`);
  }

  const report = [];
  for (const id of Object.keys(INDICATORS)) {
    let covered = 0;
    const missing = [];
    for (const c of COUNTRIES) {
      if (latestWithin(series[c.iso3][id], INDICATORS[id].window)) covered += 1;
      else missing.push(c.zh);
    }
    const pct = ((covered / COUNTRIES.length) * 100).toFixed(0);
    report.push(`${id.padEnd(22)} ${String(covered).padStart(2)}/${COUNTRIES.length} (${pct}%)${missing.length ? "  缺：" + missing.join("、") : ""}`);
    if (!MALE_PAIR[id] && !INDICATORS[id].sparse && !INDICATORS[id].context && covered < 50) {
      throw new Error(`覆盖率过低：${id} 只有 ${covered}/${COUNTRIES.length}`);
    }
    const mustHave = {
      "SG.GEN.PARL.ZS": 56,
      "SL.TLF.ACTI.FE.ZS": 56,
      "SE.ENR.TERT.FM.ZS": 56,
      "SH.STA.MMRT": 56,
      "IT.NET.USER.FE.ZS": 50,
    };
    if (mustHave[id] && covered < mustHave[id]) {
      throw new Error(`核心指标缺得太多：${id} 只有 ${covered}/${COUNTRIES.length}`);
    }
  }
  console.log("\n覆盖率（按最新可得年份）：\n" + report.join("\n"));

  for (const c of COUNTRIES) {
    const n = Object.keys(series[c.iso3]).filter((id) => series[c.iso3][id].length).length;
    if (n < 10) throw new Error(`${c.zh} 只有 ${n} 个指标有数据`);
  }

  return {
    generated: new Date().toISOString().slice(0, 10),
    lastUpdated,
    source: "World Bank, World Development Indicators / Gender Data Portal",
    api: "https://api.worldbank.org/v2",
    years: [FIRST_YEAR, LAST_YEAR],
    countries: COUNTRIES,
    indicators: INDICATORS,
    malePair: MALE_PAIR,
    series,
    world,
  };
}

// ---------- 世界地图：TopoJSON → Equal Earth 预投影 SVG 路径 ----------
const MAP_WIDTH = 1000;
const MAP_PAD = 6;

function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function ringFromArcs(indices, arcs) {
  const ring = [];
  for (const idx of indices) {
    const arc = idx < 0 ? arcs[~idx].slice().reverse() : arcs[idx];
    for (let i = ring.length ? 1 : 0; i < arc.length; i += 1) ring.push(arc[i]);
  }
  return ring;
}

// 110m 分辨率里没有轮廓的城市国家，用质心打点表示。[纬度, 经度]
const CENTERS = { SGP: [1.3521, 103.8198] };

// Equal Earth 投影
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function project(lon, lat) {
  const lam = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin(phi));
  const t2 = theta * theta;
  const t4 = t2 * t2;
  const t6 = t4 * t2;
  const t8 = t6 * t2;
  const x = (2 * Math.sqrt(3) * lam * Math.cos(theta)) / (3 * (9 * A4 * t8 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
  const y = theta * (A1 + A2 * t2 + A3 * t4 + A4 * t6);
  return [x, y];
}

function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.arcs];
  if (geometry.type === "MultiPolygon") return geometry.arcs;
  return [];
}

// 跨 180° 经线的环（俄罗斯远东、斐济）拆成两段，避免投影后画出一条横贯全图的线。
function splitRing(ring) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < ring.length; i += 1) {
    cur.push(ring[i]);
    const next = ring[(i + 1) % ring.length];
    if (Math.abs(next[1] - ring[i][1]) > 180) {
      if (cur.length >= 3) parts.push(cur);
      cur = [ring[i]];
    }
  }
  if (cur.length >= 3) parts.push(cur);
  return parts;
}

async function getJson(url, cachePath) {
  if (cachePath && existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const json = await res.json();
  if (cachePath) {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(json));
  }
  return json;
}

async function buildMap() {
  const cacheDir = "tmp/wb";
  const topo = await getJson(
    "https://unpkg.com/world-atlas@2/countries-110m.json",
    `${cacheDir}/world110.json`,
  );
  const codes = await getJson(
    "https://unpkg.com/i18n-iso-countries@7.11.0/codes.json",
    `${cacheDir}/iso-codes.json`,
  );
  const numericToAlpha3 = new Map();
  for (const [alpha2, alpha3, numeric] of codes) {
    if (alpha2 && alpha3 && numeric) numericToAlpha3.set(String(numeric).padStart(3, "0"), alpha3);
  }

  const arcs = decodeArcs(topo);
  const geometries = topo.objects.countries.geometries;
  const shapes = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const geom of geometries) {
    const iso3 = numericToAlpha3.get(String(geom.id).padStart(3, "0")) || null;
    for (const poly of polygonsOf(geom)) {
      for (const ringIdx of poly) {
        const ring = ringFromArcs(ringIdx, arcs);
        if (ring.length < 3) continue;
        for (const part of splitRing(ring)) {
          const pts = part.map(([lon, lat]) => project(lon, lat));
          for (const [x, y] of pts) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          shapes.push({ iso3, name: geom.properties?.name || "", pts });
        }
      }
    }
  }

  const scale = (MAP_WIDTH - MAP_PAD * 2) / (maxX - minX);
  const height = Math.round((maxY - minY) * scale + MAP_PAD * 2);
  const fx = (x) => (x - minX) * scale + MAP_PAD;
  const fy = (y) => (maxY - y) * scale + MAP_PAD;

  const countries = {};
  const other = [];
  for (const { iso3, pts } of shapes) {
    const d = pts
      .map(([x, y], i) => `${i ? "L" : "M"}${fx(x).toFixed(1)} ${fy(y).toFixed(1)}`)
      .join("") + "Z";
    if (iso3) countries[iso3] = (countries[iso3] || "") + d;
    else other.push(d);
  }

  const dots = {};
  const missing = [];
  for (const c of COUNTRIES) {
    if (countries[c.iso3]) continue;
    const center = CENTERS[c.iso3];
    if (!center) {
      missing.push(c.zh);
      continue;
    }
    const [px, py] = project(center[1], center[0]);
    dots[c.iso3] = [Number(fx(px).toFixed(1)), Number(fy(py).toFixed(1))];
  }
  if (missing.length) throw new Error(`地图缺少国家路径：${missing.join("、")}`);

  return { width: MAP_WIDTH, height, countries, other, dots, projection: "Equal Earth" };
}

async function main() {
  const only = process.argv.slice(2);
  const skipData = only.includes("--map-only");
  const skipMap = only.includes("--data-only");
  mkdirSync("women", { recursive: true });

  if (!skipData) {
    const data = await buildData();
    writeFileSync("women/data.js", `window.WOMEN_DATA=${JSON.stringify(data)};\n`);
    console.log(`\n写入 women/data.js（${(readFileSync("women/data.js").length / 1024).toFixed(0)} KB）`);
  }

  if (!skipMap) {
    const map = await buildMap();
    writeFileSync("women/world.js", `window.WOMEN_MAP=${JSON.stringify(map)};\n`);
    console.log(`写入 women/world.js（${(readFileSync("women/world.js").length / 1024).toFixed(0)} KB，${Object.keys(map.countries).length} 个国家/地区，${Object.keys(map.dots).length} 个点标国家）`);
  }

  const size = ["women/data.js", "women/world.js"]
    .filter(existsSync)
    .reduce((sum, f) => sum + readFileSync(f).length, 0) / 1024;
  console.log(`数据文件合计 ${size.toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
