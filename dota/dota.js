/**
 * Dota 2 数据战报 · 页面控制器
 * 数据：../data/dota/snapshot.json（构建时快照，见 scripts/fetch_dota.mjs）
 * 分析：./analysis.js   图表：./charts.js
 */
import { analyze } from './analysis.js';
import { winrateRing, barChart, monthlyActivity, heatmap, donut } from './charts.js';

const SNAPSHOT_URL = '../data/dota/snapshot.json';
const LOCAL_AVATAR = '../assets/dota/avatar.jpg';
const OPENDOTA = 'https://www.opendota.com';

const COLORS = {
  radiant: '#5ee08a',
  dire: '#ff6b6b',
  gold: '#e5c15c',
  blue: '#5aa9ff',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  muted: '#8b93a7',
};
const PALETTE = [COLORS.blue, COLORS.radiant, COLORS.gold, COLORS.purple, COLORS.cyan, COLORS.dire];

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const KIND_LABELS = {
  signature: '绝活',
  mode: '模式',
  time: '作息',
  streak: '连胜',
  peer: '搭子',
  volume: '产量',
  habit: '习惯',
  side: '阵营',
};
const KIND_GLYPHS = {
  signature: '✦',
  mode: '◈',
  time: '◷',
  streak: '↯',
  peer: '⌘',
  volume: '▮',
  habit: '≈',
  side: '◐',
};

const state = { snapshot: null, analysis: null, filter: 'all' };

/* ---------------- 基础工具 ---------------- */
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function pct(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return (value * 100).toFixed(digits) + '%';
}

function num(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US');
}

/** 大数字转中文量级：3,038 万 / 1.21 亿 */
function compact(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e8) return (value / 1e8).toFixed(2) + ' 亿';
  if (abs >= 1e4) return (value / 1e4).toFixed(abs >= 1e6 ? 0 : 1) + ' 万';
  return num(value);
}

function hours(value) {
  if (value == null) return '—';
  return num(Math.round(value));
}

const DATE_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const DATETIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function fmtDate(epochSeconds) {
  if (!epochSeconds) return '—';
  return DATE_FMT.format(new Date(epochSeconds * 1000)).replaceAll('/', '-');
}

function fmtDateTime(value) {
  if (!value) return '—';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return DATETIME_FMT.format(date).replaceAll('/', '-');
}

function hrText(value) {
  if (value == null) return '—';
  return Math.round(value * 10) / 10 + ' 小时';
}

/* ---------------- 英雄元数据 ---------------- */
function heroMeta(heroId) {
  const meta = state.snapshot && state.snapshot.heroes_meta;
  return (meta && meta[String(heroId)]) || null;
}

function heroZh(heroId) {
  const meta = heroMeta(heroId);
  return (meta && meta.zh) || ('#' + heroId);
}

function imgTag(src, alt, className, loading = 'lazy') {
  if (!src) return '';
  return '<img class="' + (className || '') + '" src="' + esc(src) + '" alt="' + esc(alt) +
    '" loading="' + loading + '" decoding="async" onerror="this.remove()">';
}

function heroIconTag(heroId, className) {
  const meta = heroMeta(heroId);
  return imgTag(meta && meta.icon, heroZh(heroId), className || 'hero-icon');
}

function wrClass(winrate) {
  if (winrate == null) return 'wr-low';
  if (winrate >= 0.55) return 'wr-high';
  if (winrate >= 0.45) return 'wr-mid';
  return 'wr-low';
}

function medalFor(rank) {
  const tier = rank.tier || 0;
  const stars = rank.stars || 0;
  const tierName = rank.tierName || '未知段位';
  const badge = tier >= 8
    ? 'IMMORTAL'
    : stars > 0 ? '★'.repeat(stars) : '—';
  return '<div class="medal" data-tier="' + tier + '">' +
    '<span class="medal-glyph" aria-hidden="true">✦</span>' +
    '<span class="medal-text"><b>' + esc(tierName) + '</b><i>' + esc(badge) +
    (rank.leaderboardRank ? ' · 排行榜 #' + rank.leaderboardRank : '') + '</i></span>' +
    '</div>';
}

