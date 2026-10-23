/**
 * Dota 2 数据战报 · 纯分析引擎
 * ------------------------------------------------------------
 * 契约：tmp/contracts/analysis-api.md（字段名 / 层级 / 口径必须一致）
 * 输入：data/dota/snapshot.json（schema_version = 1，见 tmp/contracts/snapshot-schema.md）
 * 要求：纯函数 ESM，无 DOM、无网络、无第三方依赖；浏览器 <script type="module"> 与
 *       node:test（dota/analysis.test.mjs）共用。winrate 一律 0..1 原始小数，
 *       百分比格式化交给页面。
 *
 * 契约未写死、由本模块采用的约定（实现取舍，测试中也有覆盖）：
 * - KDA 统一用「总量比」(Σkills + Σassists) / Σdeaths（overview / career / heroes / recent
 *   同一口径；deaths = 0 时返回 null，不返回 Infinity）；
 * - 月份 / 小时 / 星期统一按 UTC+8（Asia/Shanghai）归组，与站点主要读者一致；
 * - streak 基于「当前筛选后」的对局序列；career / recent / peers / wordcloud 固定为全量；
 * - 空数据：overview / 各项桶的 winrate 为 null，均值类字段为 0；insights 给 1 条空态、
 *   facts 为 []（没有可换算的真实数字，不硬凑）；
 * - 输入缺字段（heroes_meta、rankings、totals、rank、aliases 等）一律零值兜底，不抛错；
 * - 以 /totals 为准的 career 若快照缺 totals，则用 matches 里可得的 kills/deaths/assists/
 *   duration 兜底（仍不受筛选影响）。
 */

/* ============================================================
 * 一、对外常量（与契约逐字一致）
 * ============================================================ */

export const FILTERS = [
  { key: 'all', label: '全部对局' },
  { key: 'ranked', label: '天梯' }, // lobby_type === 7
  { key: 'turbo', label: '快速模式' }, // game_mode === 23
  { key: 'serious', label: '非快速' }, // game_mode !== 23
  { key: 'normal', label: '普通匹配' }, // lobby_type === 0
];

export const GAME_MODE_LABELS = {
  1: '全英雄选择',
  2: '队长模式',
  3: '随机征召',
  4: '单排征召',
  5: '全随机',
  12: '最少选择',
  13: '有限英雄',
  16: '队长征召',
  18: '技能征召',
  22: '全英雄选择',
  23: '快速模式',
};

export const LOBBY_LABELS = {
  0: '普通匹配',
  1: '练习赛',
  4: '人机',
  5: '天梯组队',
  6: '天梯单排',
  7: '天梯匹配',
  14: '新手匹配',
};

export const ATTR_LABELS = { str: '力量', agi: '敏捷', int: '智力', all: '全才' };

export const ATTR_ORDER = ['str', 'agi', 'int', 'all'];

/* ============================================================
 * 二、内部常量
 * ============================================================ */

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
// rank_tier = 段位 * 10 + 星级；80 = 不朽（无星）
const RANK_TIER_NAMES = [null, '先锋', '卫士', '十字军', '执政官', '传奇', '远古', '神圣', '不朽'];

// 页面目标读者在中国，月份 / 小时 / 星期按 UTC+8 归组
const TZ_OFFSET_SECONDS = 8 * 3600;

const HERO_MIN_GAMES = 8; // best / worst 榜单的样本门槛
const BEST_HERO_LIMIT = 8;
const WORST_HERO_LIMIT = 6;
const SIGNATURE_MIN_GAMES = 20; // 绝活洞见的场次门槛
const SIGNATURE_LIMIT = 12;
const WORD_MIN_COUNT = 3; // 词云过滤噪声词
const WORD_LIMIT = 48;
// 词云停用词：过滤单字母词与常见英文虚词（保留 swap / gg / bro / end / mid / report 这类游戏用语）
const WORD_STOPWORDS = new Set([
  'the', 'and', 'you', 'your', 'youre', 'is', 'to', 'of', 'it', 'in', 'that', 'this', 'for', 'on',
  'my', 'we', 'he', 'she', 'so', 'be', 'are', 'was', 'were', 'just', 'now', 'all', 'not', 'no',
  'ok', 'okay', 'im', 'dont', 'can', 'will', 'do', 'if', 'at', 'by', 'or', 'an', 'as', 'up', 'out',
  'get', 'got', 'hi', 'ye', 'yeah', 'ah', 'oh', 'have', 'has', 'had', 'me', 'them', 'they', 'their',
  'there', 'then', 'than', 'with', 'from', 'but', 'about', 'into', 'over', 'very', 'much', 'some',
  'any', 'more', 'most', 'been', 'being', 'would', 'could', 'should', 'what', 'who', 'how', 'why',
  'when', 'where', 'here', 'his', 'her', 'its', 'our', 'us', 'am', 'too', 'also',
]);

const FILTER_PREDICATES = {
  all: () => true,
  ranked: (match) => numberOrNull(match.lobby_type) === 7,
  turbo: (match) => numberOrNull(match.game_mode) === 23,
  serious: (match) => numberOrNull(match.game_mode) !== 23,
  normal: (match) => numberOrNull(match.lobby_type) === 0,
};

