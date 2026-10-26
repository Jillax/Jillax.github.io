// 各校本科招生网「历年分数」抓取，产出 scripts/data/gaokao/site/<校名>.json
// 用法：
//   node scripts/fetch_gaokao_site.mjs                 // 抓全部已配置院校
//   node scripts/fetch_gaokao_site.mjs 华东师范大学     // 只抓一所
//   node scripts/fetch_gaokao_site.mjs --probe <host> <code>   // 只列该正方平台院校的可选维度
//
// 说明：山东新高考的「位次」由一分一段表定义，官网只给最低分时，按一分一段表换算
// 得到的位次与考试院投档位次等价，不是近似。换算用的表直接读线上产物 gaokao/data/meta.js。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "scripts", "data", "gaokao", "site");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const BANDS = loadBands();
const YEARS = [2022, 2023, 2024, 2025, 2026];

function loadBands() {
  const src = fs.readFileSync(path.join(ROOT, "gaokao", "data", "meta.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  const out = {};
  Object.keys(win.GAOKAO_META.bands).forEach((y) => {
    const m = new Map();
    win.GAOKAO_META.bands[y].forEach((p) => m.set(Number(p[0]), Number(p[1])));
    out[y] = m;
  });
  return out;
}

// 分数 → 一分一段位次；表里没有该分（如低于末段）时返回 null，不做外推。
function rankOf(year, score) {
  const m = BANDS[String(year)];
  if (!m || score == null) return null;
  return m.get(Math.round(Number(score))) ?? null;
}

/* ---------------- 正方 / 青果「历年分数查询」平台 ---------------- */
// 页面 static/front/<code>/basic/html_web/lnfs.html；接口在 /f/ 下，
// 需要 cookie + X-Requested-Time + Csrf-Token（每次请求消耗一枚，响应头回传下一枚）。
class Zhengfang {
  constructor(name, host, code) {
    this.name = name;
    this.base = `https://${host}`;
    this.page = `${this.base}/static/front/${code}/basic/html_web/lnfs.html`;
    this.jar = new Map();
  }
  save(res) {
    (typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []).forEach((c) => {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      if (i > 0) this.jar.set(kv.slice(0, i), kv.slice(i + 1));
    });
  }
  async boot() {
    const r = await fetch(this.page, { headers: { "User-Agent": UA } });
    this.save(r);
    await r.text();
    if (!r.ok) throw new Error(`${this.name} 页面 http ${r.status}`);
  }
  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hdr(extra) {
    const h = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": UA,
      Origin: this.base,
      Referer: this.page,
      "X-Requested-With": "XMLHttpRequest",
      // 时间戳按「每次发送那一刻」算，服务端会校验时效，早算一秒都可能被判过期
      "X-Requested-Time": String(Date.now()),
    };
    const ck = this.cookieHeader();
    if (ck) h.cookie = ck;
    return Object.assign(h, extra || {});
  }
  async fresh() {
    const r = await fetch(`${this.base}/f/ajax_get_csrfToken?ts=${Date.now()}`, {
      method: "POST",
      headers: this.hdr({ "Content-Type": "application/x-www-form-urlencoded" }),
      body: "n=1",
    });
    this.save(r);
    const t = await r.text();
    let j;
    try {
      j = JSON.parse(t);
    } catch (e) {
      throw new Error(`${this.name} 取 token → http ${r.status} 非 JSON：${t.slice(0, 160)}`);
    }
    if (!j.data) throw new Error(`${this.name} 取 token 失败：${t.slice(0, 160)}`);
    return j.data.split(",")[0];
  }
  // 每次请求现取一枚 token：平台会让上一批失效，攒着复用会被判过期
  async post(p, form) {
    const body = new URLSearchParams(form || {}).toString();
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${this.base}${p}?ts=${Date.now()}`, {
        method: "POST",
        headers: this.hdr({ "Csrf-Token": await this.fresh() }),
        body,
      });
      this.save(res);
      const text = await res.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch (e) {
        throw new Error(`${this.name} ${p} → http ${res.status} 非 JSON：${text.slice(0, 160)}`);
      }
      if (j.state === 1) return j.data;
      const msg = j.msg || JSON.stringify(j).slice(0, 160);
      if (/token/i.test(msg) && attempt < 2) continue;
      throw new Error(`${this.name} ${p} → ${msg}`);
    }
  }
  // 维度表是 [{ "省份_年份_科类[_专业组]_性别_校区": [类型...] }]
  // 用不用专业组的学校串长不一样（6 段 / 5 段），所以从两端定位，不按下标硬数。
  async dims() {
    const d = await this.post("/f/ajax_lnfs_param", {});
    const key = Object.keys(d).find((k) => k.endsWith("_list"));
    const map = new Map();
    (d[key] || []).forEach((row) => {
      Object.keys(row).forEach((combo) => {
        const p = combo.split("_");
        let zyz = p.slice(3, p.length - 2).join("_");
        if (zyz === "zyz") zyz = "";
        map.set(combo, { ssmc: p[0], zsnf: p[1], klmc: p[2], zyz, zslx: row[combo] });
      });
    });
    return map;
  }
}

// 只认师范类招生。部属师大把「公费师范」写在专业名里（历史学（公费师范）），省属把它写在
// 招生类型里（山东省属地方公费师范生），所以两处都要认。
// 高校专项、地方专项、综合评价、定向西藏等虽也在提前批或特殊类型批，但报名资格另有一套，
// 位次和综合类不可比；艺体类的「位次」是专业+文化综合分序，同样不能与综合类并列做冲稳保。
const TEACH = /公费师范|优师|马院|委培师范|师范类/;

async function fetchZhengfang(school) {
  const zf = new Zhengfang(school.name, school.host, school.code);
  await zf.boot();
  const dims = await zf.dims();
  const records = [];
  const typesSeen = new Set();
  for (const [combo, d] of dims) {
    if (d.ssmc !== "山东") continue;
    if (d.klmc !== "综合改革") continue;
    if (!YEARS.includes(Number(d.zsnf))) continue;
    const want = d.zslx.filter((t) => TEACH.test(t) || /提前批/.test(t));
    if (!want.length) continue;
    for (const zslx of want) {
      typesSeen.add(`${d.zsnf} ${d.klmc} ${zslx}`);
      const data = await zf.post("/f/ajax_lnfs", {
        ssmc: "山东",
        zsnf: d.zsnf,
        klmc: d.klmc,
        zslx,
        zyz: d.zyz,
        sex: "",
        campus: "",
      });
      const majors = (data.sszygradeList || []).concat(data.sszyzgradeList || []);
      const schoolRow = (data.zsSsgradeList || [])[0] || null;
      if (!majors.length && !schoolRow) {
        console.log(`  ${d.zsnf} ${zslx}：无数据`);
        continue;
      }
      majors.forEach((m) => {
        const nm = clean(m.zymc);
        if (!TEACH.test(nm) && !TEACH.test(zslx)) return; // 提前批里非师范的专业不取
        const min = num(m.minScore);
        records.push({
          y: Number(m.nf || d.zsnf),
          major: nm,
          type: zslx,
          batch: "", // 正方平台的「类型」已含批次信息，不再重复标注
          campus: clean(m.campus) || "",
          min,
          minRank: num(m.minOrder) ?? num(m.minRank) ?? rankOf(m.nf || d.zsnf, min),
          plan: null,
          adm: num(m.rs),
          avg: num(m.avgScore),
          max: num(m.maxScore),
          xk: clean(m.zyzname) || "",
        });
      });
      if (!majors.length && schoolRow) {
        const min = num(schoolRow.minScore);
        records.push({
          y: Number(schoolRow.nf || d.zsnf),
          major: `${zslx}（院校最低）`,
          type: zslx,
          batch: "",
          campus: "",
          min,
          minRank: num(schoolRow.minOrder) ?? num(schoolRow.minRank) ?? rankOf(schoolRow.nf, min),
          plan: null,
          adm: num(schoolRow.rs),
          avg: num(schoolRow.avgScore),
          max: num(schoolRow.maxScore),
          xk: "",
        });
      }
    }
  }
  console.log(`  类型：${[...typesSeen].sort().join("；") || "无"}`);
  return records;
}

/* ---------------- 东北师范大学自建系统 ---------------- */
// POST /api/user/queryScore，匿名，专业级直接给 min_rank。
async function fetchNenu(school) {
  const H = {
    "Content-Type": "application/json; charset=UTF-8",
    "User-Agent": UA,
    Referer: "https://gkcx.nenu.edu.cn/history_score",
  };
  const records = [];
  const typesSeen = [];
  for (const y of YEARS) {
    for (const t of school.types) {
      const res = await fetch("https://gkcx.nenu.edu.cn/api/user/queryScore", {
        method: "POST",
        headers: H,
        body: JSON.stringify({ province: "山东", year: String(y), major_type: "综合改革", type: t }),
      });
      const j = await res.json();
      if (!j.scores || !j.scores.length) continue;
      typesSeen.push(`${y} ${t}`);
      j.scores.forEach((s) => {
        const min = num(s.min_admission_score);
        records.push({
          y,
          major: clean(s.major),
          type: t,
          batch: school.batch,
          campus: "",
          min,
          minRank: num(s.min_rank) ?? rankOf(y, min),
          plan: null,
          adm: null,
          avg: num(s.avg_admission_score),
          max: num(s.max_admission_score),
          xk: "",
        });
      });
    }
  }
  console.log(`  类型：${typesSeen.join("；") || "无"}`);
  return records;
}

/* ---------------- 华中师范大学：普通表单 POST，服务端渲染表格 ---------------- */
// http://zsxt.ccnu.edu.cn/apply/index.php?g=apply&m=index&a=admit
// 字段 year + pro 必填；表头逐年会变（2022—2024 是「最高/最低/平均分」，2025 起才有「对应省排名」），
// 所以一律按表头文字取列，不按下标。
async function fetchCcnu(school) {
  const headers = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: school.srcUrl,
  };
  const records = [];
  const typesSeen = new Set();
  for (const y of YEARS) {
    const res = await fetch(school.srcUrl, {
      method: "POST",
      headers,
      body: new URLSearchParams({ year: String(y), pro: "山东", ici: "", subj: "" }).toString(),
    });
    const html = await res.text();
    const tb = (html.match(/<table[\s\S]*?<\/table>/g) || [])[0];
    if (!tb) {
      console.log(`  ${y}：无表格（http ${res.status}）`);
      continue;
    }
    const rows = [...tb.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) =>
      [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) =>
        c[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      )
    );
    const head = rows[0] || [];
    const col = (re) => head.findIndex((h) => re.test(h));
    const iBatch = col(/批次/), iKl = col(/科类/);
    // 「批次/专业组」也含「专业」二字，必须整格精确匹配才能拿到真正的专业列
    const iMajor = col(/^专业$/);
    const iMin = col(/最低分/), iMax = col(/最高分/), iAvg = col(/平均分/), iRank = col(/排名|位次/);
    if (iMajor < 0 || iMin < 0) {
      console.log(`  ${y}：表头认不出 ${JSON.stringify(head)}`);
      continue;
    }
    let kept = 0;
    rows.slice(1).forEach((c) => {
      if (c.length < 5) return;
      if (c[iKl] && c[iKl] !== "综合改革") return;
      const batch = c[iBatch] || "";
      const major = clean(c[iMajor]);
      if (!/提前批|公费师范/.test(batch)) return;
      // 「提前批」里也有非师范专业（如外国语言文学类），批次或专业至少一处点明公费师范
      if (!/公费师范|优师|马院/.test(batch + major)) return;
      const min = num(c[iMin]);
      const rank = iRank >= 0 ? num(c[iRank]) : null;
      // 该校「批次」列的写法每年改名（提前批 / 提前批--公费师范 / 公费师范 / 提前批公费师范），
      // 而页面按「专业+类型+校区」合并五年，所以类型要归一，年度原文放进批次列留着显示；
      // 专业名里的「（公费师范）」与类型重复，且只有部分年份带，去掉才能跨年对齐。
      const type = /优师/.test(batch + major) ? "优师专项"
        : /马院|马克思主义理论/.test(batch + major) ? "重点马院" : "公费师范";
      records.push({
        y,
        major: major.replace(/[（(](公费师范|优师专项)[)）]$/, ""),
        type,
        batch: clean(batch),
        campus: "",
        min,
        minRank: rank ?? rankOf(y, min),
        plan: null,
        adm: null,
        avg: iAvg >= 0 ? num(c[iAvg]) : null,
        max: iMax >= 0 ? num(c[iMax]) : null,
        xk: "",
      });
      kept++;
    });
    if (kept) typesSeen.add(`${y} ${[...new Set(records.filter((r) => r.y === y).map((r) => r.batch))].join("/")}`);
  }
  console.log(`  类型：${[...typesSeen].sort().join("；") || "无"}`);
  return records;
}

/* ---------------- 临沂大学：LindaZhaoSheng 单页应用的录取分数汇总接口 ---------------- */
// 页面 zhaosheng.lyu.edu.cn/xxcx/list.htm 内嵌 front-views/index.html#/old-score；
// 接口一次返回全部分省记录，无位次/平均分/人数字段，位次由一分一段换算。
// 官网科类字段对山东综合改革：2025 及以前标「普通类」，2026 起标「综合改革」。
async function fetchLyu(school) {
  const api = school.api;
  const body = new URLSearchParams({
    page: "1",
    limit: "2000",
    "param.adjcProvince": "山东",
    "param.adjcMajName": "",
    "param.adjcYear": "",
    orderItem: "adjc_year",
    orderType: "desc",
  }).toString();
  const res = await fetch(api, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Referer: school.srcUrl,
    },
    body,
  });
  const j = await res.json();
  if (!j.success) throw new Error(`接口未成功：${j.failReason || res.status}`);
  const records = [];
  const typesSeen = new Set();
  (j.root || []).forEach((x) => {
    const y = Number(x.adjcYear);
    if (!YEARS.includes(y)) return;
    if (x.adjcLevel !== "本科") return;
    if (x.adjcStream !== "普通类" && x.adjcStream !== "综合改革") return;
    const nm = clean(x.adjcMajName);
    if (!/省属公费师范生|委培|公费师范生|优师/.test(nm)) return;
    // 该校 2024 年把「体育教育（省属公费师范生）」也标成普通类，给出的 651 分是体育综合分，
    // 与综合改革一分一段不在同一尺度；艺体类专业一律按专业名挡掉。
    if (/体育|音乐|美术|舞蹈|播音|书法|表演|艺术/.test(nm)) return;
    records.push({
      y,
      major: nm,
      type: "省属公费师范生",
      batch: "",
      campus: "",
      min: num(x.adjcMinScore),
      minRank: rankOf(y, x.adjcMinScore),
      plan: null,
      adm: null,
      avg: null,
      max: num(x.adjcMaxScore),
      xk: "",
    });
  });
  records.forEach((r) => typesSeen.add(`${r.y}`));
  console.log(`  科类：普通类/综合改革；年份：${[...typesSeen].sort().join(",")}`);
  return records;
}

/* ---------------- 济南大学：统计子站，每年一页、一页一个数据文件 ---------------- */
// http://map.adm.ujn.edu.cn/<年>zstj/ 页面里 <script src> 指向 gfsfs_data*.js（文件名带版本时间戳，
// 同名不带时间戳的那份是旧文件，页面并不引用它）。数据结构 {专业: [[定向市, 最高分, 最低分], …]}，
// 只有分数、没有位次/人数/平均分。
async function fetchUjn(school) {
  const records = [];
  const typesSeen = new Set();
  for (const y of YEARS) {
    const dir = `${school.base}${y}zstj/`;
    const res = await fetch(dir, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      console.log(`  ${y}：无统计页（http ${res.status}）`);
      continue;
    }
    const html = await res.text();
    const files = [...new Set((html.match(/gfsfs_data[^"'()\s]*\.js/g) || []))];
    if (!files.length) {
      console.log(`  ${y}：页面未引用 gfsfs 数据文件`);
      continue;
    }
    const seen = new Set();
    let kept = 0;
    for (const f of files) {
      const t = await (await fetch(dir + f, { signal: AbortSignal.timeout(30000) })).text();
      const s = t.indexOf("{");
      const e = t.lastIndexOf("}");
      if (s < 0 || e < s) continue;
      const data = JSON.parse(t.slice(s, e + 1));
      Object.keys(data).forEach((maj) => {
        data[maj].forEach((row) => {
          const [city, max, min] = row;
          const key = `${maj}|${city}|${min}`;
          if (seen.has(key)) return; // 同页重复行（如济南市出现两次且同值）
          seen.add(key);
          records.push({
            y,
            major: `${clean(maj)}（面向${clean(city)}就业）`,
            type: "山东省属公费师范生",
            batch: "",
            campus: "",
            min: num(min),
            minRank: rankOf(y, min),
            plan: null,
            adm: null,
            avg: null,
            max: num(max),
            xk: "",
          });
          kept++;
        });
      });
    }
    if (kept) typesSeen.add(`${y} ${kept}条/${files.length}个数据文件`);
  }
  console.log(`  取数：${[...typesSeen].sort().join("；") || "无"}`);
  return records;
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clean(s) {
  return String(s == null ? "" : s)
    .replace(/\s+/g, "")
    .replace(/[“”]/g, "");
}

/* ---------------- 入口 ---------------- */
const SCHOOLS = [
  {
    name: "东北师范大学",
    adapter: "nenu",
    batch: "本科提前批",
    src: "东北师范大学本科招生网·历年分数查询",
    srcUrl: "https://gkcx.nenu.edu.cn/history_score",
    types: ["一般计划（公费师范）", "优师专项计划"],
    note:
      "教育部直属师范大学公费师范生，山东在提前批录取。官网逐年逐专业公布录取最低分与最低位次，位次为官网原值。山东未见优师专项计划投放记录。",
  },
  {
    name: "华东师范大学",
    adapter: "zf",
    host: "zsbcx.ecnu.edu.cn",
    code: "ecnu",
    batch: "本科提前批",
    src: "华东师范大学本科招生网·历年分数查询",
    srcUrl: "https://zsbcx.ecnu.edu.cn/static/front/ecnu/basic/html_web/lnfs.html",
    note:
      "教育部直属师范大学公费师范生，山东在普通类提前批录取。官网逐专业只给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算（与考试院投档位次等价）。",
  },
  {
    name: "山东师范大学",
    adapter: "zf",
    host: "bkzs.sdnu.edu.cn",
    code: "sdnu",
    src: "山东师范大学本科招生网·历年分数查询",
    srcUrl: "https://bkzs.sdnu.edu.cn/static/front/sdnu/basic/html_web/lnfs.html",
    note:
      "山东省属公费师范生（含市级委托培养师范生）。官网逐专业给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算。省属公费师范按「专业+定向就业市」分列招生，官网分数库若已按专业汇总则此处即为该专业全校最低。",
  },
  {
    name: "曲阜师范大学",
    adapter: "zf",
    host: "zsb.qfnu.edu.cn",
    code: "qfnu",
    src: "曲阜师范大学本科招生网·历年分数查询",
    srcUrl: "https://zsb.qfnu.edu.cn/static/front/qfnu/basic/html_web/lnfs.html",
    note:
      "山东省属公费师范生（含委培师范生）。官网逐专业给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算。",
  },
  {
    name: "青岛大学",
    adapter: "zf",
    host: "zhaosheng.qdu.edu.cn",
    code: "qdu",
    src: "青岛大学本科招生网·历年分数查询",
    srcUrl: "https://zhaosheng.qdu.edu.cn/static/front/qdu/basic/html_web/lnfs.html",
    note:
      "山东省属公费师范生。官网逐专业给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算。2022 年另有一类「师范类（青岛招生）」已收录；2023 年起该校改称「面向青岛招生」，名称里不再带「师范」，无法确认与前者是否同一定向师范项目，故未取。",
  },
  {
    name: "聊城大学",
    adapter: "zf",
    host: "zsc.lcu.edu.cn",
    code: "lcu",
    src: "聊城大学本科招生网·历年分数查询",
    srcUrl: "https://zsc.lcu.edu.cn/static/front/lcu/basic/html_web/lnfs.html",
    note:
      "山东省属公费师范生（含市属委培师范生）。官网逐专业给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算。体育类、艺术类公费师范不在本页——它们的「位次」按综合分排序，与综合改革位次不可比。",
  },
  {
    name: "鲁东大学",
    adapter: "zf",
    host: "zscx.ldu.edu.cn",
    code: "ldu",
    src: "鲁东大学本科招生网·历年分数查询",
    srcUrl: "https://zscx.ldu.edu.cn/static/front/ldu/basic/html_web/lnfs.html",
    note:
      "山东省属公费师范生（2022 年另有市属委培师范生）。官网逐专业给录取最高/最低/平均分与录取人数，位次按山东一分一段表由最低分换算。公费农科生不在师范口径内，未取；2026 年综合改革科类尚未公布公费师范生投档数据。",
  },
  {
    name: "华中师范大学",
    adapter: "ccnu",
    src: "华中师范大学招生信息系统·普通类分专业录取",
    srcUrl: "http://zsxt.ccnu.edu.cn/apply/index.php?g=apply&m=index&a=admit",
    note:
      "教育部直属师范大学公费师范生。官网自 2025 年起在表内给出「对应省排名」，2022—2024 年只有最高/最低/平均分，位次由山东一分一段表换算。同校「提前批」里的非师范专业（如外国语言文学类）不在本页口径内，未取。",
  },
  {
    name: "济南大学",
    adapter: "ujn",
    base: "http://map.adm.ujn.edu.cn/",
    src: "济南大学本科招生网·招生录取情况统计",
    srcUrl: "http://map.adm.ujn.edu.cn/2025zstj/",
    note:
      "山东省属公费师范生，按「专业+定向就业市」逐条投档，仅汉语言文学、特殊教育两个专业投放。官网统计页只给各专业各定向市的录取最高/最低分，无位次、平均分与人数，位次按山东一分一段表由最低分换算。2026 年录取统计官网尚未发布。",
  },
  {
    name: "临沂大学",
    adapter: "lyu",
    api: "http://211.64.240.198/LindaZhaoSheng/front/admissionsGradesCollect/selectByExample",
    src: "临沂大学招生网·往年分数查询",
    srcUrl: "http://211.64.240.198/LindaZhaoSheng/front-views/index.html",
    note:
      "山东省属公费师范生，按「专业+定向就业市」逐条投档。官网该表只给录取最高/最低分，无位次、平均分与人数，位次按山东一分一段表由最低分换算。官网「批次」列对省属公费标注不一致（2022 标「常规批」、2023—2024 标「提前批」、2025 标「普通类提前批B类」），故批次留空、以专业名中的「省属公费师范生」为准。2024 年官网把「体育教育（省属公费师范生）」也列在普通类下，其分数是体育综合分，已按专业名剔除。2026 年山东未公布公费师范生逐专业数据。",
  },
];

const byName = { nenu: fetchNenu, zf: fetchZhengfang, ccnu: fetchCcnu, lyu: fetchLyu, ujn: fetchUjn };

async function run(school) {
  console.log(`\n== ${school.name} ==`);
  let records;
  try {
    records = await byName[school.adapter](school);
  } catch (e) {
    console.error(`  抓取失败：${e.message}`);
    return;
  }
  records.sort((a, b) => b.y - a.y || (a.minRank ?? 9e9) - (b.minRank ?? 9e9));
  if (!records.length) {
    console.error("  零条记录，不写文件");
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${school.name}.json`);
  const body = {
    school: school.name,
    src: school.src,
    srcUrl: school.srcUrl,
    fetched: new Date().toISOString().slice(0, 10),
    note: school.note,
    records,
  };
  fs.writeFileSync(file, JSON.stringify(body, null, 0) + "\n", "utf8");
  console.log(`  写入 ${path.relative(ROOT, file)}：${records.length} 条`);
}

const arg = process.argv[2];
if (arg === "--probe") {
  const zf = new Zhengfang("probe", process.argv[3], process.argv[4]);
  await zf.boot();
  const dims = await zf.dims();
  [...dims]
    .filter(([, d]) => d.ssmc === "山东")
    .sort()
    .forEach(([combo, d]) => console.log(combo, "→", d.zslx.join("|")));
} else {
  const only = arg;
  const list = SCHOOLS.filter((s) => !only || s.name === only);
  if (!list.length) {
    console.error(`未配置院校：${only}`);
    console.error("可选：" + SCHOOLS.map((s) => s.name).join("、"));
    process.exit(1);
  }
  for (const s of list) await run(s);
}