/* ---------------- 渲染：顶部信息 ---------------- */
function renderMeta(a) {
  const total = (a.filters.find((f) => f.key === 'all') || a.filters[0] || {}).games || 0;
  const node = $('dataMeta');
  if (node) {
    node.innerHTML = '<span class="dot"></span>快照 ' + esc(fmtDateTime(a.generatedAt)) +
      ' · ' + num(total) + ' 场';
  }
}

/* ---------------- 渲染：Hero ---------------- */
function renderHero(a) {
  const filtersAll = a.filters.find((f) => f.key === 'all') || a.filters[0] || { games: 0 };
  const turbo = (a.filters.find((f) => f.key === 'turbo') || {}).games || 0;
  const deck = $('heroDeck');
  if (deck) {
    deck.innerHTML = '从 ' + esc(fmtDate(a.overview.firstMatchAt)) + ' 的第一场，到 ' +
      esc(fmtDate(a.overview.lastMatchAt)) + ' 的最近一场，OpenDota 记下 ' +
      '<b>' + num(filtersAll.games) + '</b> 场对局，其中快速模式 ' + num(turbo) + ' 场。' +
      '这一页把能拿到的数据全部摊开：英雄池、作息节律、开黑搭子、聊天口头禅，以及那些被 OpenDota 判定为「绝活」的英雄。';
  }

  const chips = $('heroChips');
  if (chips) {
    const topHero = a.heroes[0];
    const items = [
      ['当前筛选', a.filter.label],
      ['场次', a.overview.games + ' 场'],
      ['胜率', pct(a.overview.winrate)],
      ['游戏时长', hrText(a.overview.totalHours)],
      ['主玩英雄', topHero ? topHero.zh + ' · ' + topHero.games + ' 场' : '—'],
      ['天辉 / 夜魇', pct((a.side[0] || {}).winrate) + ' / ' + pct((a.side[1] || {}).winrate)],
    ];
    chips.innerHTML = items.map(([k, v]) =>
      '<span class="chip"><span class="chip-k">' + esc(k) + '</span><span class="chip-v">' + esc(v) + '</span></span>'
    ).join('');
  }

  const card = $('playerCard');
  if (!card) return;
  const profile = a.profile;
  const aliasesRaw = (profile.aliases || []).filter((name) => name && name !== profile.name);
  const aliases = aliasesRaw.length
    ? '曾用名：' + aliasesRaw.slice(-2).join(' · ')
    : '只用一个 ID';
  const steamUrl = state.snapshot.profile && state.snapshot.profile.profileurl
    ? state.snapshot.profile.profileurl
    : 'https://steamcommunity.com/profiles/' + (profile.steamid || '');
  card.innerHTML =
    '<div class="pc-top">' +
      '<div class="pc-avatar">' +
        '<img src="' + esc(LOCAL_AVATAR) + '" alt="' + esc(profile.name) + ' 的 Steam 头像" onerror="this.remove()">' +
        '<span class="pc-dot" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="pc-id">' +
        '<h2 class="pc-name">' + esc(profile.name) + '</h2>' +
        '<p class="pc-alias">' + esc(aliases) + '</p>' +
        '<a class="pc-steam" href="' + esc(steamUrl) + '" target="_blank" rel="noopener">steam 档案 ↗</a>' +
      '</div>' +
    '</div>' +
    '<div class="pc-rank">' +
      medalFor(a.profile.rank) +
      '<div class="pc-mmr">' +
        '<span class="pc-mmr-label">OpenDota 估算 MMR</span>' +
        '<span class="pc-mmr-value">' + (a.profile.rank.mmr == null ? '—' : Math.round(a.profile.rank.mmr)) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="pc-ring">' + winrateRing({
      winrate: a.overview.winrate,
      wins: a.overview.wins,
      losses: a.overview.losses,
      size: 200,
      thickness: 16,
    }) + '</div>' +
    '<p class="pc-foot">最近一局 ' + esc(fmtDate(a.overview.lastMatchAt)) +
      ' · 快照 ' + esc(fmtDateTime(a.generatedAt)) + '</p>';
}