/* ============================================================
 * 三、通用工具
 * ============================================================ */

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 数字或 null（'' / null / NaN / Infinity / boolean 都当成 null）。 */
function numberOrNull(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 数字兜底：拿不到就返回 fallback（默认 0）。 */
function toNumber(value, fallback = 0) {
  const number = numberOrNull(value);
  return number == null ? fallback : number;
}

/** 正数 epoch 秒，否则 null。 */
function epochSeconds(value) {
  const number = numberOrNull(value);
  return number != null && number > 0 ? number : null;
}

/** 四舍五入到指定小数位；非有限数字返回 0。 */
function round(value, digits) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 胜率：0 场返回 null，否则 0..1 原始小数（保留 4 位）。 */
function winrate(wins, games) {
  if (!games || games <= 0) return null;
  return round(wins / games, 4);
}

/** 平均；空数组返回 0。 */
function mean(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** 只统计有限数字的平均值（缺字段的对局不参与）。 */
function meanOfFinite(values) {
  const usable = [];
  for (const value of values) {
    const number = numberOrNull(value);
    if (number != null) usable.push(number);
  }
  return mean(usable);
}

/** 胜负判定：player_slot < 128 为天辉，radiant_win 为天辉是否获胜。 */
function isWin(match) {
  if (!isObject(match) || typeof match.radiant_win !== 'boolean') return false;
  const slot = numberOrNull(match.player_slot);
  if (slot == null) return false;
  return (slot < 128) === match.radiant_win;
}

/** 契约里 winrate 的展示口径：0..1 → 中文百分比文本（洞见文案用）。 */
function pctText(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  return (value * 100).toFixed(digits) + '%';
}

/** 大数字转中文量级（facts 用）：3,038 万 / 1.21 亿。 */
function compactAmount(value) {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e8) return (value / 1e8).toFixed(2) + ' 亿';
  if (abs >= 1e4) return (value / 1e4).toFixed(abs >= 1e6 ? 0 : 1) + ' 万';
  return String(Math.round(value));
}

/* ---------------- 本地时间（UTC+8）辅助 ---------------- */

function localParts(seconds) {
  const date = new Date((seconds + TZ_OFFSET_SECONDS) * 1000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    hour: date.getUTCHours(),
    weekday: date.getUTCDay(),
  };
}

function monthIndexFromParts(parts) {
  return parts.year * 12 + (parts.month - 1);
}

function monthKeyFromIndex(index) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return year + '-' + String(month).padStart(2, '0');
}

function monthLabelFromKey(key) {
  const [year, month] = String(key).split('-');
  return Number(year) + ' 年 ' + Number(month) + ' 月';
}

/** 对局集合覆盖的月份范围（本地时间）；空集合返回 null。 */
function monthRangeOf(matches) {
  let min = null;
  let max = null;
  for (const match of matches) {
    const start = epochSeconds(match.start_time);
    if (start == null) continue;
    const index = monthIndexFromParts(localParts(start));
    if (min == null || index < min) min = index;
    if (max == null || index > max) max = index;
  }
  if (min == null) return null;
  return {
    firstKey: monthKeyFromIndex(min),
    lastKey: monthKeyFromIndex(max),
    count: max - min + 1,
  };
}

/* ============================================================
 * 四、各区块（纯函数，输入都是已经筛好的对局数组）
 * ============================================================ */

function buildProfile(snapshot) {
  const profile = isObject(snapshot.profile) ? snapshot.profile : {};
  const rank = isObject(snapshot.rank) ? snapshot.rank : {};

  const rankTier = numberOrNull(rank.rank_tier);
  const tier = rankTier != null && rankTier > 0 ? Math.floor(rankTier / 10) : null;
  const stars = rankTier != null && rankTier > 0 ? rankTier % 10 : 0;
  const tierName = tier != null && RANK_TIER_NAMES[tier] ? RANK_TIER_NAMES[tier] : '未定级';

  // aliases：只留名字，按 name_since 升序（升序最后一位在页面上被当作“现用名”）
  const rawAliases = Array.isArray(snapshot.aliases) ? snapshot.aliases : [];
  const aliases = rawAliases
    .map((alias, index) => {
      if (typeof alias === 'string') return { name: alias, since: 0, index };
      if (!isObject(alias)) return null;
      const name = String(alias.personaname || alias.name || '').trim();
      const since = typeof alias.name_since === 'string' ? Date.parse(alias.name_since) : NaN;
      return { name, since: Number.isFinite(since) ? since : 0, index };
    })
    .filter((alias) => alias && alias.name)
    .sort((a, b) => a.since - b.since || a.index - b.index)
    .map((alias) => alias.name);

  const steamid = snapshot.steamid != null ? String(snapshot.steamid)
    : profile.steamid != null ? String(profile.steamid) : null;

  return {
    accountId: numberOrNull(snapshot.account_id),
    name: profile.personaname ? String(profile.personaname) : '',
    avatar: profile.avatarfull ? String(profile.avatarfull) : profile.avatar ? String(profile.avatar) : '',
    steamid,
    rank: {
      tier,
      tierName,
      stars,
      leaderboardRank: numberOrNull(rank.leaderboard_rank),
      mmr: numberOrNull(rank.computed_mmr) != null ? round(rank.computed_mmr, 2) : null,
      mmrTurbo: numberOrNull(rank.computed_mmr_turbo) != null ? round(rank.computed_mmr_turbo, 2) : null,
    },
    aliases,
  };
}

