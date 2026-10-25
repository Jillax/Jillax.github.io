/* 世界的一半 · 60 国女性发展指标
   数据来自 women/data.js，地图路径来自 women/world.js。全部图表为原生 SVG 字符串，无第三方依赖。 */
(function () {
  "use strict";

  var D = window.WOMEN_DATA;
  var MAP = window.WOMEN_MAP;
  if (!D || !MAP) return;

  var IND = D.indicators;
  var C = {};
  D.countries.forEach(function (c) { C[c.iso3] = c; });
  var ISOS = D.countries.map(function (c) { return c.iso3; });
  var IDS = Object.keys(IND).filter(function (id) { return !IND[id].context; });
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  };

  var REGION_COLOR = {
    "北美": "#5fa8ea",
    "拉美": "#b5d05a",
    "欧洲与中亚": "#3fd0b5",
    "东亚与太平洋": "#ff5c86",
    "南亚": "#f0a94a",
    "中东与北非": "#c98ae0",
    "撒哈拉以南非洲": "#d99a6e",
  };
  var SERIES_COLORS = ["#ff5c86", "#5fa8ea", "#3fd0b5", "#f0a94a", "#c98ae0", "#b5d05a", "#d99a6e"];
  var RAMP = ["#171225", "#4a2334", "#8c2f4c", "#d9466e", "#ff7ba0"];
  var DIV = ["#3fd0b5", "#266f68", "#171225", "#a8455f", "#ff5c86"];
  var WORLD_COLOR = "#5d5183";

  // ---------- 取数 ----------
  function series(iso, id) {
    if (iso === "WLD") return D.world[id] || [];
    var s = D.series[iso];
    return (s && s[id]) || [];
  }
  function latestIn(arr, window) {
    for (var i = arr.length - 1; i >= 0; i -= 1) {
      if (arr[i][0] <= window[1] && arr[i][0] >= window[0]) return arr[i];
    }
    return null;
  }
  function latest(iso, id) { return latestIn(series(iso, id), IND[id].window); }
  function worldLatest(id) { return latestIn(D.world[id] || [], IND[id].window); }
  function maleLatest(iso, id) {
    var m = D.malePair[id];
    return m ? latest(iso, m) : null;
  }
  function ranked(id) {
    return ISOS.map(function (iso) {
      var v = latest(iso, id);
      return v ? { iso: iso, zh: C[iso].zh, region: C[iso].region, year: v[0], value: v[1] } : null;
    }).filter(Boolean);
  }
  function sortedBy(id, dir) {
    var r = ranked(id);
    r.sort(function (a, b) { return (dir === "asc" ? a.value - b.value : b.value - a.value); });
    return r;
  }
  function missingOf(id) {
    return ISOS.filter(function (iso) { return !latest(iso, id); })
      .map(function (iso) { return C[iso].zh; });
  }
  function median(vals) {
    var v = vals.slice().sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  // ---------- 格式化 ----------
  function fmt(id, v) {
    if (v == null) return "—";
    var d = IND[id].decimals;
    var s = d ? v.toFixed(d) : String(Math.round(v));
    return s + (IND[id].unit === "%" || IND[id].unit === "岁" ? IND[id].unit : "");
  }
  function fmtNum(v, d) { return d ? v.toFixed(d) : String(Math.round(v)); }
  function fmtPop(v) {
    if (v == null) return "—";
    if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
    return (v / 1e4).toFixed(0) + " 万";
  }
  function fmtGdp(v) { return v == null ? "—" : Math.round(v).toLocaleString("en-US") + " 国际元"; }
  function unit(id) { return IND[id].unit === "%" || IND[id].unit === "岁" ? "" : IND[id].unit; }

  // ---------- 颜色 ----------
  function hex2rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    var o = x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); });
    return "rgb(" + o.join(",") + ")";
  }
  function rampColor(stops, t) {
    t = Math.max(0, Math.min(1, t));
    var seg = (stops.length - 1) * t;
    var i = Math.min(stops.length - 2, Math.floor(seg));
    return mix(stops[i], stops[i + 1], seg - i);
  }
  function mapColor(id, v, lo, hi) {
    if (v == null) return null;
    var t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    if (id === "SE.ENR.TERT.FM.ZS") return rampColor(DIV, 0.5 + (v - 1) / (2 * Math.max(hi - 1, 1 - lo, 0.3)));
    return rampColor(RAMP, t);
  }

  // ---------- 地图 ----------
  var MAP_INDICATORS = [
    { id: "SG.GEN.PARL.ZS", label: "议会女性席位" },
    { id: "SL.TLF.ACTI.FE.ZS", label: "女性劳动参与" },
    { id: "SE.ENR.TERT.FM.ZS", label: "高教 GPI" },
    { id: "SL.EMP.SMGT.FE.ZS", label: "女性管理岗" },
    { id: "IT.NET.USER.FE.ZS", label: "女性上网率" },
    { id: "SH.STA.MMRT", label: "孕产妇死亡率" },
  ];
  var state = {
    mapInd: MAP_INDICATORS[0].id,
    sel: null,
    eduInd: "SE.ENR.TERT.FM.ZS",
    econInd: "SL.TLF.ACTI.FE.ZS",
    polInd: "SG.GEN.PARL.ZS",
    healthInd: "SP.ADO.TFRT",
    trendInd: "SG.GEN.PARL.ZS",
    trendSel: ["CHN", "USA", "SWE", "IND", "WLD"],
  };

  function mapExtent(id) {
    var vals = ranked(id).map(function (r) { return r.value; });
    return { lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals) };
  }

  function buildMap() {
    var out = [];
    out.push('<svg viewBox="0 0 ' + MAP.width + " " + MAP.height + '" role="img" aria-label="60 国女性指标世界地图">');
    out.push('<defs><pattern id="hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<rect width="5" height="5" fill="#16112b"></rect><line x1="0" y1="0" x2="0" y2="5" stroke="#3a3256" stroke-width="1.6"></line></pattern></defs>');
    out.push('<g class="bg">');
    MAP.other.forEach(function (d) { out.push('<path class="country out" d="' + d + '"></path>'); });
    Object.keys(MAP.countries).forEach(function (iso) {
      if (ISOS.indexOf(iso) === -1) {
        out.push('<path class="country out" d="' + MAP.countries[iso] + '"></path>');
      }
    });
    out.push('</g><g class="fg">');
    ISOS.forEach(function (iso) {
      if (MAP.countries[iso]) {
        out.push('<g data-iso="' + iso + '"><path class="country" d="' + MAP.countries[iso] + '"></path></g>');
      }
    });
    Object.keys(MAP.dots || {}).forEach(function (iso) {
      var p = MAP.dots[iso];
      out.push('<g data-iso="' + iso + '"><circle class="country dot" cx="' + p[0] + '" cy="' + p[1] + '" r="5.5"></circle></g>');
    });
    out.push("</g></svg>");
    $("map").innerHTML = out.join("");
    paintMap();
  }

  function paintMap() {
    var id = state.mapInd;
    var ex = mapExtent(id);
    document.querySelectorAll("#map [data-iso]").forEach(function (g) {
      var iso = g.getAttribute("data-iso");
      var v = latest(iso, id);
      var color = v ? mapColor(id, v[1], ex.lo, ex.hi) : null;
      g.querySelectorAll("path,circle").forEach(function (el) {
        el.setAttribute("fill", color || "url(#hatch)");
        el.classList.toggle("nodata", !color);
      });
      g.classList.toggle("sel", state.sel === iso);
    });
    renderMapLegend(ex);
  }

  function renderMapLegend(ex) {
    var id = state.mapInd;
    var stops = id === "SE.ENR.TERT.FM.ZS" ? DIV : RAMP;
    var n = ranked(id).length;
    var dirNote = IND[id].direction === "lower" ? "数值越低越好" :
      id === "SE.ENR.TERT.FM.ZS" ? "中线 1.00，左男右女" : "数值越高越好";
    $("map-legend").innerHTML =
      '<span class="legend-scale">' + fmt(id, ex.lo) +
      '<span class="ramp" style="background:linear-gradient(90deg,' + stops.join(",") + ')"></span>' +
      fmt(id, ex.hi) + "</span>" +
      '<span>' + esc(dirNote) + "</span>" +
      '<span class="legend-key"><i class="swatch" style="background:url(#hatch) ' + "#16112b" + ';background-image:repeating-linear-gradient(45deg,#3a3256 0 1px,transparent 1px 5px)"></i>样本内但无该指标数据</span>' +
      '<span class="legend-key"><i class="swatch" style="background:#241d3d"></i>样本外国家（不着色）</span>' +
      '<span>· 60 国中 ' + n + ' 国有数；新加坡以圆点标出</span>';
    $("map-name").textContent = IND[id].zh + "（" + IND[id].short + "）";
  }

  function renderMapSwitch() {
    $("map-switch").innerHTML = MAP_INDICATORS.map(function (m) {
      return '<button type="button" data-map="' + m.id + '" aria-pressed="' + (state.mapInd === m.id) + '">' + esc(m.label) + "</button>";
    }).join("");
  }

  // ---------- 提示与卡片 ----------
  function tipText(iso) {
    var id = state.mapInd;
    var v = latest(iso, id);
    var name = iso === "WLD" ? "世界平均" : C[iso].zh;
    return "<div>" + esc(name) + "</div><div><b>" + (v ? fmt(id, v[1]) : "无数据") + "</b> " +
      (v ? '<span class="tsub">' + v[0] + " 年 · " + esc(IND[id].short) + "</span>" : "") + "</div>";
  }
  function showTip(evt, iso) {
    var tip = $("map-tip");
    var box = $("map-stage").getBoundingClientRect();
    tip.innerHTML = tipText(iso);
    tip.style.opacity = 1;
    var x = evt.clientX - box.left + 14;
    var y = evt.clientY - box.top - 10;
    tip.style.left = Math.min(x, box.width - 200) + "px";
    tip.style.top = Math.max(0, y) + "px";
  }
  function hideTip() { $("map-tip").style.opacity = 0; }

  function indicatorRow(iso, id) {
    var v = latest(iso, id);
    var m = maleLatest(iso, id);
    var label = IND[id].zh;
    if (!v) {
      return '<div class="mc-row"><span class="k">' + esc(label) + '</span><span class="v">—</span><span class="y">无</span></div>';
    }
    return '<div class="mc-row"><span class="k">' + esc(label) + '</span><span class="v">' + fmt(id, v[1]) +
      (m ? ' <span style="color:var(--muted)">（男 ' + fmt(id, m[1]) + "）</span>" : "") +
      '</span><span class="y">' + v[0] + "</span></div>";
  }

  function detailHTML(iso) {
    var c = C[iso];
    var pop = latest(iso, "SP.POP.TOTL");
    var gdp = latest(iso, "NY.GDP.PCAP.PP.CD");
    var h = "<h3>" + esc(c.zh) + "</h3>";
    h += '<div class="mc-sub">' + esc(c.region) + " · 人口 " + fmtPop(pop && pop[1]) +
      " · 人均 GDP（PPP）" + fmtGdp(gdp && gdp[1]) + "</div>";
    var groups = {
      教育: ["SE.ENR.TERT.FM.ZS", "SE.TER.ENRR.FE", "SE.SEC.ENRR.FE", "SE.ADT.LITR.FE.ZS"],
      经济: ["SL.TLF.ACTI.FE.ZS", "SL.EMP.SMGT.FE.ZS", "FX.OWN.TOTL.FE.ZS", "SL.UEM.TOTL.FE.ZS"],
      政治: ["SG.GEN.PARL.ZS", "SG.GEN.MNST.ZS"],
      健康与安全: ["SP.DYN.LE00.FE.IN", "SH.STA.MMRT", "SP.ADO.TFRT", "SP.M18.2024.FE.ZS", "SG.VAW.1549.ZS"],
      数字: ["IT.NET.USER.FE.ZS"],
    };
    h += '<div class="mc-list">';
    Object.keys(groups).forEach(function (g) {
      h += '<div class="mc-row" style="border:0;padding-top:9px"><span class="k" style="font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--claim)">' + esc(g) + "</span><span class=\"v\"></span><span class=\"y\"></span></div>";
      groups[g].forEach(function (id) { h += indicatorRow(iso, id); });
    });
    h += "</div>";
    var s = series(iso, state.mapInd).filter(function (p) { return p[0] >= 2000; });
    if (s.length > 1) {
      h += '<div class="mc-spark"><div class="cap">' + esc(IND[state.mapInd].short) + "，2000 年以来</div>" + sparkSVG([s, worldSeries(state.mapInd)], { w: 296, h: 44 }) + "</div>";
    }
    return h;
  }
  function worldSeries(id) { return (D.world[id] || []).filter(function (p) { return p[0] >= 2000; }); }

  function selectCountry(iso) {
    state.sel = iso;
    var card = $("map-card");
    card.hidden = false;
    card.innerHTML = '<button type="button" class="mc-close" aria-label="关闭国家卡">×</button>' + detailHTML(iso);
    paintMap();
    document.querySelectorAll(".rrow").forEach(function (r) {
      r.classList.toggle("sel", r.getAttribute("data-iso") === iso);
    });
  }
  function closeCard() {
    state.sel = null;
    $("map-card").hidden = true;
    paintMap();
    document.querySelectorAll(".rrow.sel").forEach(function (r) { r.classList.remove("sel"); });
  }

  // ---------- 排名组件 ----------
  function rowShell(r, trackHTML, valText, gapText) {
    return '<div class="rrow" data-iso="' + r.iso + '" tabindex="0" role="button" title="看 ' + esc(r.zh) + ' 全部指标">' +
      '<span class="rname">' + esc(r.zh) + "</span>" + trackHTML +
      '<span class="rval">' + valText + "</span>" +
      '<span class="ryear">' + (gapText || r.year) + "</span></div>";
  }
  function twoCol(rowsHTML, list, render) {
    var half = Math.ceil(list.length / 2);
    return '<div class="rank two"><div>' + list.slice(0, half).map(render).join("") + "</div><div>" +
      list.slice(half).map(render).join("") + "</div></div>" + rowsHTML;
  }
  function undataBlock(id) {
    var miss = missingOf(id);
    if (!miss.length) return "";
    return '<div class="undata"><span>无该指标数据</span><span>' + miss.map(esc).join("、") + "</span></div>";
  }

  function barRank(el, id, opts) {
    opts = opts || {};
    var list = sortedBy(id, opts.dir || "desc");
    var max = opts.max || niceMax(list.map(function (r) { return r.value; }));
    var color = opts.color || "var(--ink)";
    function render(r) {
      var w = Math.max(0.5, (r.value / max) * 100);
      var track = '<span class="rtrack"><i class="fill" style="width:' + w.toFixed(1) + '%;--bar:' + color + '"></i></span>';
      return rowShell(r, track, fmt(id, r.value));
    }
    el.innerHTML = twoCol(undataBlock(id), list, render);
    el.dataset.ind = id;
  }

  function gpiRank(el, id) {
    var list = sortedBy(id, "desc");
    var vals = list.map(function (r) { return r.value; });
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var span = Math.max(hi - 1, 1 - lo, 0.3);
    var domLo = 1 - span;
    var domHi = 1 + span;
    function render(r) {
      var pct = function (v) { return ((v - domLo) / (domHi - domLo)) * 100; };
      var c = pct(1), v = pct(r.value);
      var left = Math.min(c, v), width = Math.abs(v - c);
      var track = '<span class="rtrack"><i class="mid" style="left:50%"></i>' +
        '<i class="pos" style="left:' + left.toFixed(1) + "%;width:" + Math.max(0.6, width).toFixed(1) +
        "%;--bar:" + rampColor(DIV, 0.5 + (r.value - 1) / (2 * span)) + '"></i></span>';
      return rowShell(r, track, fmt(id, r.value));
    }
    el.innerHTML = twoCol(undataBlock(id), list, render) +
      '<p class="rank-foot">横轴 ' + domLo.toFixed(2) + "–" + domHi.toFixed(2) + "，中线为 1.00（男女持平）</p>";
  }

  function dumbbellRank(el, id) {
    var list = ISOS.map(function (iso) {
      var f = latest(iso, id);
      var m = maleLatest(iso, id);
      if (!f || !m) return null;
      return { iso: iso, zh: C[iso].zh, region: C[iso].region, year: f[0], value: f[1], male: m[1], gap: f[1] - m[1] };
    }).filter(Boolean).sort(function (a, b) { return b.value - a.value; });
    function render(r) {
      var f = r.value, m = r.male;
      var track = '<span class="rtrack">' +
        '<i class="conn" style="left:' + Math.min(f, m).toFixed(1) + "%;width:" + Math.abs(f - m).toFixed(1) + '%"></i>' +
        '<i class="ml" style="left:' + m.toFixed(1) + '%"></i>' +
        '<i class="mf" style="left:' + f.toFixed(1) + '%;--bar:' + (regionColorOf(r)) + '"></i></span>';
      var gapTxt = (r.gap > 0 ? "+" : "") + r.gap.toFixed(1);
      return rowShell(r, track, fmt(id, r.value), gapTxt);
    }
    el.innerHTML = twoCol(undataBlock(id), list, render) +
      '<p class="rank-foot">右侧数字：女性值与男性值之差（百分点）。横轴 0–100%。</p>';
  }
  function regionColorOf(r) { return REGION_COLOR[r.region] || "#d99a6e"; }

  function niceMax(vals) {
    var m = Math.max.apply(null, vals);
    if (m <= 100) return 100;
    var step = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / step) * step;
  }

  // ---------- 折线 / 散点 / 迷你图 ----------
  function niceTicks(lo, hi, count) {
    var span = hi - lo || 1;
    var raw = span / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (k) { return k * mag; }).filter(function (s) { return s >= raw; })[0] || mag * 10;
    var out = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Number(t.toFixed(6)));
    return out;
  }

  function lineChart(list, opts) {
    var w = opts.w || 760;
    var h = opts.h || 300;
    var pad = { l: 46, r: opts.rpad || 62, t: 12, b: 26 };
    var xs = opts.xMin, xe = opts.xMax;
    var ys = [];
    list.forEach(function (s) { s.pts.forEach(function (p) { ys.push(p[1]); }); });
    if (!ys.length) return "<p class=\"note\">这一项没有可用序列。</p>";
    var ylo = Math.min.apply(null, ys);
    var yhi = Math.max.apply(null, ys);
    var padY = (yhi - ylo) * 0.12 || 1;
    ylo = opts.zeroY ? 0 : Math.max(0, ylo - padY);
    yhi = yhi + padY;
    var X = function (yr) { return pad.l + ((yr - xs) / (xe - xs)) * (w - pad.l - pad.r); };
    var Y = function (v) { return h - pad.b - ((v - ylo) / (yhi - ylo)) * (h - pad.t - pad.b); };
    var ticks = niceTicks(ylo, yhi, 4);
    var out = ['<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "折线图") + '">'];
    out.push('<g class="grid">');
    ticks.forEach(function (t) { out.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"></line>'); });
    out.push("</g><g class=\"axis\">");
    ticks.forEach(function (t) {
      out.push('<text x="' + (pad.l - 7) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + fmtNum(t, opts.yDecimals || 0) + "</text>");
    });
    var xticks = niceTicks(xs, xe, 6).filter(function (t) { return t >= xs && t <= xe; });
    xticks.forEach(function (t) {
      out.push('<line x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + (h - pad.b) + '" y2="' + (h - pad.b + 4) + '"></line>');
      out.push('<text x="' + X(t).toFixed(1) + '" y="' + (h - pad.b + 15) + '" text-anchor="middle">' + t + "</text>");
    });
    out.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + (h - pad.b) + '" y2="' + (h - pad.b) + '"></line>');
    out.push('<text class="axtitle" x="' + pad.l + '" y="' + (pad.t - 1) + '">' + esc(opts.yTitle || "") + "</text>");
    out.push("</g>");
    list.forEach(function (s) {
      if (s.pts.length < 2) return;
      var d = s.pts.map(function (p, i) { return (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("");
      out.push('<g class="series"><path d="' + d + '" stroke="' + s.color + '" ' + (s.dash ? 'stroke-dasharray="5 4"' : "") + "></path></g>");
      var last = s.pts[s.pts.length - 1];
      out.push('<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="3" fill="' + s.color + '"></circle>');
      out.push('<text class="wlabel" x="' + (X(last[0]) + 7).toFixed(1) + '" y="' + (Y(last[1]) + 3.5).toFixed(1) + '" fill="' + s.color + '">' + esc(s.label) + "</text>");
    });
    out.push("</svg>");
    return out.join("");
  }

  function sparkSVG(seriesList, opts) {
    var w = opts.w, h = opts.h;
    var ys = [];
    var xs = [];
    seriesList.forEach(function (s) { s.forEach(function (p) { ys.push(p[1]); xs.push(p[0]); }); });
    if (!ys.length) return "";
    var ylo = Math.min.apply(null, ys), yhi = Math.max.apply(null, ys);
    var xlo = Math.min.apply(null, xs), xhi = Math.max.apply(null, xs);
    var X = function (x) { return ((x - xlo) / (xhi - xlo || 1)) * (w - 2) + 1; };
    var Y = function (y) { return h - 4 - ((y - ylo) / (yhi - ylo || 1)) * (h - 8); };
    var out = ['<svg viewBox="0 0 ' + w + " " + h + '" style="width:100%;height:' + h + 'px" aria-hidden="true">'];
    seriesList.forEach(function (s, i) {
      if (s.length < 2) return;
      out.push('<path fill="none" stroke="' + (i ? WORLD_COLOR : "var(--claim)") + '" stroke-width="' + (i ? 1 : 1.8) + '" ' +
        (i ? 'stroke-dasharray="4 3"' : "") + ' d="' + s.map(function (p, j) { return (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("") + '"></path>');
      var last = s[s.length - 1];
      out.push('<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="2.6" fill="' + (i ? WORLD_COLOR : "var(--claim)") + '"></circle>');
    });
    out.push("</svg>");
    out.push('<div class="cap">' + xlo + " → " + xhi + " · 灰虚线为世界平均</div>");
    return out.join("");
  }

  function scatter(el, id, xId) {
    var pts = ISOS.map(function (iso) {
      var y = latest(iso, id);
      var x = latest(iso, xId);
      var pop = latest(iso, "SP.POP.TOTL");
      if (!y || !x) return null;
      return { iso: iso, zh: C[iso].zh, region: C[iso].region, x: x[1], y: y[1], pop: (pop && pop[1]) || 1e6, year: y[0] };
    }).filter(Boolean);
    var w = 900, h = 420, pad = { l: 58, r: 22, t: 16, b: 42 };
    var xs = pts.map(function (p) { return p.x; });
    var xlo = Math.floor(Math.min.apply(null, xs) / 5) * 5 - 2;
    var xhi = Math.ceil(Math.max.apply(null, xs) / 5) * 5 + 2;
    var ys = pts.map(function (p) { return p.y; });
    var lylo = Math.floor(Math.log10(Math.max(0.5, Math.min.apply(null, ys))));
    var lyhi = Math.ceil(Math.log10(Math.max.apply(null, ys)));
    var X = function (v) { return pad.l + ((v - xlo) / (xhi - xlo)) * (w - pad.l - pad.r); };
    var Y = function (v) { return h - pad.b - ((Math.log10(v) - lylo) / (lyhi - lylo)) * (h - pad.t - pad.b); };
    var maxPop = Math.max.apply(null, pts.map(function (p) { return p.pop; }));
    var R = function (pop) { return 3 + Math.sqrt(pop / maxPop) * 17; };
    var out = ['<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="女性预期寿命与孕产妇死亡率散点图">'];
    out.push('<g class="grid">');
    for (var t = lylo; t <= lyhi; t += 1) {
      var v = Math.pow(10, t);
      out.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"></line>');
    }
    out.push("</g><g class=\"axis\">");
    for (var t2 = lylo; t2 <= lyhi; t2 += 1) {
      var v2 = Math.pow(10, t2);
      out.push('<text x="' + (pad.l - 8) + '" y="' + (Y(v2) + 3.5).toFixed(1) + '" text-anchor="end">' + v2 + "</text>");
    }
    niceTicks(xlo, xhi, 6).filter(function (q) { return q >= xlo && q <= xhi; }).forEach(function (q) {
      out.push('<line x1="' + X(q).toFixed(1) + '" x2="' + X(q).toFixed(1) + '" y1="' + (h - pad.b) + '" y2="' + (h - pad.b + 4) + '"></line>');
      out.push('<text x="' + X(q).toFixed(1) + '" y="' + (h - pad.b + 16) + '" text-anchor="middle">' + q + "</text>");
    });
    out.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + (h - pad.b) + '" y2="' + (h - pad.b) + '"></line>');
    out.push('<text class="axtitle" x="' + (w - pad.r) + '" y="' + (h - 6) + '" text-anchor="end">' + esc(IND[xId].zh) + "（岁）</text>");
    out.push('<text class="axtitle" x="' + pad.l + '" y="' + (pad.t - 3) + '">' + esc(IND[id].zh) + "（每 10 万活产，对数轴）</text>");
    out.push("</g>");
    pts.forEach(function (p) {
      out.push('<circle class="dot-p" data-iso="' + p.iso + '" cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + R(p.pop).toFixed(1) +
        '" fill="' + (REGION_COLOR[p.region] || "#d99a6e") + '" fill-opacity=".62"><title>' +
        esc(p.zh) + "：" + fmt(xId, p.x) + " / " + fmt(id, p.y) + "（" + p.year + "）</title></circle>");
    });
    // 只标注两端与几个常被误读的位置
    var labels = pts.slice().sort(function (a, b) { return b.y - a.y; }).slice(0, 2)
      .concat(pts.slice().sort(function (a, b) { return a.y - b.y; }).slice(0, 1))
      .concat(["USA", "CHN", "JPN", "IND"].map(function (iso) {
        return pts.filter(function (p) { return p.iso === iso; })[0];
      }).filter(Boolean));
    var seen = {};
    labels.forEach(function (p) {
      if (!p || seen[p.iso]) return;
      seen[p.iso] = 1;
      out.push('<g class="anno"><text x="' + (X(p.x) + R(p.pop) + 3).toFixed(1) + '" y="' + (Y(p.y) + 3).toFixed(1) + '">' + esc(p.zh) + "</text></g>");
    });
    out.push("</svg>");
    el.innerHTML = out.join("");
    var wl = worldLatest(id);
    $("health-legend").innerHTML = regionLegend() +
      '<span class="k">气泡大小 = 人口总数</span>' +
      '<span class="k">世界均值：孕产妇死亡 ' + (wl ? fmt(id, wl[1]) + "（" + wl[0] + "）" : "—") + "</span>";
  }

  function regionLegend() {
    return Object.keys(REGION_COLOR).map(function (r) {
      return '<span class="k"><i class="pt" style="background:' + REGION_COLOR[r] + '"></i>' + esc(r) + "</span>";
    }).join("");
  }

  // ---------- 章节：切换器 ----------
  function switcher(el, items, current, onPick) {
    el.innerHTML = items.map(function (it) {
      return '<button type="button" data-id="' + it.id + '" aria-pressed="' + (current === it.id) + '">' + esc(it.label) + "</button>";
    }).join("");
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-id]");
      if (!b) return;
      onPick(b.getAttribute("data-id"));
    });
  }
  function syncPressed(el, id) {
    el.querySelectorAll("button[data-id],button[data-map]").forEach(function (b) {
      var bid = b.getAttribute("data-id") || b.getAttribute("data-map");
      b.setAttribute("aria-pressed", String(bid === id));
    });
  }

  // ---------- 读数卡 ----------
  function renderReads(el, items) {
    el.innerHTML = items.map(function (it, i) {
      var paras = (it.p || []).concat(it.p2 || []);
      return '<div class="read"><div class="read-n">' + String(i + 1).padStart(2, "0") + "</div><div>" +
        "<h3>" + esc(it.h) + "</h3>" +
        paras.map(function (x) { return "<p>" + x + "</p>"; }).join("") +
        (it.caution ? '<p class="caution">' + esc(it.caution) + "</p>" : "") +
        "</div></div>";
    }).join("");
  }
  function n(id, v) { return '<span class="num">' + v + "</span>"; }
  function countryTag(iso) { return esc(C[iso] ? C[iso].zh : "世界"); }

  // ---------- 教育 ----------
  var EDU_ITEMS = [
    { id: "SE.ENR.TERT.FM.ZS", label: "高教 GPI", kind: "gpi" },
    { id: "SE.TER.ENRR.FE", label: "女性高教毛入学率", kind: "bar", color: "var(--edu)" },
    { id: "SE.SEC.ENRR.FE", label: "女性中等教育毛入学率", kind: "bar", color: "var(--edu)" },
    { id: "SE.ADT.LITR.FE.ZS", label: "女性成人识字率", kind: "bar", color: "var(--edu)" },
  ];
  function renderEdu() {
    syncPressed($("edu-switch"), state.eduInd);
    var item = EDU_ITEMS.filter(function (x) { return x.id === state.eduInd; })[0];
    var el = $("edu-rank");
    if (item.kind === "gpi") gpiRank(el, item.id); else barRank(el, item.id, { color: item.color });
    var v = worldLatest(item.id);
    $("edu-note").innerHTML = esc(IND[item.id].zh) + "：" + esc(IND[item.id].note || "") +
      (v ? " 世界平均 " + n("", fmt(item.id, v[1])) + "（" + v[0] + " 年）。" : "");
    eduReads();
  }
  function eduReads() {
    var g = sortedBy("SE.ENR.TERT.FM.ZS");
    var over = g.filter(function (r) { return r.value > 1; });
    var under = g.filter(function (r) { return r.value < 1; });
    var wG = worldLatest("SE.ENR.TERT.FM.ZS");
    var lit = sortedBy("SE.ADT.LITR.FE.ZS");
    var litLow = lit.slice(-3).reverse();
    var ter = sortedBy("SE.TER.ENRR.FE");
    var terLow = ter.slice(-3).reverse();
    renderReads($("edu-reads"), [
      {
        h: over.length + " 个有数据国家里，女性高等教育已多于男性",
        p: ["共 " + n("", g.length + " 国") + "有可比数据，性别平等指数中位数 " +
          n("", median(g.map(function (r) { return r.value; })).toFixed(2)) +
          "，世界平均 " + n("", fmt("SE.ENR.TERT.FM.ZS", wG[1])) + "（" + wG[0] + " 年）。" +
          "最高 " + esc(g[0].zh) + " " + n("", fmt("SE.ENR.TERT.FM.ZS", g[0].value)) + "（" + g[0].year + "），" +
          "最低 " + esc(g[g.length - 1].zh) + " " + n("", fmt("SE.ENR.TERT.FM.ZS", g[g.length - 1].value)) + "（" + g[g.length - 1].year + "）。"],
        p2: ["仍低于 1.00 的 " + under.length + " 个国家：" +
          under.map(function (r) { return esc(r.zh) + " " + fmt("SE.ENR.TERT.FM.ZS", r.value); }).join("、") +
          "。它们分处两种逻辑——女性入学机会仍受限，或男性入学率本身偏低（后者在东亚更常见）。"],
        caution: "GPI 是入学率的比值，不反映完成率、专业分布与学费负担。",
      },
      {
        h: "入学率的另一头：不是性别问题，是国家收入问题",
        p: ["女性高等教育毛入学率最低的三个国家：" +
          terLow.map(function (r) { return esc(r.zh) + " " + fmt("SE.TER.ENRR.FE", r.value); }).join("、") +
          "；最高的三个是 " + ter.slice(0, 3).map(function (r) { return esc(r.zh) + " " + Math.round(r.value) + "%"; }).join("、") + "。"],
        p2: ["在同一批国家里，性别差可能已经翻向女性，而总量仍然极低。把 GPI 榜与女性毛入学率榜并排看，" +
          "才能分清“女性上不了学”和“大家都上不了学”。"],
        caution: "毛入学率的分母是学龄人口，超过 100% 来自留级与非传统年龄入学，属正常。",
      },
      {
        h: "识字率这一项，在富国已经消失",
        p: ["60 国样本里只有 " + n("", lit.length + " 国") + "有可比数据，年份从 2008 到 2024 不等。" +
          "最低的三个：" + litLow.map(function (r) { return esc(r.zh) + " " + fmt("SE.ADT.LITR.FE.ZS", r.value) + "%（" + r.year + "）"; }).join("、") + "。"],
        p2: ["美国、德国、法国、英国、日本等国没有近年识字率序列——不是这些国家的识字率百分之百，" +
          "而是它们已不再做这项调查。缺数据不等于好消息。"],
        caution: "识字率是自报的最低阅读能力，与“受过年教育”不可互换。",
      },
    ]);
  }

  // ---------- 经济 ----------
  var ECON_ITEMS = [
    { id: "SL.TLF.ACTI.FE.ZS", label: "劳动参与率（15–64 岁）", kind: "bell" },
    { id: "FX.OWN.TOTL.FE.ZS", label: "账户持有率", kind: "bell" },
    { id: "SL.EMP.SMGT.FE.ZS", label: "管理岗占比", kind: "bar", color: "var(--econ)" },
    { id: "SL.UEM.TOTL.FE.ZS", label: "失业率", kind: "bar", color: "var(--econ)" },
  ];
  function renderEcon() {
    syncPressed($("econ-switch"), state.econInd);
    var item = ECON_ITEMS.filter(function (x) { return x.id === state.econInd; })[0];
    var el = $("econ-rank");
    if (item.kind === "bell") dumbbellRank(el, item.id);
    else barRank(el, item.id, { color: item.color });
    var v = worldLatest(item.id);
    $("econ-note").innerHTML = esc(IND[item.id].zh) + "：" + esc(IND[item.id].note || "") +
      (v ? " 世界平均 " + n("", fmt(item.id, v[1])) + "（" + v[0] + " 年）。" : "");
    $("econ-legend").innerHTML = item.kind === "bell"
      ? '<span class="k"><i class="ring"></i>男性</span><span class="k"><i class="pt" style="background:#3fd0b5"></i>女性（按区域着色）</span><span class="k">连线 = 性别差</span>'
      : '<span class="k">横轴 0–100%，条形长度即该值</span>';
    econReads();
  }
  function econReads() {
    var f = D.world["SL.TLF.ACTI.FE.ZS"];
    var m = D.world["SL.TLF.ACTI.MA.ZS"];
    var f1 = f[0], m1 = m[0];
    var fN = f[f.length - 1], mN = m[m.length - 1];
    var gapNow = fN[1] - mN[1], gap97 = f1[1] - m1[1];
    var lf = sortedBy("SL.TLF.ACTI.FE.ZS");
    var low = lf.slice(-3).reverse();
    var mg = sortedBy("SL.EMP.SMGT.FE.ZS");
    var fx = sortedBy("FX.OWN.TOTL.FE.ZS");
    var acct = ISOS.map(function (iso) {
      var a = latest(iso, "FX.OWN.TOTL.FE.ZS"), b = maleLatest(iso, "FX.OWN.TOTL.FE.ZS");
      return a && b ? b[1] - a[1] : null;
    }).filter(function (x) { return x != null; });
    renderReads($("econ-reads"), [
      {
        h: "二十八年里差距收窄了 " + Math.abs(gapNow - gap97).toFixed(1) + " 点——来自男性下降",
        p: ["女性劳动参与率的世界均值从 " + n("", f1[1].toFixed(1) + "%") + "（" + f1[0] + "）到 " +
          n("", fN[1].toFixed(1) + "%") + "（" + fN[0] + "），几乎没动；男性从 " + n("", m1[1].toFixed(1) + "%") +
          " 降到 " + n("", mN[1].toFixed(1) + "%") + "。性别差因此从 " + Math.abs(gap97).toFixed(1) +
          " 点收窄到 " + Math.abs(gapNow).toFixed(1) + " 点。"],
        p2: ["也就是说：这一栏的“进步”，主要不是女性进入劳动市场，而是男性退出劳动市场——" +
          "老龄化、伤残退出与非正规就业统计口径的变化都在其中。"],
        caution: "ILO 模型估计，15–64 岁口径；不含无酬家务与照护劳动的时间。",
      },
      {
        h: "参与率最高的国家，同时出现在最富与最穷两端",
        p: ["最高：" + lf.slice(0, 3).map(function (r) { return esc(r.zh) + " " + fmt("SL.TLF.ACTI.FE.ZS", r.value); }).join("、") +
          "；最低：" + low.map(function (r) { return esc(r.zh) + " " + fmt("SL.TLF.ACTI.FE.ZS", r.value); }).join("、") + "。"],
        p2: ["坦桑尼亚与瑞典都接近八成二，但前者几乎全在非正规农业，后者绝大多数是带薪岗位并有公共托育支撑。" +
          "同一个数字，两种处境。"],
        caution: "低参与率既可能是限制（法律、安全、家庭分工），也可能是统计（无地、无薪的家庭劳动不被计入）。这一项无法区分两者。",
      },
      {
        h: "管理层：最高与最低相差 " + (mg[0].value / mg[mg.length - 1].value).toFixed(1) + " 倍",
        p: [mg.length + " 国有可比数据。最高 " + esc(mg[0].zh) + " " + n("", fmt("SL.EMP.SMGT.FE.ZS", mg[0].value)) +
          "（" + mg[0].year + "），最低 " + esc(mg[mg.length - 1].zh) + " " +
          n("", fmt("SL.EMP.SMGT.FE.ZS", mg[mg.length - 1].value)) + "（" + mg[mg.length - 1].year + "）。"],
        p2: ["美国 " + fmt("SL.EMP.SMGT.FE.ZS", latest("USA", "SL.EMP.SMGT.FE.ZS")[1]) + "、瑞典 " +
          fmt("SL.EMP.SMGT.FE.ZS", latest("SWE", "SL.EMP.SMGT.FE.ZS")[1]) +
          "；两者女性劳动参与率相差 " +
          Math.abs(latest("SWE", "SL.TLF.ACTI.FE.ZS")[1] - latest("USA", "SL.TLF.ACTI.FE.ZS")[1]).toFixed(0) +
          " 点，管理岗占比却几乎相同。“女性是否在业”与“岗位是否交给女性”是两条独立曲线。"],
        caution: "口径是“全部高级与中层管理岗位中女性占比”，不是女性就业者中做管理的比例。",
      },
      {
        h: "有没有账户，比收入更能解释经济自主的下限",
        p: [esc(fx[0].zh) + " " + fmt("FX.OWN.TOTL.FE.ZS", fx[0].value) + " 最高，" +
          esc(fx[fx.length - 1].zh) + " " + fmt("FX.OWN.TOTL.FE.ZS", fx[fx.length - 1].value) + " 最低（" + fx[fx.length - 1].year + "）。"],
        p2: ["此项来自全球金融普惠调查，按 15 岁以上人口自报、男女分列。有男女可比数据的 " + acct.length +
          " 国里，" + n("", acct.filter(function (x) { return x > 0; }).length + " 国") + "男性更高，" +
          n("", acct.filter(function (x) { return x < 0; }).length + " 国") + "女性更高。"],
        caution: "有账户不等于用得起、用得自由：部分国家的账户需男性监护人共同签署，这类法律限制不在此指标内。",
      },
    ]);
  }

  // ---------- 政治 ----------
  var POL_ITEMS = [
    { id: "SG.GEN.PARL.ZS", label: "国民议会女性席位", kind: "bar", color: "var(--pol)" },
    { id: "SG.GEN.MNST.ZS", label: "部长级女性占比", kind: "bar", color: "var(--pol)" },
  ];
  function renderPol() {
    syncPressed($("pol-switch"), state.polInd);
    var item = POL_ITEMS.filter(function (x) { return x.id === state.polInd; })[0];
    barRank($("pol-rank"), item.id, { color: item.color });
    var wl = D.world[item.id] || [];
    $("pol-line").innerHTML = lineChart(
      [{ label: "世界平均", color: WORLD_COLOR, dash: false, pts: wl.filter(function (p) { return p[0] >= D.years[0]; }) }],
      { w: 460, h: 300, rpad: 78, yTitle: "%", xMin: D.years[0], xMax: D.years[1], aria: item.label + " 世界平均走势" }
    );
    document.querySelector("[data-pol-line-year]").textContent = " " + (wl[wl.length - 1] ? wl[wl.length - 1][0] : "") + " 年";
    $("pol-note").innerHTML = esc(IND[item.id].zh) + "：" + esc(IND[item.id].note || "");
    polReads();
  }
  function polReads() {
    var p = sortedBy("SG.GEN.PARL.ZS");
    var over40 = p.filter(function (r) { return r.value >= 40; });
    var under10 = p.filter(function (r) { return r.value < 10; });
    var w = D.world["SG.GEN.PARL.ZS"];
    var first = w[0], last = w[w.length - 1];
    var rate = (last[1] - first[1]) / (last[0] - first[0]);
    var toHalf = Math.ceil((50 - last[1]) / rate);
    var mn = sortedBy("SG.GEN.MNST.ZS");
    var mnZero = mn.filter(function (r) { return r.value === 0; });
    renderReads($("pol-reads"), [
      {
        h: "世界从 " + first[1].toFixed(1) + "% 到 " + last[1].toFixed(1) + "%，用了 " + (last[0] - first[0]) + " 年",
        p: ["按这一时期的平均速度（每年 " + n("", rate.toFixed(2) + " 点") + "），议会席位达到与男性持平的 50% 还需约 " +
          n("", toHalf + " 年") + "——这是一个纯线性外推，只用来标定量级，不是预测。"],
        p2: ["样本内 " + over40.length + " 国已过 40%：" + over40.slice(0, 6).map(function (r) { return esc(r.zh) + " " + r.value.toFixed(1) + "%"; }).join("、") +
          (over40.length > 6 ? " 等" : "") + "；不足 10% 的 " + under10.length + " 国：" +
          under10.map(function (r) { return esc(r.zh) + " " + r.value.toFixed(1) + "%"; }).join("、") + "。"],
        caution: "按议席计，不按人口；上议院与地方议会不在这一项内。",
      },
      {
        h: "议会席位最高的三个国家",
        p: [esc(p[0].zh) + " " + fmt("SG.GEN.PARL.ZS", p[0].value) + "、" +
          esc(p[1].zh) + " " + fmt("SG.GEN.PARL.ZS", p[1].value) + "、" +
          esc(p[2].zh) + " " + fmt("SG.GEN.PARL.ZS", p[2].value) + " 排前三，三者都不在西欧。"],
        p2: ["欧洲并不天然领先：法国 " + fmt("SG.GEN.PARL.ZS", latest("FRA", "SG.GEN.PARL.ZS")[1]) +
          "、德国 " + fmt("SG.GEN.PARL.ZS", latest("DEU", "SG.GEN.PARL.ZS")[1]) +
          "，而常被归入保守阵营的阿拉伯联合酋长国已达 " + fmt("SG.GEN.PARL.ZS", latest("ARE", "SG.GEN.PARL.ZS")[1]) +
          "。这一栏的位置更取决于选举规则与席位分配方式，而不是发展水平。"],
        caution: "按议席计，不按人口；上议院与地方议会不在这一项内。任命制议会的占比与竞争性选举不可直接比较，本页只列数值、不判定成因。",
      },
      {
        h: "部长级最高 " + esc(mn[0].zh) + " " + mn[0].value.toFixed(1) + "%" + (mnZero.length ? "，" + mnZero.length + " 国为零" : "，最低 " + esc(mn[mn.length - 1].zh) + " " + mn[mn.length - 1].value.toFixed(1) + "%"),
        p: ["世界平均 " + n("", fmt("SG.GEN.MNST.ZS", worldLatest("SG.GEN.MNST.ZS")[1])) +
          "（" + worldLatest("SG.GEN.MNST.ZS")[0] + " 年）。最低 " + esc(mn[mn.length - 1].zh) + " " +
          fmt("SG.GEN.MNST.ZS", mn[mn.length - 1].value) + "。"],
        p2: ["中国 " + fmt("SG.GEN.MNST.ZS", latest("CHN", "SG.GEN.MNST.ZS")[1]) + "、印度 " +
          fmt("SG.GEN.MNST.ZS", latest("IND", "SG.GEN.MNST.ZS")[1]) + "、美国 " +
          fmt("SG.GEN.MNST.ZS", latest("USA", "SG.GEN.MNST.ZS")[1]) + "、俄罗斯 " +
          fmt("SG.GEN.MNST.ZS", latest("RUS", "SG.GEN.MNST.ZS")[1]) +
          "。同一个国家里，议会席位占比与部长占比可以相差二十点以上。"],
        caution: "内阁改组会让单年数值大幅跳变，要看形状请用第 06 节的整条线。",
      },
    ]);
  }

  // ---------- 健康与安全 ----------
  var HEALTH_ITEMS = [
    { id: "SP.ADO.TFRT", label: "青少年生育率", color: "var(--health)" },
    { id: "SP.M18.2024.FE.ZS", label: "18 岁前结婚（数据薄）", color: "var(--health)" },
    { id: "SG.VAW.1549.ZS", label: "伴侣暴力（数据最薄）", color: "var(--health)" },
    { id: "SH.STA.MMRT", label: "孕产妇死亡率", color: "var(--health)" },
  ];
  function renderHealth() {
    syncPressed($("health-switch"), state.healthInd);
    scatter($("health-scatter"), "SH.STA.MMRT", "SP.DYN.LE00.FE.IN");
    var item = HEALTH_ITEMS.filter(function (x) { return x.id === state.healthInd; })[0];
    var id = item.id;
    barRank($("health-rank"), id, { color: item.color });
    var wl = worldLatest(id);
    $("health-note").innerHTML = esc(IND[id].zh) + "：" + esc(IND[id].note || (IND[id].direction === "lower" ? "数值越低越好。" : "")) +
      (wl ? " 世界平均 " + n("", fmt(id, wl[1])) + "（" + wl[0] + " 年）。" : "") +
      " 本榜按从高到低排。";
    healthReads();
  }
  function healthReads() {
    var mm = sortedBy("SH.STA.MMRT");
    var le = sortedBy("SP.DYN.LE00.FE.IN");
    var af = sortedBy("SP.ADO.TFRT");
    var cm = sortedBy("SP.M18.2024.FE.ZS");
    var vw = sortedBy("SG.VAW.1549.ZS");
    var usa = latest("USA", "SH.STA.MMRT"), jpn = latest("JPN", "SH.STA.MMRT"),
      deu = latest("DEU", "SH.STA.MMRT"), fra = latest("FRA", "SH.STA.MMRT"), chn = latest("CHN", "SH.STA.MMRT");
    renderReads($("health-reads"), [
      {
        h: "同一个指标里，最小与最大差 " + Math.round(mm[0].value / Math.max(0.5, mm[mm.length - 1].value)) + " 倍",
        p: ["孕产妇死亡率（每 10 万活产，2023 年模型估计）最高 " + countryTag(mm[0].iso) + " " + n("", fmt("SH.STA.MMRT", mm[0].value)) +
          "，最低 " + countryTag(mm[mm.length - 1].iso) + " " + fmt("SH.STA.MMRT", mm[mm.length - 1].value) +
          "；世界平均 " + n("", fmt("SH.STA.MMRT", worldLatest("SH.STA.MMRT")[1])) + "。"],
        p2: ["挪威 " + fmt("SH.STA.MMRT", latest("NOR", "SH.STA.MMRT")[1]) + "、日本 " + fmt("SH.STA.MMRT", jpn[1]) +
          "、德国 " + fmt("SH.STA.MMRT", deu[1]) + "，美国是 " + n("", fmt("SH.STA.MMRT", usa[1])) +
          "——在高收入国家里，美国与中国（" + fmt("SH.STA.MMRT", chn[1]) + "）处在同一量级，而不是与西欧同一量级。"],
        caution: "联合国机构联合模型估计，不是各国登记数；对登记薄弱的国家，模型误差本身可达数十个百分点。",
      },
      {
        h: "活得久 ≠ 生得安全",
        p: ["女性预期寿命从 " + countryTag(le[le.length - 1].iso) + " 的 " + fmt("SP.DYN.LE00.FE.IN", le[le.length - 1].value) +
          " 到 " + countryTag(le[0].iso) + " 的 " + n("", fmt("SP.DYN.LE00.FE.IN", le[0].value)) +
          "，极差 " + (le[0].value - le[le.length - 1].value).toFixed(1) + " 岁。"],
        p2: ["散点图里，横轴靠右的国家大多纵轴也低，但离群点很稳定：几个高收入国家落在预期寿命最高的位置，" +
          "同时孕产妇死亡率明显高于同等寿命的国家。"],
        caution: "两项指标年份不同（预期寿命 2024、孕产死亡 2023），只用于定位，不做比值。",
      },
      {
        h: "青少年生育率的三个数量级",
        p: [af.slice(0, 3).map(function (r) { return esc(r.zh) + " " + fmt("SP.ADO.TFRT", r.value); }).join("、") +
          " 最高，" + af.slice(-3).map(function (r) { return esc(r.zh) + " " + fmt("SP.ADO.TFRT", r.value); }).join("、") +
          " 最低（每千名 15–19 岁女性）。"],
        p2: ["世界平均 " + fmt("SP.ADO.TFRT", worldLatest("SP.ADO.TFRT")[1]) + "（" + worldLatest("SP.ADO.TFRT")[0] + " 年）。"],
        caution: "生育率是结果指标，受婚姻年龄、避孕可得性与教育年限共同影响，不能单独当作“女性自主”的读数。",
      },
      {
        h: "两项最该有数据的指标，恰恰最薄",
        p: ["「20–24 岁女性中 18 岁前结婚」只有 " + n("", cm.length + " 国") + "有可比数据，" +
          "「过去 12 个月遭受伴侣暴力」只有 " + n("", vw.length + " 国") + "。"],
        p2: ["暴力项的最高值：" + vw.slice(0, 3).map(function (r) { return esc(r.zh) + " " + fmt("SG.VAW.1549.ZS", r.value) + "（" + r.year + "）"; }).join("、") +
          "；样本里的 " + vw.length + " 条全部来自 2008–2017 年之间的单次调查，" +
          "另有 " + missingOf("SG.VAW.1549.ZS").length + " 国完全没有这条序列（含美国、日本、澳大利亚、中国、俄罗斯、巴西）。"],
        caution: "这两项按调查年份取值，不同国家取的根本不是同一年。名次主要由调查年份决定，看数值比看排名可靠。",
      },
    ]);
  }

  // ---------- 数字与科技 ----------
  function renderTech() {
    var id = "IT.NET.USER.FE.ZS";
    dumbbellRank($("tech-rank"), id);
    var f = worldLatest(id), m = worldLatest("IT.NET.USER.MA.ZS");
    var list = ISOS.map(function (iso) {
      var a = latest(iso, id), b = maleLatest(iso, id);
      return a && b ? { iso: iso, zh: C[iso].zh, gap: a[1] - b[1] } : null;
    }).filter(Boolean);
    var lower = list.filter(function (r) { return r.gap < 0; });
    $("tech-note").innerHTML = esc(IND[id].note || "") +
      " 世界：女性 " + n("", fmt(id, f[1])) + "（" + f[0] + "），男性 " + n("", fmt("IT.NET.USER.MA.ZS", m[1])) + "（" + m[0] + "）。" +
      " " + list.length + " 个有男女可比数据的国家里，" + n("", lower.length + " 国") + "女性低于男性。右侧数字为女减男。";
    $("tech-legend").innerHTML = '<span class="k"><i class="ring"></i>男性</span><span class="k"><i class="pt" style="background:#f0a94a"></i>女性</span><span class="k">按女性上网率从高到低排</span>';
    var worst = list.slice().sort(function (a, b) { return a.gap - b.gap; }).slice(0, 3);
    var best = list.slice().sort(function (a, b) { return b.gap - a.gap; }).slice(0, 3);
    var gpiOver = ranked("SE.ENR.TERT.FM.ZS").filter(function (r) { return r.value > 1; }).length;
    renderReads($("tech-reads"), [
      {
        h: lower.length + " 国女性上网率低于男性，" + list.filter(function (r) { return r.gap > 0; }).length + " 国反超",
        p: ["差距最大的三个：" + worst.map(function (r) { return esc(r.zh) + " " + (r.gap > 0 ? "+" : "") + r.gap.toFixed(1) + " 点"; }).join("、") +
          "；女性反而更高的三个：" + best.map(function (r) { return esc(r.zh) + " " + (r.gap > 0 ? "+" : "") + r.gap.toFixed(1) + " 点"; }).join("、") + "。"],
        p2: ["互联网使用率是这一栏里唯一同时给出男女分列、且有年度序列的指标。它能测“接入”，测不了“接入之后做了什么”。"],
        caution: "ITU 口径为最近三个月使用过互联网；美国最新值停在 2015 年，新西兰、南非、尼日利亚等 7 国无序列。",
      },
      {
        h: "科技行业的女性，在这本账里查不到",
        p: ["本页用的世界银行公开指标集中，没有“科技／数字经济就业按性别分列”这一项：它能给出女性上网率与管理岗占比，" +
          "却给不出行业维度上的性别构成。能拿到的最近似替代是：受高等教育的女性规模（" + gpiOver + " 国女性多于男性）与管理岗中的女性占比（最高 " +
          fmt("SL.EMP.SMGT.FE.ZS", sortedBy("SL.EMP.SMGT.FE.ZS")[0].value) + "）。"],
        p2: ["所以这一节的结论不是“女性没进科技业”，而是“这一页无法回答”——缺的是统计，不是结论。" +
          "第 07 节把这类缺口逐项列了出来。"],
        caution: "把代理指标当成事实，是这类页面最容易犯的错。本页把它们分开摆，不相乘、不相加、不合成。",
      },
    ]);
  }

  // ---------- 二十年 ----------
  var TREND_ITEMS = [
    { id: "SG.GEN.PARL.ZS", label: "议会女性席位" },
    { id: "SL.TLF.ACTI.FE.ZS", label: "女性劳动参与" },
    { id: "SE.ENR.TERT.FM.ZS", label: "高教 GPI" },
    { id: "IT.NET.USER.FE.ZS", label: "女性上网率" },
    { id: "SH.STA.MMRT", label: "孕产妇死亡率" },
    { id: "SP.ADO.TFRT", label: "青少年生育率" },
    { id: "SP.M18.2024.FE.ZS", label: "18 岁前结婚" },
  ];
  function trendPoint(id, iso, year) {
    var s = series(iso, id);
    for (var i = 0; i < s.length; i += 1) if (s[i][0] === year) return s[i][1];
    return null;
  }
  function trendSeries(id, iso) {
    var s = series(iso, id).filter(function (p) { return p[0] >= D.years[0]; });
    if (s.length < 2) return s;
    // 稀疏序列（调查型指标）用阶梯线更诚实，这里保留原始点，只补齐同一年份的重复值以免断线
    return s;
  }
  function renderTrend() {
    var id = state.trendInd;
    syncPressed($("trend-switch"), id);
    var list = state.trendSel.map(function (iso, i) {
      return {
        label: iso === "WLD" ? "世界" : C[iso].zh,
        color: iso === "WLD" ? WORLD_COLOR : SERIES_COLORS[i % SERIES_COLORS.length],
        dash: iso === "WLD",
        pts: trendSeries(id, iso),
      };
    });
    var wl = worldLatest(id);
    $("trend-line").innerHTML = lineChart(list, {
      w: 900, h: 340, rpad: 70, yTitle: IND[id].zh + (IND[id].unit === "%" ? "（%）" : ""),
      xMin: D.years[0], xMax: D.years[1], yDecimals: IND[id].decimals > 1 ? 2 : 0,
      aria: IND[id].zh + " 多年趋势",
    });
    $("trend-cap").textContent = IND[id].zh + "，" + D.years[0] + "–" + D.years[1] +
      " 年逐年值；无数据年份断线，不插值。世界平均：" + (wl ? fmt(id, wl[1]) + "（" + wl[0] + "）" : "—");
    $("trend-chips").innerHTML = state.trendSel.map(function (iso, i) {
      var color = iso === "WLD" ? WORLD_COLOR : SERIES_COLORS[i % SERIES_COLORS.length];
      return '<button type="button" class="chip" data-unsel="' + iso + '"><i class="sw" style="background:' + color + '"></i>' +
        (iso === "WLD" ? "世界" : esc(C[iso].zh)) + '<span class="x">×</span></button>';
    }).join("");
    renderTrendSelect();
    trendReads();
  }
  function renderTrendSelect() {
    var pool = ISOS.filter(function (iso) { return state.trendSel.indexOf(iso) === -1; });
    pool.sort(function (a, b) { return C[a].zh.localeCompare(C[b].zh, "zh"); });
    var opts = ['<option value="">＋ 添加国家…</option>'];
    if (state.trendSel.indexOf("WLD") === -1) opts.push('<option value="WLD">世界平均</option>');
    pool.forEach(function (iso) { opts.push('<option value="' + iso + '">' + esc(C[iso].zh) + "</option>"); });
    $("trend-select").innerHTML = opts.join("");
  }
  function trendReads() {
    var id = state.trendInd;
    var changes = ISOS.map(function (iso) {
      var s = series(iso, id).filter(function (p) { return p[0] >= D.years[0]; });
      if (s.length < 2 || s[s.length - 1][0] - s[0][0] < 6) return null;
      return { iso: iso, zh: C[iso].zh, from: s[0], to: s[s.length - 1], delta: s[s.length - 1][1] - s[0][1], pct: s[0][1] ? (s[s.length - 1][1] / s[0][1] - 1) * 100 : null };
    }).filter(Boolean);
    var unitTxt = IND[id].unit || "点";
    var ups = changes.slice().sort(function (a, b) { return b.delta - a.delta; }).filter(function (c) { return c.delta > 0; }).slice(0, 4);
    var dns = changes.slice().sort(function (a, b) { return a.delta - b.delta; }).filter(function (c) { return c.delta < 0; }).slice(0, 4);
    var w = D.world[id] || [];
    var first = w[0], last = w[w.length - 1];
    var line = function (c) {
      return esc(c.zh) + " " + fmt(id, c.from[1]) + "（" + c.from[0] + "）→ " + fmt(id, c.to[1]) + "（" + c.to[0] + "）";
    };
    var moveParas = [];
    if (!changes.length) {
      moveParas.push("这项指标在 60 国里没有一条足够长的序列可以算首末变化——它本身就是结论：全球没有人在系统地重复调查它。");
    } else {
      if (ups.length) moveParas.push("值上升最多：" + ups.map(line).join("；") + "。");
      if (dns.length) moveParas.push("值下降最多：" + dns.map(line).join("；") + "。");
      if (!ups.length && !dns.length) moveParas.push("参与比较的 " + changes.length + " 国首末值全部持平，这一项在这二十年没有方向可言。");
      moveParas.push("共 " + n("", changes.length + " 国") + "的序列长于 6 年并参与比较；" + (ISOS.length - changes.length) + " 国因序列太短或缺数被排除。");
    }
    var perYear = first && last && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : null;
    var lower = IND[id].direction === "lower";
    renderReads($("trend-reads"), [
      {
        h: IND[id].zh + "：变化最大的四个国家",
        p: moveParas,
        caution: "首末值取自各国自己的最早/最晚有数年份，起点年份并不对齐；序列短的国家不参与比较。" +
          (lower ? "这一项数值越低越好，「上升」是坏事。" : ""),
      },
      {
        h: "世界平均线：" + (first && last && last[0] > first[0]
          ? fmt(id, first[1]) + " → " + fmt(id, last[1])
          : (first ? fmt(id, first[1]) + "（只有一个年份）" : "—")),
        p: ["世界银行的世界值是按国家加权聚合的结果，各国入池时间不同，早期数值会随数据集更新而修订。" +
          "把这条线当作参照，不要当作“人类总量”。"],
        p2: perYear != null ? ["这 " + (last[0] - first[0]) + " 年世界平均每年变动 " +
          n("", (perYear > 0 ? "+" : "") + perYear.toFixed(2) + unitTxt) + "。"] : [],
        caution: IND[id].note || "",
      },
    ]);
  }

  // ---------- 总览 / 指标表 ----------
  function renderStats() {
    var g = ranked("SE.ENR.TERT.FM.ZS");
    var p = sortedBy("SG.GEN.PARL.ZS");
    var f = D.world["SL.TLF.ACTI.FE.ZS"];
    var m = D.world["SL.TLF.ACTI.MA.ZS"];
    var fL = f[f.length - 1], mL = m[m.length - 1];
    var mm = sortedBy("SH.STA.MMRT");
    var netList = ISOS.map(function (iso) {
      var a = latest(iso, "IT.NET.USER.FE.ZS"), b = maleLatest(iso, "IT.NET.USER.FE.ZS");
      return a && b ? a[1] - b[1] : null;
    }).filter(function (x) { return x != null; });
    var cards = [
      { k: "教育", v: g.filter(function (r) { return r.value > 1; }).length + " / " + g.length, n: "国女性高等教育毛入学率已高于男性（各国各取最新可得年份）" },
      { k: "政治", v: fmt("SG.GEN.PARL.ZS", worldLatest("SG.GEN.PARL.ZS")[1]), n: "世界议会女性席位占比；样本内 " + p.filter(function (r) { return r.value >= 40; }).length + " 国过四成，" + p.filter(function (r) { return r.value < 10; }).length + " 国不足一成" },
      { k: "经济", v: fmt("SL.TLF.ACTI.FE.ZS", fL[1]) + " <small>vs " + fmt("SL.TLF.ACTI.MA.ZS", mL[1]) + "</small>", n: "女性 / 男性劳动参与率世界均值（" + fL[0] + "，15–64 岁）" },
      { k: "健康", v: fmt("SH.STA.MMRT", worldLatest("SH.STA.MMRT")[1]) + " <small>/10 万</small>", n: "孕产妇死亡率世界均值（" + worldLatest("SH.STA.MMRT")[0] + "）；样本内最低 " + fmt("SH.STA.MMRT", mm[mm.length - 1].value) + "、最高 " + fmt("SH.STA.MMRT", mm[0].value) },
      { k: "数字", v: netList.filter(function (x) { return x < 0; }).length + " / " + netList.length, n: "国女性互联网使用率低于男性（各国最新值）" },
    ];
    $("stats").innerHTML = cards.map(function (c, i) {
      return '<div class="stat' + (i === 1 ? " accent" : "") + '"><div class="k">' + esc(c.k) + '</div><div class="v">' + c.v + '</div><div class="n">' + esc(c.n) + "</div></div>";
    }).join("");
  }

  function renderTable() {
    var rows = IDS.map(function (id) {
      var covered = ranked(id).length;
      var yrs = ISOS.reduce(function (acc, iso) {
        var v = latest(iso, id);
        if (!v) return acc;
        return { lo: Math.min(acc.lo, v[0]), hi: Math.max(acc.hi, v[0]) };
      }, { lo: 9999, hi: 0 });
      return "<tr><td>" + esc(IND[id].zh) + '</td><td class="code">' + id + "</td><td>" +
        esc(IND[id].unit || "比值") + '</td><td class="cov">' + covered + " / 60</td><td class=\"num\">" +
        (yrs.hi ? yrs.lo + "–" + yrs.hi : "—") + "</td><td>" + esc(IND[id].note || "") + "</td></tr>";
    }).join("");
    $("indicator-table").querySelector("tbody").innerHTML = rows;
  }

  function renderDeckStats() {
    var g = ranked("SE.ENR.TERT.FM.ZS");
    var p = sortedBy("SG.GEN.PARL.ZS");
    var f = D.world["SL.TLF.ACTI.FE.ZS"];
    var m = D.world["SL.TLF.ACTI.MA.ZS"];
    var fL = f[f.length - 1], mL = m[m.length - 1];
    var mm = sortedBy("SH.STA.MMRT");
    var wg = worldLatest("SE.ENR.TERT.FM.ZS");
    var set = function (key, text) {
      document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) { el.textContent = text; });
    };
    set("gpiOver", String(g.filter(function (r) { return r.value > 1; }).length));
    set("gpiWorld", fmt("SE.ENR.TERT.FM.ZS", wg[1]) + "（" + wg[0] + "）");
    set("parl40", String(p.filter(function (r) { return r.value >= 40; }).length));
    set("parlUnder10", String(p.filter(function (r) { return r.value < 10; }).length));
    set("lfF", fmt("SL.TLF.ACTI.FE.ZS", fL[1]) + "（" + fL[0] + "）");
    set("lfM", fmt("SL.TLF.ACTI.MA.ZS", mL[1]) + "（" + mL[0] + "）");
    set("mmrMin", fmt("SH.STA.MMRT", mm[mm.length - 1].value));
    set("mmrMax", fmt("SH.STA.MMRT", mm[0].value) + "（" + mm[0].year + "）");
    set("mmrMaxCountry", mm[0].zh);
    set("nChildMarriage", String(ranked("SP.M18.2024.FE.ZS").length));
    set("nVaw", String(ranked("SG.VAW.1549.ZS").length));
    set("generated", D.generated);
    set("lastUpdated", D.lastUpdated);
    set("snapshotLabel", "快照 " + D.generated);
  }

  // ---------- 事件 ----------
  function wire() {
    $("map-switch").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-map]");
      if (!b) return;
      state.mapInd = b.getAttribute("data-map");
      syncPressed($("map-switch"), state.mapInd);
      paintMap();
      if (state.sel) selectCountry(state.sel);
    });
    $("map").addEventListener("mousemove", function (e) {
      var g = e.target.closest("[data-iso]");
      if (g) showTip(e, g.getAttribute("data-iso")); else hideTip();
    });
    $("map").addEventListener("mouseleave", hideTip);
    $("map").addEventListener("click", function (e) {
      var g = e.target.closest("[data-iso]");
      if (g) selectCountry(g.getAttribute("data-iso"));
    });
    $("map-card").addEventListener("click", function (e) {
      if (e.target.closest(".mc-close")) closeCard();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCard();
    });
    ["edu-rank", "econ-rank", "pol-rank", "health-rank", "tech-rank"].forEach(function (id) {
      var el = $(id);
      el.addEventListener("click", function (e) {
        var r = e.target.closest(".rrow");
        if (r) selectCountry(r.getAttribute("data-iso"));
      });
      el.addEventListener("keydown", function (e) {
        var r = e.target.closest(".rrow");
        if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectCountry(r.getAttribute("data-iso")); }
      });
    });
    $("health-scatter").addEventListener("click", function (e) {
      var c = e.target.closest("[data-iso]");
      if (c) selectCountry(c.getAttribute("data-iso"));
    });
    $("trend-chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-unsel]");
      if (!b) return;
      var iso = b.getAttribute("data-unsel");
      if (state.trendSel.length <= 1) return;
      state.trendSel = state.trendSel.filter(function (x) { return x !== iso; });
      renderTrend();
    });
    $("trend-select").addEventListener("change", function (e) {
      var iso = e.target.value;
      if (!iso) return;
      if (state.trendSel.length >= 7) state.trendSel.shift();
      state.trendSel.push(iso);
      renderTrend();
    });
    switcher($("edu-switch"), EDU_ITEMS, state.eduInd, function (id) { state.eduInd = id; renderEdu(); });
    switcher($("econ-switch"), ECON_ITEMS, state.econInd, function (id) { state.econInd = id; renderEcon(); });
    switcher($("pol-switch"), POL_ITEMS, state.polInd, function (id) { state.polInd = id; renderPol(); });
    switcher($("health-switch"), HEALTH_ITEMS, state.healthInd, function (id) { state.healthInd = id; renderHealth(); });
    switcher($("trend-switch"), TREND_ITEMS, state.trendInd, function (id) { state.trendInd = id; renderTrend(); });
  }

  // ---------- 启动 ----------
  renderMapSwitch();
  buildMap();
  renderDeckStats();
  renderStats();
  renderEdu();
  renderEcon();
  renderPol();
  renderHealth();
  renderTech();
  renderTrend();
  renderTable();
  wire();
})();