/* ---------------- 渲染：筛选 ---------------- */
function renderFilterTabs(a) {
  const tabs = $('filterTabs');
  if (!tabs) return;
  tabs.innerHTML = a.filters.map((f) =>
    '<button type="button" class="filter-tab" data-filter="' + esc(f.key) + '" aria-pressed="' +
    (f.key === a.filter.key ? 'true' : 'false') + '">' +
    '<span class="filter-label">' + esc(f.label) + '</span>' +
    '<span class="filter-count">' + num(f.games) + '</span></button>'
  ).join('');
  const note = $('filterNote');
  if (note) note.textContent = '当前 ' + a.filter.games + ' 场';
}

/* ---------------- 渲染：总览 ---------------- */
function renderOverview(a) {
  const kpis = $('overviewKpis');
  if (kpis) {
    const ranked = (a.filters.find((f) => f.key === 'ranked') || {}).games || 0;
    const turbo = (a.filters.find((f) => f.key === 'turbo') || {}).games || 0;
    const cards = [
      { label: '对局', value: num(a.overview.games), sub: '胜 ' + num(a.overview.wins) + ' · 负 ' + num(a.overview.losses) },
      { label: '胜率', value: pct(a.overview.winrate), sub: '当前筛选 ' + num(a.overview.games) + ' 场' },
      { label: '场均时长', value: (a.overview.avgDurationMin == null ? '—' : a.overview.avgDurationMin + '′'), sub: '分钟 / 局' },
      { label: 'KDA', value: (a.overview.kda == null ? '—' : a.overview.kda.toFixed(2)), sub: '总量比 · 场均 ' + (a.overview.avgKills == null ? '—' : a.overview.avgKills + ' / ' + a.overview.avgDeaths + ' / ' + a.overview.avgAssists) },
      { label: '总时长', value: hrText(a.overview.totalHours), sub: '约 ' + (a.overview.totalHours / 24).toFixed(1) + ' 天' },
      { label: '天梯 / 快速', value: num(ranked) + ' / ' + num(turbo), sub: '场次（当前筛选下）' },
      { label: '最长连胜', value: String(a.streak.longestWin), sub: '最长连败 ' + a.streak.longestLoss },
      { label: '英雄池', value: String(a.heroPool ? a.heroPool.played : '—'), sub: '共 ' + (a.heroPool ? a.heroPool.available : '—') + ' 个英雄可选' },
    ];
    kpis.innerHTML = cards.map((c) =>
      '<div class="kpi-card"><span class="kpi-label">' + esc(c.label) + '</span>' +
      '<span class="kpi-value">' + esc(c.value) + '</span>' +
      '<span class="kpi-sub">' + esc(c.sub) + '</span></div>'
    ).join('');
  }

  const career = $('overviewCareer');
  if (career) {
    const c = a.career;
    const cells = [
      ['击杀', num(c.kills)],
      ['死亡', num(c.deaths)],
      ['助攻', num(c.assists)],
      ['英雄伤害', compact(c.heroDamage)],
      ['正补', compact(c.lastHits)],
      ['对建筑伤害', compact(c.towerDamage)],
      ['游戏内时长', hours(c.hours) + ' 小时'],
      ['ping', num(c.pings)],
    ];
    career.innerHTML = cells.map(([k, v]) =>
      '<div class="career-item"><span class="career-k">' + esc(k) + '</span>' +
      '<span class="career-v">' + esc(v) + '</span></div>'
    ).join('');
  }

  const facts = $('overviewFacts');
  if (facts) {
    facts.innerHTML = (a.facts || []).map((f) =>
      '<div class="fact-card"><span class="fact-label">' + esc(f.label) + '</span>' +
      '<span class="fact-value">' + esc(f.value) + '</span>' +
      '<span class="fact-hint">' + esc(f.hint || '') + '</span></div>'
    ).join('');
  }
}