function buildFilterSections(matchesAll, key) {
  const counts = {};
  for (const filter of FILTERS) {
    const predicate = FILTER_PREDICATES[filter.key];
    let games = 0;
    for (const match of matchesAll) if (predicate(match)) games += 1;
    counts[filter.key] = games;
  }
  const current = FILTERS.find((filter) => filter.key === key) || FILTERS[0];
  return {
    filter: { key: current.key, label: current.label, games: counts[current.key] },
    filters: FILTERS.map((filter) => ({
      key: filter.key,
      label: filter.label,
      games: counts[filter.key],
    })),
  };
}

function buildOverview(matches) {
  const games = matches.length;
  let wins = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let durationSeconds = 0;
  let firstMatchAt = null;
  let lastMatchAt = null;

  for (const match of matches) {
    if (isWin(match)) wins += 1;
    kills += toNumber(match.kills);
    deaths += toNumber(match.deaths);
    assists += toNumber(match.assists);
    durationSeconds += toNumber(match.duration);
    const start = epochSeconds(match.start_time);
    if (start != null) {
      if (firstMatchAt == null || start < firstMatchAt) firstMatchAt = start;
      if (lastMatchAt == null || start > lastMatchAt) lastMatchAt = start;
    }
  }

  return {
    games,
    wins,
    losses: games - wins,
    winrate: winrate(wins, games),
    avgDurationMin: games ? round(durationSeconds / games / 60, 1) : 0,
    // KDA 口径：总量比 (Σkills + Σassists) / Σdeaths，与 career.kda 一致；deaths=0 时 null
    kda: deaths > 0 ? round((kills + assists) / deaths, 2) : null,
    avgKills: games ? round(kills / games, 2) : 0,
    avgDeaths: games ? round(deaths / games, 2) : 0,
    avgAssists: games ? round(assists / games, 2) : 0,
    totalHours: round(durationSeconds / 3600, 1),
    firstMatchAt,
    lastMatchAt,
  };
}

function buildCareer(totals, matchesAll) {
  const sums = new Map();
  for (const row of totals) {
    if (!isObject(row) || typeof row.field !== 'string') continue;
    const sum = numberOrNull(row.sum);
    if (sum != null) sums.set(row.field, sum);
  }

  // 快照缺 totals 时的兜底：matches 里只有 kills/deaths/assists/duration 四项
  const fallback = { kills: 0, deaths: 0, assists: 0, duration: 0 };
  for (const match of matchesAll) {
    fallback.kills += toNumber(match.kills);
    fallback.deaths += toNumber(match.deaths);
    fallback.assists += toNumber(match.assists);
    fallback.duration += toNumber(match.duration);
  }
  const pick = (field, fallbackValue) => (sums.has(field) ? sums.get(field) : fallbackValue);

  const kills = pick('kills', fallback.kills);
  const deaths = pick('deaths', fallback.deaths);
  const assists = pick('assists', fallback.assists);
  const durationSeconds = pick('duration', fallback.duration);

  return {
    kills,
    deaths,
    assists,
    heroDamage: pick('hero_damage', 0),
    towerDamage: pick('tower_damage', 0),
    lastHits: pick('last_hits', 0),
    denies: pick('denies', 0),
    durationSeconds,
    pings: pick('pings', 0),
    hours: round(durationSeconds / 3600, 1),
    kda: round((kills + assists) / Math.max(1, deaths), 2),
    // 契约“取这些字段”里点名了守卫数据，页面暂未消费；保留完整口径
    purchaseWardObserver: pick('purchase_ward_observer', 0),
    purchaseWardSentry: pick('purchase_ward_sentry', 0),
  };
}

function buildMonthly(matches) {
  if (!matches.length) return [];
  const buckets = new Map();
  for (const match of matches) {
    const start = epochSeconds(match.start_time);
    if (start == null) continue;
    const index = monthIndexFromParts(localParts(start));
    let bucket = buckets.get(index);
    if (!bucket) {
      bucket = { games: 0, wins: 0 };
      buckets.set(index, bucket);
    }
    bucket.games += 1;
    if (isWin(match)) bucket.wins += 1;
  }
  if (!buckets.size) return [];

  const indexes = [...buckets.keys()];
  const min = Math.min(...indexes);
  const max = Math.max(...indexes);
  const months = [];
  for (let index = min; index <= max; index += 1) {
    const bucket = buckets.get(index) || { games: 0, wins: 0 };
    months.push({
      key: monthKeyFromIndex(index),
      games: bucket.games,
      wins: bucket.wins,
      winrate: winrate(bucket.wins, bucket.games),
    });
  }
  return months;
}

function buildTimeSections(matches) {
  const hourly = [];
  for (let hour = 0; hour < 24; hour += 1) hourly.push({ hour, games: 0, wins: 0 });
  const weekday = WEEKDAY_LABELS.map((label, day) => ({ day, label, games: 0, wins: 0 }));
  const heatmap = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) heatmap.push({ day, hour, games: 0, wins: 0 });
  }

  for (const match of matches) {
    const start = epochSeconds(match.start_time);
    if (start == null) continue;
    const parts = localParts(start);
    const won = isWin(match) ? 1 : 0;
    hourly[parts.hour].games += 1;
    hourly[parts.hour].wins += won;
    weekday[parts.weekday].games += 1;
    weekday[parts.weekday].wins += won;
    const cell = heatmap[parts.weekday * 24 + parts.hour];
    cell.games += 1;
    cell.wins += won;
  }

  for (const item of hourly) item.winrate = winrate(item.wins, item.games);
  for (const item of weekday) item.winrate = winrate(item.wins, item.games);
  for (const item of heatmap) item.winrate = winrate(item.wins, item.games);
  return { hourly, weekday, heatmap };
}

function buildSide(matches) {
  const sides = [
    { key: 'radiant', label: '天辉', games: 0, wins: 0 },
    { key: 'dire', label: '夜魇', games: 0, wins: 0 },
  ];
  for (const match of matches) {
    const slot = numberOrNull(match.player_slot);
    const side = slot != null && slot < 128 ? sides[0] : sides[1];
    side.games += 1;
    if (isWin(match)) side.wins += 1;
  }
  return sides.map((side) => ({ ...side, winrate: winrate(side.wins, side.games) }));
}

function buildGroupStats(matches, field, labels, fallbackPrefix) {
  const buckets = new Map();
  for (const match of matches) {
    const key = numberOrNull(match[field]);
    if (key == null) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { games: 0, wins: 0 };
      buckets.set(key, bucket);
    }
    bucket.games += 1;
    if (isWin(match)) bucket.wins += 1;
  }
  const rows = [];
  for (const [key, bucket] of buckets) {
    rows.push({
      key,
      label: labels[key] || fallbackPrefix + key,
      games: bucket.games,
      wins: bucket.wins,
      winrate: winrate(bucket.wins, bucket.games),
    });
  }
  rows.sort((a, b) => b.games - a.games || a.key - b.key);
  return rows;
}

function buildStreak(matches) {
  if (!matches.length) {
    return { currentType: null, currentLength: 0, longestWin: 0, longestLoss: 0 };
  }
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  let runType = null;
  for (const match of matches) {
    const won = isWin(match);
    if (runType === won) run += 1;
    else {
      runType = won;
      run = 1;
    }
    if (won) longestWin = Math.max(longestWin, run);
    else longestLoss = Math.max(longestLoss, run);
  }

  const lastWin = isWin(matches[matches.length - 1]);
  let currentLength = 0;
  for (let index = matches.length - 1; index >= 0 && isWin(matches[index]) === lastWin; index -= 1) {
    currentLength += 1;
  }
  return {
    currentType: lastWin ? 'win' : 'loss',
    currentLength,
    longestWin,
    longestLoss,
  };
}

function heroSlug(meta, heroId) {
  if (meta && typeof meta.slug === 'string' && meta.slug) return meta.slug;
  if (meta && typeof meta.name === 'string' && meta.name) {
    return meta.name.replace(/^npc_dota_hero_/, '');
  }
  return 'hero-' + heroId;
}

/** 展示名兜底：hero_id = 0 是 OpenDota 未解析出的对局，没有中文名。 */
function heroDisplayName(meta, heroId) {
  if (meta && (meta.zh || meta.en)) return String(meta.zh || meta.en);
  if (heroId == null) return '';
  return heroId > 0 ? '英雄 ' + heroId : '未知英雄';
}

function buildHeroes(matches, metaMap, rankingMap) {
  const stats = new Map();
  for (const match of matches) {
    const heroId = numberOrNull(match.hero_id);
    if (heroId == null) continue;
    let entry = stats.get(heroId);
    if (!entry) {
      entry = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, duration: 0, lastPlayed: null };
      stats.set(heroId, entry);
    }
    entry.games += 1;
    if (isWin(match)) entry.wins += 1;
    entry.kills += toNumber(match.kills);
    entry.deaths += toNumber(match.deaths);
    entry.assists += toNumber(match.assists);
    entry.duration += toNumber(match.duration);
    const start = epochSeconds(match.start_time);
    if (start != null && (entry.lastPlayed == null || start > entry.lastPlayed)) entry.lastPlayed = start;
  }

  const heroes = [];
  for (const [heroId, entry] of stats) {
    const meta = metaMap.get(heroId) || null;
    const attr = meta && ATTR_LABELS[meta.attr] ? meta.attr : null;
    heroes.push({
      heroId,
      slug: heroSlug(meta, heroId),
      zh: heroDisplayName(meta, heroId),
      en: meta && meta.en ? String(meta.en) : '',
      attr,
      attrLabel: attr ? ATTR_LABELS[attr] : null,
      attackType: meta && meta.attack_type ? String(meta.attack_type) : null,
      roles: meta && Array.isArray(meta.roles) ? meta.roles.slice() : [],
      img: meta && meta.img ? String(meta.img) : null,
      icon: meta && meta.icon ? String(meta.icon) : null,
      games: entry.games,
      wins: entry.wins,
      losses: entry.games - entry.wins,
      winrate: winrate(entry.wins, entry.games),
      // KDA 口径：该英雄全部对局的总量比；deaths=0 时 null
      kda: entry.deaths > 0 ? round((entry.kills + entry.assists) / entry.deaths, 2) : null,
      avgDurationMin: round(entry.duration / entry.games / 60, 1),
      lastPlayed: entry.lastPlayed,
      percentRank: rankingMap.has(heroId) ? rankingMap.get(heroId) : null,
    });
  }
  // 契约：按 games 降序（其后用 wins、heroId 保证确定性）
  heroes.sort((a, b) => b.games - a.games || b.wins - a.wins || a.heroId - b.heroId);
  return heroes;
}