/* ---------------- 渲染：机器观察 ---------------- */
function renderInsights(a) {
  const wrap = $('insightList');
  if (!wrap) return;
  wrap.innerHTML = (a.insights || []).map((item) =>
    '<article class="insight-card" data-kind="' + esc(item.kind) + '">' +
    '<span class="insight-kind">' + esc(KIND_LABELS[item.kind] || '观察') + '</span>' +
    '<span class="insight-glyph" aria-hidden="true">' + esc(KIND_GLYPHS[item.kind] || '◆') + '</span>' +
    '<h3>' + esc(item.title) + '</h3>' +
    '<p>' + esc(item.text) + '</p></article>'
  ).join('');
}

/* ---------------- 渲染：英雄池 ---------------- */
function heroTopCard(hero, index) {
  return '<article class="hero-top-card">' +
    '<span class="hero-top-rank">' + String(index + 1).padStart(2, '0') + '</span>' +
    '<a class="hero-top-art" href="' + OPENDOTA + '/heroes/' + hero.heroId + '" target="_blank" rel="noopener">' +
      imgTag(hero.img || hero.icon, hero.zh, 'hero-art') +
    '</a>' +
    '<div class="hero-top-info">' +
      '<h3>' + esc(hero.zh) + '<span class="hero-en">' + esc(hero.en || '') + '</span></h3>' +
      '<div class="hero-top-meta"><b>' + hero.games + '</b> 场 · 胜率 <b>' + pct(hero.winrate) + '</b></div>' +
      '<div class="wr-bar ' + wrClass(hero.winrate) + '"><i style="width:' + Math.round(hero.winrate * 100) + '%"></i></div>' +
      '<div class="hero-top-sub">KDA ' + (hero.kda == null ? '—' : hero.kda.toFixed(2)) +
        ' · 场均 ' + (hero.avgDurationMin == null ? '—' : hero.avgDurationMin) + ' 分钟' +
        (hero.percentRank != null ? ' · 绝活指数 ' + pct(hero.percentRank, 2) : '') +
      '</div>' +
    '</div>' +
  '</article>';
}

function heroRankRow(hero) {
  return '<a class="rank-row" href="' + OPENDOTA + '/heroes/' + hero.heroId + '" target="_blank" rel="noopener">' +
    heroIconTag(hero.heroId, 'hero-icon-sm') +
    '<span class="rank-name">' + esc(hero.zh) + '</span>' +
    '<span class="rank-wr ' + wrClass(hero.winrate) + '">' + pct(hero.winrate) + '</span>' +
    '<span class="rank-games">' + hero.games + ' 场</span>' +
    '<span class="rank-bar"><i style="width:' + Math.round(hero.winrate * 100) + '%"></i></span>' +
  '</a>';
}

function renderHeroes(a) {
  const top = $('topHeroes');
  if (top) {
    top.innerHTML = (a.heroes || []).slice(0, 8).map(heroTopCard).join('');
  }

  const best = $('bestHeroes');
  if (best) best.innerHTML = (a.bestHeroes || []).map(heroRankRow).join('') || '<p class="empty">样本不足。</p>';
  const worst = $('worstHeroes');
  if (worst) worst.innerHTML = (a.worstHeroes || []).map(heroRankRow).join('') || '<p class="empty">样本不足。</p>';

  const wall = $('heroWall');
  if (wall) {
    wall.innerHTML = (a.heroes || []).map((hero) =>
      '<a class="wall-cell ' + wrClass(hero.winrate) + '" data-wr="' + (hero.winrate == null ? 0 : hero.winrate.toFixed(3)) +
      '" href="' + OPENDOTA + '/heroes/' + hero.heroId + '" target="_blank" rel="noopener" ' +
      'title="' + esc(hero.zh + ' · ' + hero.games + ' 场 · 胜率 ' + pct(hero.winrate) + ' · KDA ' + (hero.kda == null ? '—' : hero.kda.toFixed(2))) + '">' +
      heroIconTag(hero.heroId, 'wall-icon') +
      '<span class="wall-name">' + esc(hero.zh) + '</span>' +
      '<span class="wall-games">' + hero.games + '</span></a>'
    ).join('');
  }
  const wallTag = $('heroWallTag');
  if (wallTag && a.heroPool) wallTag.textContent = a.heroPool.played + ' / ' + a.heroPool.available + ' 个英雄';

  const attrBars = $('attrBars');
  if (attrBars) {
    attrBars.innerHTML = (a.heroPool && a.heroPool.attrs || []).map((attr) =>
      '<div class="attr-row"><span class="attr-name">' + esc(attr.label) + '</span>' +
      '<span class="attr-track"><i style="width:' + Math.round((attr.share || 0) * 100) + '%"></i></span>' +
      '<span class="attr-value">' + attr.games + ' 场 · ' + pct(attr.share) + '</span></div>'
    ).join('');
  }

  const roleBars = $('roleBars');
  if (roleBars) {
    const roles = (a.heroPool && a.heroPool.roles) || [];
    const maxRole = roles.reduce((m, r) => Math.max(m, r.games), 1);
    roleBars.innerHTML = roles.map((role) =>
      '<div class="attr-row"><span class="attr-name">' + esc(role.role) + '</span>' +
      '<span class="attr-track"><i style="width:' + Math.round((role.games / maxRole) * 100) + '%"></i></span>' +
      '<span class="attr-value">' + role.games + ' 场</span></div>'
    ).join('');
  }
}

/* ---------------- 渲染：绝活榜 ---------------- */
function renderSignature(a) {
  const chart = $('signatureChart');
  if (!chart) return;
  const items = (a.signature || []).slice(0, 12).map((s, index) => ({
    label: s.zh,
    value: (s.percentRank || 0) * 100,
    hint: s.games + ' 场 · 胜率 ' + pct(s.winrate),
    color: PALETTE[index % PALETTE.length],
  }));
  chart.innerHTML = items.length
    ? barChart({ items, horizontal: true, width: 900, height: Math.max(240, items.length * 34), valueFormat: (v) => v.toFixed(2) + '%', labelWidth: 108 })
    : '<p class="empty">还没有足够的绝活数据。</p>';

  const note = $('signatureNote');
  if (note) {
    const top = (a.signature || []).slice(0, 3);
    note.innerHTML = top.length
      ? '最接近「只有你会玩」的是：' + top.map((s) =>
          '<b>' + esc(s.zh) + '</b>（' + pct(s.percentRank, 2) + '，' + s.games + ' 场）'
        ).join('、') + '。百分位越高，说明在这个英雄上你比越多玩家打得好。'
      : '暂无绝活数据。';
  }
}

/* ---------------- 渲染：时间节律 ---------------- */
function renderRhythm(a) {
  const monthly = $('monthlyChart');
  if (monthly) {
    monthly.innerHTML = (a.monthly || []).length
      ? monthlyActivity({ items: a.monthly, width: 960, height: 280 })
      : '<p class="empty">暂无数据。</p>';
  }
  const heat = $('heatmapChart');
  if (heat) {
    heat.innerHTML = (a.heatmap || []).length
      ? heatmap({ cells: a.heatmap, width: 960, height: 300 })
      : '<p class="empty">暂无数据。</p>';
  }

  const stats = $('rhythmStats');
  if (stats) {
    const byGames = (arr) => arr.slice().sort((x, y) => y.games - x.games)[0];
    const peakMonth = byGames(a.monthly || []);
    const peakHour = byGames(a.hourly || []);
    const peakDow = byGames(a.weekday || []);
    const activeHours = (a.hourly || []).filter((h) => h.games >= 20);
    const bestHour = activeHours.slice().sort((x, y) => (y.winrate || 0) - (x.winrate || 0))[0];
    const cards = [];
    if (peakMonth) {
      cards.push(['最活跃月份', peakMonth.key.replace('-', ' 年 ') + ' 月', peakMonth.games + ' 场 · 胜率 ' + pct(peakMonth.winrate)]);
    }
    if (peakHour) {
      cards.push(['最常开打时段', peakHour.hour + ':00 — ' + ((peakHour.hour + 1) % 24) + ':00', peakHour.games + ' 场 · 胜率 ' + pct(peakHour.winrate)]);
    }
    if (bestHour) {
      cards.push(['胜率最高时段', bestHour.hour + ':00 — ' + ((bestHour.hour + 1) % 24) + ':00', pct(bestHour.winrate) + ' · ' + bestHour.games + ' 场']);
    }
    if (peakDow) {
      cards.push(['最常打的日子', peakDow.label, peakDow.games + ' 场 · 胜率 ' + pct(peakDow.winrate)]);
    }
    stats.innerHTML = cards.map(([k, v, s]) =>
      '<div class="rhythm-stat"><span class="rhythm-k">' + esc(k) + '</span>' +
      '<span class="rhythm-v">' + esc(v) + '</span>' +
      '<span class="rhythm-s">' + esc(s) + '</span></div>'
    ).join('');
  }

  const side = $('sideChart');
  if (side) {
    side.innerHTML = (a.side || []).map((s) =>
      '<div class="side-col side-' + esc(s.key) + '">' +
      '<span class="side-label">' + esc(s.label) + '</span>' +
      '<span class="side-games">' + s.games + ' 场</span>' +
      '<span class="side-wr">' + pct(s.winrate) + '</span>' +
      '<span class="side-bar"><i style="width:' + Math.round((s.winrate || 0) * 100) + '%"></i></span>' +
      '<span class="side-sub">' + s.wins + ' 胜 / ' + (s.games - s.wins) + ' 负</span>' +
      '</div>'
    ).join('');
  }

  const mode = $('modeChart');
  if (mode) {
    const slices = (a.modes || []).slice(0, 6).map((m, index) => ({ label: m.label, value: m.games, color: PALETTE[index % PALETTE.length] }));
    mode.innerHTML = slices.length
      ? donut({ slices, size: 200, thickness: 28, centerValue: num(a.overview.games), centerLabel: '场' }) +
        '<div class="legend">' + slices.map((s) =>
          '<span class="legend-item"><i style="background:' + s.color + '"></i>' + esc(s.label) + ' · ' + s.value + '</span>'
        ).join('') + '</div>'
      : '<p class="empty">暂无数据。</p>';
  }

  const lobby = $('lobbyChart');
  if (lobby) {
    const items = (a.lobbies || []).slice(0, 6).map((l) => ({
      label: l.label,
      value: l.games,
      hint: '胜率 ' + pct(l.winrate),
    }));
    lobby.innerHTML = items.length
      ? barChart({ items, horizontal: true, width: 360, height: Math.max(120, items.length * 38), color: COLORS.gold, labelWidth: 78 })
      : '<p class="empty">暂无数据。</p>';
  }
}