function buildHeroRankings(heroes) {
  const eligible = heroes.filter((hero) => hero.games >= HERO_MIN_GAMES);
  const bestHeroes = eligible
    .slice()
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games || a.heroId - b.heroId)
    .slice(0, BEST_HERO_LIMIT);
  const worstHeroes = eligible
    .slice()
    .sort((a, b) => a.winrate - b.winrate || b.games - a.games || a.heroId - b.heroId)
    .slice(0, WORST_HERO_LIMIT);
  return { bestHeroes, worstHeroes };
}

function buildSignature(heroes) {
  return heroes
    .filter((hero) => hero.percentRank != null)
    .slice()
    .sort((a, b) => b.percentRank - a.percentRank || b.games - a.games || a.heroId - b.heroId)
    .slice(0, SIGNATURE_LIMIT)
    .map((hero) => ({
      heroId: hero.heroId,
      zh: hero.zh,
      icon: hero.icon,
      games: hero.games,
      wins: hero.wins,
      winrate: hero.winrate,
      percentRank: hero.percentRank,
    }));
}

function buildHeroPool(heroes, snapshot) {
  const meta = isObject(snapshot.heroes_meta) ? snapshot.heroes_meta : {};
  const metaCount = Object.keys(meta).length;
  const rosterCount = Array.isArray(snapshot.heroes) ? snapshot.heroes.length : 0;
  const available = metaCount || rosterCount || heroes.length;

  const totalGames = heroes.reduce((sum, hero) => sum + hero.games, 0);

  const attrGames = new Map(ATTR_ORDER.map((attr) => [attr, 0]));
  let meleeGames = 0;
  const roleGames = new Map();
  for (const hero of heroes) {
    if (hero.attr && attrGames.has(hero.attr)) {
      attrGames.set(hero.attr, attrGames.get(hero.attr) + hero.games);
    }
    if (String(hero.attackType || '').toLowerCase() === 'melee') meleeGames += hero.games;
    for (const role of hero.roles) roleGames.set(role, (roleGames.get(role) || 0) + hero.games);
  }

  const attrs = ATTR_ORDER.map((attr) => {
    const games = attrGames.get(attr) || 0;
    return {
      key: attr,
      label: ATTR_LABELS[attr],
      games,
      share: totalGames ? round(games / totalGames, 4) : 0,
    };
  });

  const roles = [...roleGames.entries()]
    .map(([role, games]) => ({ role, games }))
    .sort((a, b) => b.games - a.games || (a.role < b.role ? -1 : a.role > b.role ? 1 : 0))
    .slice(0, 6);

  return {
    played: heroes.length,
    available,
    attrs,
    roles,
    meleeShare: totalGames ? round(meleeGames / totalGames, 4) : 0,
  };
}

function buildRecent(recentMatches, metaMap) {
  const rows = recentMatches
    .filter(isObject)
    .slice()
    .sort((a, b) => toNumber(b.start_time) - toNumber(a.start_time));

  const items = rows.map((match) => {
    const heroId = numberOrNull(match.hero_id);
    const meta = heroId != null ? metaMap.get(heroId) || null : null;
    const gameMode = numberOrNull(match.game_mode);
    return {
      matchId: numberOrNull(match.match_id),
      heroId,
      zh: heroDisplayName(meta, heroId),
      icon: meta && meta.icon ? String(meta.icon) : null,
      win: isWin(match),
      kills: toNumber(match.kills),
      deaths: toNumber(match.deaths),
      assists: toNumber(match.assists),
      durationMin: Math.round(toNumber(match.duration) / 60),
      startTime: numberOrNull(match.start_time),
      gameMode,
      gameModeLabel: gameMode == null ? '' : GAME_MODE_LABELS[gameMode] || '模式 ' + gameMode,
      gpm: toNumber(match.gold_per_min),
      xpm: toNumber(match.xp_per_min),
    };
  });

  const count = items.length;
  const wins = items.filter((item) => item.win).length;
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  for (const item of items) {
    totalKills += item.kills;
    totalDeaths += item.deaths;
    totalAssists += item.assists;
  }

  return {
    count,
    wins,
    winrate: winrate(wins, count),
    // KDA 口径：最近 20 场的总量比；deaths=0 时 null
    kda: totalDeaths > 0 ? round((totalKills + totalAssists) / totalDeaths, 2) : null,
    avgGpm: Math.round(meanOfFinite(rows.map((match) => match.gold_per_min))),
    avgXpm: Math.round(meanOfFinite(rows.map((match) => match.xp_per_min))),
    avgLastHits: Math.round(meanOfFinite(rows.map((match) => match.last_hits))),
    avgHeroDamage: Math.round(meanOfFinite(rows.map((match) => match.hero_damage))),
    items,
  };
}