/* ---------------- 渲染：最近二十场 ---------------- */
function renderRecent(a) {
  const recent = a.recent;
  const kpis = $('recentKpis');
  if (kpis && recent) {
    const cards = [
      { label: '近 20 场', value: recent.wins + ' 胜 ' + (recent.count - recent.wins) + ' 负', sub: '胜率 ' + pct(recent.winrate) },
      { label: 'KDA', value: (recent.kda == null ? '—' : recent.kda.toFixed(2)), sub: '最近 20 场平均' },
      { label: 'GPM / XPM', value: num(recent.avgGpm) + ' / ' + num(recent.avgXpm), sub: '含快速模式，会偏高' },
      { label: '场均伤害', value: compact(recent.avgHeroDamage), sub: '正补 ' + num(recent.avgLastHits) + ' / 局' },
    ];
    kpis.innerHTML = cards.map((c) =>
      '<div class="kpi-card"><span class="kpi-label">' + esc(c.label) + '</span>' +
      '<span class="kpi-value">' + esc(c.value) + '</span>' +
      '<span class="kpi-sub">' + esc(c.sub) + '</span></div>'
    ).join('');
  }

  const strip = $('recentStrip');
  if (strip) {
    const items = (recent && recent.items || []).slice().reverse();
    strip.innerHTML = items.map((m) =>
      '<a class="strip-cell ' + (m.win ? 'win' : 'loss') + '" href="' + OPENDOTA + '/matches/' + m.matchId +
      '" target="_blank" rel="noopener" title="' + esc(m.zh + ' · ' + m.kills + '/' + m.deaths + '/' + m.assists + ' · ' + m.durationMin + ' 分钟 · ' + (m.win ? '胜' : '负')) + '">' +
      heroIconTag(m.heroId, 'strip-icon') + '</a>'
    ).join('');
    const tag = $('recentStripTag');
    if (tag && recent) tag.textContent = '左旧右新 · 绿=胜 红=负';
  }

  const list = $('recentList');
  if (list) {
    list.innerHTML = (recent && recent.items || []).map((m) =>
      '<a class="match-row" href="' + OPENDOTA + '/matches/' + m.matchId + '" target="_blank" rel="noopener">' +
      '<span class="match-res ' + (m.win ? 'win' : 'loss') + '">' + (m.win ? '胜' : '负') + '</span>' +
      '<span class="match-hero">' + heroIconTag(m.heroId, 'match-icon') + '<b>' + esc(m.zh) + '</b></span>' +
      '<span class="match-kda">' + m.kills + ' / ' + m.deaths + ' / ' + m.assists + '</span>' +
      '<span class="match-dur">' + m.durationMin + '′</span>' +
      '<span class="match-mode">' + esc(m.gameModeLabel || '') + '</span>' +
      '<span class="match-gpm">' + num(m.gpm) + ' GPM</span>' +
      '<span class="match-time">' + esc(fmtDate(m.startTime)) + '</span>' +
      '</a>'
    ).join('');
  }
}