function buildPeers(peersRaw) {
  const peers = [];
  for (const peer of peersRaw) {
    if (!isObject(peer)) continue;
    const accountId = numberOrNull(peer.account_id);
    if (accountId == null) continue;
    const games = toNumber(peer.with_games);
    const wins = toNumber(peer.with_win);
    peers.push({
      accountId,
      name: peer.personaname ? String(peer.personaname) : peer.name ? String(peer.name) : '玩家 ' + accountId,
      avatar: peer.avatar ? String(peer.avatar) : peer.avatarfull ? String(peer.avatarfull) : '',
      games,
      wins,
      winrate: winrate(wins, games),
      lastPlayed: numberOrNull(peer.last_played),
    });
  }
  peers.sort((a, b) => b.games - a.games || b.wins - a.wins || a.accountId - b.accountId);
  return peers;
}

function buildWordcloud(wordcloudRaw) {
  const counts = isObject(wordcloudRaw) && isObject(wordcloudRaw.all_word_counts)
    ? wordcloudRaw.all_word_counts
    : {};
  const words = [];
  for (const [rawWord, rawCount] of Object.entries(counts)) {
    const word = String(rawWord).trim();
    const count = numberOrNull(rawCount);
    if (!word || count == null || count < WORD_MIN_COUNT) continue;
    if (word.length <= 1) continue; // 单字母（u / i / g …）没有信息量
    if (WORD_STOPWORDS.has(word.toLowerCase())) continue; // 英文虚词
    words.push({ word, count });
  }
  words.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return words.slice(0, WORD_LIMIT);
}

/* ---------------- 洞见（insights） ---------------- */