/* ---------------- 渲染：开黑搭子 ---------------- */
function renderPeers(a) {
  const peers = a.peers || [];
  const tagline = $('peerTagline');
  if (tagline) {
    if (!peers.length) {
      tagline.textContent = '没有记录到同队玩家。';
    } else {
      const most = peers[0];
      const bestDuo = peers.filter((p) => p.games >= 10).slice().sort((x, y) => y.winrate - x.winrate)[0] || most;
      tagline.innerHTML = '共记录 <b>' + peers.length + '</b> 位同队玩家。最常一起打的是 <b>' + esc(most.name) + '</b>（' + most.games + ' 场，' + pct(most.winrate) + ' 胜率）；' +
        '搭档胜率最高的是 <b>' + esc(bestDuo.name) + '</b>（' + pct(bestDuo.winrate) + '，' + bestDuo.games + ' 场）。';
    }
  }

  const grid = $('peerGrid');
  if (grid) {
    const bestDuo = peers.filter((p) => p.games >= 10).slice().sort((x, y) => y.winrate - x.winrate)[0];
    const most = peers[0];
    let shown = peers.slice(0, 12);
    // 保证「最佳搭子」一定出现在卡片里（即使同队场次排不进前 12）
    if (bestDuo && !shown.some((p) => p.accountId === bestDuo.accountId)) shown = shown.slice(0, 11).concat(bestDuo);
    grid.innerHTML = shown.map((p) => {
      const badge = bestDuo && p.accountId === bestDuo.accountId ? '最佳搭子'
        : most && p.accountId === most.accountId ? '最常开黑' : '';
      return '<a class="peer-card" href="' + OPENDOTA + '/players/' + p.accountId + '" target="_blank" rel="noopener">' +
        '<span class="peer-avatar">' + imgTag(p.avatar, p.name + ' 的头像', 'peer-img') + '</span>' +
        '<span class="peer-info"><span class="peer-name">' + esc(p.name) + '</span>' +
        '<span class="peer-games">' + p.games + ' 场 · 胜率 ' + pct(p.winrate) + '</span>' +
        '<span class="peer-bar ' + wrClass(p.winrate) + '"><i style="width:' + Math.round((p.winrate || 0) * 100) + '%"></i></span>' +
        (badge ? '<span class="peer-badge">' + badge + '</span>' : '') +
        '</span></a>';
    }).join('');
  }
}