function buildInsights(context) {
  const { filterKey, overview, monthly, hourly, weekday, side, modes, lobbies, streak, heroes, peers } = context;

  // 空数据：给一条空态说明（没有数字可讲，不硬凑 5 条）
  if (overview.games === 0) {
    return [{ kind: 'volume', title: '暂无对局', text: '当前筛选条件下还没有对局记录。' }];
  }

  const insights = [];

  // 1) signature：场次 >= 20 里绝活指数最高的英雄（契约示例即 Clinkz / 99.98% 口径）
  const veterans = heroes.filter((hero) => hero.games >= SIGNATURE_MIN_GAMES);
  const gem = veterans
    .slice()
    .sort((a, b) => {
      const rankA = a.percentRank == null ? -1 : a.percentRank;
      const rankB = b.percentRank == null ? -1 : b.percentRank;
      return rankB - rankA || b.winrate - a.winrate || b.games - a.games;
    })[0];
  if (gem) {
    let text = gem.games + ' 场 ' + pctText(gem.winrate) + ' 胜率';
    if (gem.percentRank != null) {
      text += '，绝活指数超过 ' + (gem.percentRank * 100).toFixed(2) + '% 的玩家';
    }
    text += '。';
    insights.push({ kind: 'signature', title: '绝活：' + gem.zh, text });
  } else if (heroes.length) {
    const top = heroes[0];
    insights.push({
      kind: 'signature',
      title: '主力英雄：' + top.zh,
      text: top.games + ' 场，胜率 ' + pctText(top.winrate) + '。',
    });
  }

  // 2) mode：天梯 vs 快速胜率差；样本不够时退回“最常打模式占比”
  const ranked = lobbies.find((lobby) => lobby.key === 7);
  const turbo = modes.find((mode) => mode.key === 23);
  if (ranked && turbo && ranked.games >= 20 && turbo.games >= 20 && ranked.winrate != null && turbo.winrate != null) {
    const gap = Math.abs(ranked.winrate - turbo.winrate) * 100;
    insights.push({
      kind: 'mode',
      title: ranked.winrate >= turbo.winrate ? '天梯更稳' : '快速更稳',
      text: '天梯 ' + ranked.games + ' 场胜率 ' + pctText(ranked.winrate) +
        '，快速模式 ' + turbo.games + ' 场胜率 ' + pctText(turbo.winrate) +
        '，相差 ' + gap.toFixed(1) + ' 个百分点。',
    });
  } else if (modes.length) {
    const top = modes[0];
    insights.push({
      kind: 'mode',
      title: '主玩模式：' + top.label,
      text: top.games + ' 场，占当前对局的 ' + pctText(top.games / overview.games) +
        '，胜率 ' + pctText(top.winrate) + '。',
    });
  }

  // 3) time：最常开打的星期 + （样本 >= 20 时）胜率最高的时段
  const busiestDay = weekday
    .slice()
    .filter((day) => day.games > 0)
    .sort((a, b) => b.games - a.games || a.day - b.day)[0];
  const bestHour = hourly
    .filter((hour) => hour.games >= 20 && hour.winrate != null)
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games || a.hour - b.hour)[0];
  if (busiestDay) {
    let text = busiestDay.label + '打得最多，' + busiestDay.games + ' 场、胜率 ' + pctText(busiestDay.winrate);
    if (bestHour) {
      text += '；' + String(bestHour.hour).padStart(2, '0') + ' 点时段胜率最高（' +
        bestHour.games + ' 场 ' + pctText(bestHour.winrate) + '）';
    }
    text += '。';
    insights.push({ kind: 'time', title: '最常开打：' + busiestDay.label, text });
  }

  // 4) habit：场均 K/D/A + 时长（KDA 为总量比，deaths=0 时 null）
  if (overview.avgDurationMin != null) {
    const kdaText = overview.kda == null ? '—' : overview.kda.toFixed(2);
    insights.push({
      kind: 'habit',
      title: '对局习惯',
      text: '场均 ' + overview.avgKills.toFixed(2) + ' 杀 / ' + overview.avgDeaths.toFixed(2) + ' 死 / ' +
        overview.avgAssists.toFixed(2) + ' 助攻，KDA ' + kdaText +
        '，平均一局 ' + overview.avgDurationMin.toFixed(1) + ' 分钟。',
    });
  }

  // 5) side：天辉 / 夜魇胜率差 >= 3 个百分点才写
  const radiant = side[0];
  const dire = side[1];
  if (radiant && dire && radiant.games >= 10 && dire.games >= 10 && radiant.winrate != null && dire.winrate != null) {
    const diff = radiant.winrate - dire.winrate;
    if (Math.abs(diff) >= 0.03) {
      const better = diff > 0 ? radiant : dire;
      const worse = diff > 0 ? dire : radiant;
      insights.push({
        kind: 'side',
        title: better.label + '更顺手',
        text: better.label + ' ' + better.games + ' 场胜率 ' + pctText(better.winrate) +
          '，' + worse.label + ' ' + worse.games + ' 场 ' + pctText(worse.winrate) +
          '，差 ' + (Math.abs(diff) * 100).toFixed(1) + ' 个百分点。',
      });
    }
  }

  // 6) streak：当前连胜/连败 + 历史最长
  if (streak.longestWin > 0 || streak.longestLoss > 0) {
    const scope = filterKey === 'all' ? '生涯' : '当前筛选';
    let text = scope + '最长 ' + streak.longestWin + ' 连胜、' + streak.longestLoss + ' 连败';
    if (streak.currentType) {
      text += '；当前' + (streak.currentType === 'win' ? '连胜' : '连败') + ' ' + streak.currentLength + ' 场';
    }
    text += '。';
    insights.push({
      kind: 'streak',
      title: scope + '最长 ' + streak.longestWin + ' 连胜',
      text,
    });
  }

  // 7) peer：同场 >= 10 场的搭子里胜率最高
  const duo = peers
    .filter((peer) => peer.games >= 10 && peer.winrate != null)
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games || a.accountId - b.accountId)[0];
  if (duo) {
    insights.push({
      kind: 'peer',
      title: '最佳搭子：' + duo.name,
      text: '和 ' + duo.name + ' 同场 ' + duo.games + ' 场、胜率 ' + pctText(duo.winrate) +
        '，是同场 10 场以上的搭子里最高的。',
    });
  }

  // 8) volume：最活跃月份
  const peak = monthly.slice().sort((a, b) => b.games - a.games || (a.key < b.key ? -1 : 1))[0];
  if (peak && peak.games > 0) {
    const activeMonths = monthly.filter((month) => month.games > 0).length;
    let text = monthLabelFromKey(peak.key) + '打了 ' + peak.games + ' 场，是场次最多的月份';
    if (activeMonths === monthly.length) text += '；' + monthly.length + ' 个月里每月都有对局。';
    else text += '；' + monthly.length + ' 个月里有 ' + activeMonths + ' 个月留下记录。';
    insights.push({ kind: 'volume', title: '最活跃：' + monthLabelFromKey(peak.key), text });
  }

  // 兜底：极端快照（例如 start_time 全缺失导致月份/时段桶为空）也要凑够 5 条
  if (insights.length < 5) {
    const usedKinds = new Set(insights.map((insight) => insight.kind));
    if (!usedKinds.has('volume')) {
      insights.push({
        kind: 'volume',
        title: '对局总量',
        text: '当前筛选共 ' + overview.games + ' 场，胜率 ' + pctText(overview.winrate) + '。',
      });
    }
  }

  return insights.slice(0, 8);
}

/* ---------------- 人话事实（facts） ---------------- */

function buildFacts(career, matchesAll) {
  const totalGames = matchesAll.length;
  if (totalGames === 0) return []; // 没有对局就没人话可换算

  const facts = [];
  if (career.durationSeconds > 0) {
    facts.push({
      label: '游戏内总时长',
      value: Math.round(career.hours) + ' 小时',
      hint: '约等于 ' + Math.round(career.hours / 24) + ' 天，不含排队时间',
    });
  }

  const range = monthRangeOf(matchesAll);
  if (range) {
    const perMonth = Math.max(1, Math.round(totalGames / range.count));
    facts.push({
      label: '生涯总场次',
      value: totalGames + ' 场',
      hint: monthLabelFromKey(range.firstKey) + ' 到 ' + monthLabelFromKey(range.lastKey) +
        '，平均每月 ' + perMonth + ' 场',
    });
  }

  if (career.kills > 0) {
    facts.push({
      label: '总击杀',
      value: career.kills + ' 次',
      hint: '场均 ' + (career.kills / totalGames).toFixed(2) + ' 杀',
    });
  }
  if (career.assists > 0) {
    facts.push({
      label: '总助攻',
      value: career.assists + ' 次',
      hint: '场均 ' + (career.assists / totalGames).toFixed(2) + ' 助攻',
    });
  }
  if (career.deaths > 0) {
    facts.push({
      label: '生涯 KDA',
      value: career.kda.toFixed(2),
      hint: '每死一次，平均换来 ' + career.kda.toFixed(2) + ' 次击杀或助攻',
    });
  }
  if (career.heroDamage > 0) {
    facts.push({
      label: '对英雄总伤害',
      value: compactAmount(career.heroDamage),
      hint: '平均每局 ' + compactAmount(career.heroDamage / totalGames) + '伤害',
    });
  }

  return facts.slice(0, 6);
}

/* ============================================================
 * 五、主入口
 * ============================================================ */

/**
 * 分析一份快照。
 * @param {object} snapshot data/dota/snapshot.json 解析后的对象
 * @param {string} [filterKey='all'] FILTERS 里的 key；未知 key 回退到 'all'
 * @returns {object} 契约（tmp/contracts/analysis-api.md）规定的完整结果对象
 */
export function analyze(snapshot, filterKey = 'all') {
  const data = isObject(snapshot) ? snapshot : {};
  const matchesAll = Array.isArray(data.matches) ? data.matches.filter(isObject) : [];
  const recentMatches = Array.isArray(data.recent_matches) ? data.recent_matches : [];
  const peersRaw = Array.isArray(data.peers) ? data.peers : [];
  const totals = Array.isArray(data.totals) ? data.totals : [];

  const metaMap = new Map();
  if (isObject(data.heroes_meta)) {
    for (const [key, meta] of Object.entries(data.heroes_meta)) {
      const heroId = numberOrNull(key);
      if (heroId != null && isObject(meta)) metaMap.set(heroId, meta);
    }
  }
  const rankingMap = new Map();
  if (Array.isArray(data.rankings)) {
    for (const row of data.rankings) {
      if (!isObject(row)) continue;
      const heroId = numberOrNull(row.hero_id);
      const percentRank = numberOrNull(row.percent_rank);
      if (heroId != null && percentRank != null) rankingMap.set(heroId, round(percentRank, 4));
    }
  }

  const key = FILTER_PREDICATES[filterKey] ? filterKey : 'all';
  const matches = matchesAll
    .filter(FILTER_PREDICATES[key])
    .slice()
    .sort((a, b) => toNumber(a.start_time) - toNumber(b.start_time));

  const { filter, filters } = buildFilterSections(matchesAll, key);
  const overview = buildOverview(matches);
  const career = buildCareer(totals, matchesAll);
  const monthly = buildMonthly(matches);
  const { hourly, weekday, heatmap } = buildTimeSections(matches);
  const side = buildSide(matches);
  const modes = buildGroupStats(matches, 'game_mode', GAME_MODE_LABELS, '模式 ');
  const lobbies = buildGroupStats(matches, 'lobby_type', LOBBY_LABELS, '大厅 ');
  const streak = buildStreak(matches);
  const heroes = buildHeroes(matches, metaMap, rankingMap);
  const { bestHeroes, worstHeroes } = buildHeroRankings(heroes);
  const signature = buildSignature(heroes);
  const heroPool = buildHeroPool(heroes, data);
  const recent = buildRecent(recentMatches, metaMap);
  const peers = buildPeers(peersRaw);
  const wordcloud = buildWordcloud(data.wordcloud);
  const insights = buildInsights({
    filterKey: key,
    overview,
    monthly,
    hourly,
    weekday,
    side,
    modes,
    lobbies,
    streak,
    heroes,
    peers,
  });
  const facts = buildFacts(career, matchesAll);

  return {
    generatedAt: typeof data.generated_at === 'string' ? data.generated_at : null,
    profile: buildProfile(data),
    filter,
    filters,
    overview,
    career,
    monthly,
    hourly,
    weekday,
    heatmap,
    side,
    modes,
    lobbies,
    streak,
    heroes,
    bestHeroes,
    worstHeroes,
    signature,
    heroPool,
    recent,
    peers,
    wordcloud,
    insights,
    facts,
  };
}

/* ============================================================
 * 六、图表便捷函数
 * ============================================================ */

/**
 * 把 heroes 数组转成画图用的 [{label, value, meta}]（按 winrate 降序）。
 * @param {Array<object>} heroes analyze().heroes（或任意同结构数组）
 * @param {number} [minGames=8] 样本门槛，低于该场次的英雄不返回
 * @returns {Array<{label: string, value: number, meta: object}>} value 为 0..1 胜率
 */
export function heroWinrateSeries(heroes, minGames = 8) {
  const list = Array.isArray(heroes) ? heroes : [];
  const threshold = Number.isFinite(minGames) ? minGames : HERO_MIN_GAMES;
  return list
    .filter((hero) => isObject(hero) && toNumber(hero.games) >= threshold && hero.winrate != null)
    .slice()
    .sort((a, b) => b.winrate - a.winrate || toNumber(b.games) - toNumber(a.games) || toNumber(a.heroId) - toNumber(b.heroId))
    .map((hero) => ({
      label: hero.zh || hero.en || hero.slug || '#' + toNumber(hero.heroId),
      value: hero.winrate,
      meta: hero,
    }));
}