/* ---------------- 渲染：聊天词云 ---------------- */
function renderWordCloud(a) {
  const wrap = $('wordCloud');
  const words = a.wordcloud || [];
  if (wrap) {
    if (!words.length) {
      wrap.innerHTML = '<p class="empty">没有可用的聊天词频数据。</p>';
    } else {
      const max = words[0].count || 1;
      const min = words[words.length - 1].count || 1;
      wrap.innerHTML = words.map((w, index) => {
        const t = max === min ? 0.5 : (w.count - min) / (max - min);
        const size = (0.95 + Math.pow(t, 0.7) * 1.9).toFixed(2);
        const weight = t > 0.55 ? '700' : t > 0.25 ? '500' : '400';
        const level = 1 + Math.min(4, Math.floor(t * 5));
        return '<span class="wc wc-' + level + '" style="font-size:' + size + 'rem;font-weight:' + weight + '" title="' +
          esc(w.word + ' · ' + w.count + ' 次') + '">' + esc(w.word) + '</span>';
      }).join('');
    }
  }
  const note = $('wordNote');
  if (note) {
    const top = words.slice(0, 4);
    note.innerHTML = top.length
      ? '说得最多的是 ' + top.map((w) => '<b>「' + esc(w.word) + '」</b>（' + w.count + ' 次）').join('、') + '。'
      : '';
  }
}

/* ---------------- 渲染：方法与口径 ---------------- */
function renderMethod(a) {
  const updated = $('methodUpdated');
  if (updated) updated.textContent = fmtDateTime(a.generatedAt);
  const count = $('methodCount');
  if (count) {
    const all = (a.filters.find((f) => f.key === 'all') || {}).games || 0;
    const turbo = (a.filters.find((f) => f.key === 'turbo') || {}).games || 0;
    count.textContent = ' ' + all + ' 场（含 ' + turbo + ' 场快速模式）';
  }
}

/* ---------------- 入场动画 ---------------- */
let observer = null;
function observeReveal() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.section, .panel, .kpi-card, .insight-card, .hero-top-card, .peer-card').forEach((el) => el.classList.add('is-in'));
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  document.querySelectorAll('.section, .panel, .kpi-card, .insight-card, .hero-top-card, .peer-card').forEach((el) => {
    if (!el.classList.contains('is-in')) observer.observe(el);
  });
}

/* ---------------- 主渲染 ---------------- */
function render() {
  if (!state.snapshot) return;
  const analysis = analyze(state.snapshot, state.filter);
  state.analysis = analysis;
  renderMeta(analysis);
  renderHero(analysis);
  renderFilterTabs(analysis);
  renderOverview(analysis);
  renderInsights(analysis);
  renderHeroes(analysis);
  renderSignature(analysis);
  renderRhythm(analysis);
  renderRecent(analysis);
  renderPeers(analysis);
  renderWordCloud(analysis);
  renderMethod(analysis);
  observeReveal();
}

/* ---------------- 交互 ---------------- */
function bindEvents() {
  const tabs = $('filterTabs');
  if (tabs) {
    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      const key = button.getAttribute('data-filter');
      if (!key || key === state.filter) return;
      state.filter = key;
      render();
      const bar = $('filterBar');
      if (bar && window.scrollY > bar.offsetTop + 200) {
        // 用户已经滚到内容区，切换后保持在原位即可
      }
    });
  }

  // 顶部导航平滑滚动由 CSS scroll-behavior 处理
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.activeElement && document.activeElement.blur && document.activeElement.blur();
    }
  });
}

/* ---------------- 启动 ---------------- */
function revealStaticContent() {
  document.querySelectorAll('.section, .panel, .kpi-card, .insight-card, .hero-top-card, .peer-card')
    .forEach((el) => el.classList.add('is-in'));
}

function showFatal(error) {
  const box = $('fatal');
  const msg = $('fatalMsg');
  if (msg) msg.textContent = '读取快照失败：' + (error && error.message ? error.message : String(error));
  if (box) box.hidden = false;
  const meta = $('dataMeta');
  if (meta) meta.innerHTML = '<span class="dot dot-error"></span>数据加载失败';
  // 快照挂了也让静态文案可见，并提供「先看静态内容」的出口
  revealStaticContent();
  const close = $('fatalClose');
  if (close) {
    close.addEventListener('click', () => {
      if (box) box.hidden = true;
    });
  }
  console.error('[dota-report]', error);
}

async function boot() {
  try {
    const response = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + SNAPSHOT_URL);
    const snapshot = await response.json();
    if (!snapshot || snapshot.schema_version !== 1) throw new Error('快照结构不匹配（schema_version）');
    state.snapshot = snapshot;
    bindEvents();
    render();
  } catch (error) {
    showFatal(error);
  }
}

boot();
