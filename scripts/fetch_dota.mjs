#!/usr/bin/env node
/**
 * 抓取 Dota 2 玩家数据，生成静态站快照 data/dota/snapshot.json（schema v1）。
 *
 *   node scripts/fetch_dota.mjs                # 抓取并写入快照 + 下载头像
 *   node scripts/fetch_dota.mjs --dry-run      # 只抓取 + 校验，不写任何文件
 *   node scripts/fetch_dota.mjs --account=1063862727 --out=data/dota/snapshot.json
 *
 * 数据全部来自 OpenDota 公开 API（无需 API Key，但必须带浏览器 UA），
 * 所有聚合端点统一使用 significant=0（含快速模式），保证口径一致。
 * 零依赖：仅用 Node 18+ 原生 fetch。
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ===== 常量配置 =====
const SCHEMA_VERSION = 1;
const API_BASE = 'https://api.opendota.com/api';
const CDN_BASE = 'https://cdn.cloudflare.steamstatic.com';
const HEROLIST_URL = 'https://www.dota2.com/datafeed/herolist?language=schinese';
const ACCOUNT_ID = 1063862727;
const SNAPSHOT_FILE = path.join(ROOT, 'data', 'dota', 'snapshot.json');
const AVATAR_FILE = path.join(ROOT, 'assets', 'dota', 'avatar.jpg');
const PAGE_SIZE = 500; // OpenDota /players/{id}/matches 的 limit 上限
const MAX_PAGES = 40; // 防御：2 万场足够，避免异常响应导致死循环
const MIN_MATCHES = 1000; // 低于该值判定为半截数据
const PREVIOUS_MIN_RATIO = 0.95; // 新快照不得少于上次的 95%
const HERO_COUNT = 127; // heroStats 英雄总数
const WORDCLOUD_LIMIT = 80; // 词云只保留词频前 80
const AVATAR_MIN_BYTES = 1024; // 头像文件至少 1KB，防止把错误页当图片
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000]; // 429/5xx 最多 4 次指数退避
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};
const STEAM_ID_OFFSET = 76561197960265728n; // steamid64 = account_id + 该偏移

// matches 每行严格限定为这 12 个字段（version/leaver_status/party_size/hero_variant 几乎全为 null，丢弃）
const MATCH_FIELDS = [
  'match_id',
  'player_slot',
  'radiant_win',
  'hero_id',
  'start_time',
  'duration',
  'game_mode',
  'lobby_type',
  'kills',
  'deaths',
  'assists',
  'average_rank',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ===== CLI =====
function printUsage() {
  console.log(`用法: node scripts/fetch_dota.mjs [选项]

选项:
  --dry-run          只抓取并校验，不写快照、不下载头像
  --account=<id>     OpenDota account_id（默认 ${ACCOUNT_ID}）
  --out=<path>       快照输出路径（默认 data/dota/snapshot.json）
  -h, --help         显示本帮助`);
}

function parseAccountId(raw) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`无效的 account_id: ${raw}`);
  }
  return id;
}

function parseArgs(argv) {
  const options = { dryRun: false, accountId: ACCOUNT_ID, out: SNAPSHOT_FILE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('--account=')) {
      options.accountId = parseAccountId(arg.slice('--account='.length));
    } else if (arg === '--account') {
      options.accountId = parseAccountId(argv[++i]);
    } else if (arg.startsWith('--out=')) {
      options.out = path.resolve(process.cwd(), arg.slice('--out='.length));
    } else if (arg === '--out') {
      options.out = path.resolve(process.cwd(), argv[++i]);
    } else {
      throw new Error(`未知参数: ${arg}（用 --help 查看用法）`);
    }
  }
  return options;
}

// ===== HTTP：串行 + 重试 =====
/**
 * 串行请求一个 URL，429/5xx/网络错误按 1s/2s/4s/8s 指数退避最多重试 4 次；
 * 其它非 2xx 状态码直接抛错（不重试）。
 */
async function requestWithRetry(url, label) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      console.warn(`  ! 重试 ${label}（${attempt}/${RETRY_DELAYS_MS.length}，等待 ${delay}ms）`);
      await sleep(delay);
    }
    let response;
    try {
      response = await fetch(url, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error; // 网络错误同样退避重试
      continue;
    }
    if (response.ok) return response;
    if (response.status === 429 || response.status >= 500) {
      const snippet = (await response.text().catch(() => '')).slice(0, 200);
      lastError = new Error(`HTTP ${response.status} ${snippet}`);
      continue;
    }
    throw new Error(`请求失败 HTTP ${response.status}（不可重试）: ${url}`);
  }
  throw new Error(`请求失败（已重试 ${RETRY_DELAYS_MS.length} 次）: ${label}: ${lastError?.message || lastError}`);
}

async function getJson(url, label = url) {
  const response = await requestWithRetry(url, label);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`响应不是合法 JSON: ${label}: ${error.message}`);
  }
}

async function downloadBinary(url, label = url) {
  const response = await requestWithRetry(url, label);
  return Buffer.from(await response.arrayBuffer());
}

// ===== 数据整理 =====
/** avatars.steamstatic.com 在国内直连失败，统一换成 akamai 镜像 host */
function akamaiAvatar(url) {
  if (!url) return url ?? null;
  return String(url).replace(/\/\/avatars\.steamstatic\.com\//, '//avatars.akamai.steamstatic.com/');
}

function deriveSteamId(accountId) {
  return (BigInt(accountId) + STEAM_ID_OFFSET).toString();
}

function pickMatch(raw) {
  const match = {};
  for (const field of MATCH_FIELDS) {
    match[field] = raw[field] === undefined ? null : raw[field];
  }
  return match;
}

function buildProfile(player, accountId) {
  const profile = player?.profile ?? {};
  const steamid = profile.steamid ? String(profile.steamid) : deriveSteamId(accountId);
  return {
    personaname: profile.personaname ?? null,
    avatar: akamaiAvatar(profile.avatar),
    avatarfull: akamaiAvatar(profile.avatarfull),
    profileurl: profile.profileurl || `https://steamcommunity.com/profiles/${steamid}/`,
    loccountrycode: profile.loccountrycode ?? null,
    plus: profile.plus ?? null,
    last_login: profile.last_login ?? null,
  };
}

function buildRank(player) {
  return {
    rank_tier: player?.rank_tier ?? null,
    leaderboard_rank: player?.leaderboard_rank ?? null,
    computed_mmr: player?.computed_mmr ?? null,
    computed_mmr_turbo: player?.computed_mmr_turbo ?? null,
  };
}

/** 中文英雄名：dota2.com datafeed → { hero_id: name_loc } */
function buildZhHeroNames(herolistResponse) {
  const heroes = herolistResponse?.result?.data?.heroes;
  if (!Array.isArray(heroes) || heroes.length === 0) {
    throw new Error('中文英雄名接口返回结构异常（缺少 result.data.heroes）');
  }
  const names = new Map();
  for (const hero of heroes) names.set(Number(hero.id), hero);
  return names;
}

/** 合并 OpenDota heroStats 与 dota2.com 中文名，得到 127 项 heroes_meta */
function buildHeroesMeta(heroStats, zhHeroes) {
  if (!Array.isArray(heroStats) || heroStats.length === 0) {
    throw new Error('heroStats 接口返回为空');
  }
  const meta = {};
  for (const hero of [...heroStats].sort((a, b) => a.id - b.id)) {
    const extra = zhHeroes.get(Number(hero.id));
    const slug = String(hero.name || '').replace(/^npc_dota_hero_/, '');
    meta[String(hero.id)] = {
      slug,
      name: hero.name ?? null,
      zh: extra?.name_loc || hero.localized_name || slug,
      en: extra?.name_english_loc || hero.localized_name || slug,
      attr: hero.primary_attr ?? null,
      attack_type: hero.attack_type ?? null,
      roles: Array.isArray(hero.roles) ? hero.roles : [],
      img: `${CDN_BASE}${String(hero.img || '').replace(/\?+$/, '')}`,
      icon: `${CDN_BASE}${String(hero.icon || '').replace(/\?+$/, '')}`,
    };
  }
  return meta;
}

/** 词频前 80（按次数降序，次数相同按词字典序，保证输出稳定） */
function buildWordcloud(wordcloudResponse) {
  const counts = wordcloudResponse?.all_word_counts ?? {};
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, WORDCLOUD_LIMIT);
  return { all_word_counts: Object.fromEntries(top) };
}

function sortPeers(peers) {
  return [...peers]
    .map((peer) => ({ ...peer, avatar: akamaiAvatar(peer.avatar), avatarfull: akamaiAvatar(peer.avatarfull) }))
    .sort((a, b) => (b.with_games ?? 0) - (a.with_games ?? 0) || (a.account_id ?? 0) - (b.account_id ?? 0));
}

// ===== 抓取流程 =====
async function fetchAllMatches(accountId) {
  const byId = new Map();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const url = `${API_BASE}/players/${accountId}/matches?limit=${PAGE_SIZE}&offset=${offset}&significant=0`;
    const rows = await getJson(url, `matches(offset=${offset})`);
    if (!Array.isArray(rows)) {
      throw new Error(`对局列表返回结构异常（offset=${offset}）`);
    }
    for (const row of rows) {
      if (row && row.match_id != null && !byId.has(row.match_id)) byId.set(row.match_id, row);
    }
    console.log(`  - 对局分页 offset=${offset}：返回 ${rows.length} 场，累计去重 ${byId.size} 场`);
    if (rows.length < PAGE_SIZE) return [...byId.values()];
  }
  throw new Error(`对局分页超过 ${MAX_PAGES} 页，疑似接口异常`);
}

async function collectSnapshot(accountId) {
  console.log('[1/6] 抓取玩家资料、段位与别名 ...');
  const player = await getJson(`${API_BASE}/players/${accountId}`, 'players/{id}');
  const profile = buildProfile(player, accountId);
  const rank = buildRank(player);
  const steamid = player?.profile?.steamid ? String(player.profile.steamid) : deriveSteamId(accountId);
  const aliases = (Array.isArray(player?.aliases) ? player.aliases : []).map((alias) => ({
    personaname: alias?.personaname ?? null,
    name_since: alias?.name_since ?? null,
  }));
  console.log(`  - ${profile.personaname ?? '(未知昵称)'} | 段位 rank_tier=${rank.rank_tier} | 排行榜 ${rank.leaderboard_rank ?? '-'}`);

  console.log('[2/6] 抓取全部对局（significant=0，含快速模式）...');
  const rawMatches = await fetchAllMatches(accountId);
  const matches = rawMatches
    .map(pickMatch)
    .sort((a, b) => a.start_time - b.start_time || a.match_id - b.match_id);
  console.log(`  - 共 ${matches.length} 场（已去重、按 start_time 升序）`);

  console.log('[3/6] 抓取英雄战绩、场次统计、计数与最近对局 ...');
  // 全部请求严格串行，避免触发 OpenDota 限流（约 60 次/分钟/IP）
  const heroes = await getJson(`${API_BASE}/players/${accountId}/heroes?significant=0`, 'heroes');
  const totals = await getJson(`${API_BASE}/players/${accountId}/totals?significant=0`, 'totals');
  const counts = await getJson(`${API_BASE}/players/${accountId}/counts?significant=0`, 'counts');
  const recentMatches = await getJson(`${API_BASE}/players/${accountId}/recentMatches`, 'recentMatches');
  if (!Array.isArray(heroes) || heroes.length === 0) throw new Error('英雄战绩为空');
  if (!Array.isArray(totals) || totals.length === 0) throw new Error('totals 为空');
  if (!Array.isArray(recentMatches)) throw new Error('recentMatches 结构异常');
  console.log(`  - 英雄战绩 ${heroes.length} 行 | totals ${totals.length} 行 | 最近对局 ${recentMatches.length} 场`);

  console.log('[4/6] 抓取开黑同伴、绝活排行与聊天词云 ...');
  const peersRaw = await getJson(`${API_BASE}/players/${accountId}/peers?significant=0`, 'peers');
  const rankings = await getJson(`${API_BASE}/players/${accountId}/rankings`, 'rankings');
  const wordcloudRaw = await getJson(`${API_BASE}/players/${accountId}/wordcloud?significant=0`, 'wordcloud');
  if (!Array.isArray(peersRaw)) throw new Error('peers 结构异常');
  if (!Array.isArray(rankings)) throw new Error('rankings 结构异常');
  const peers = sortPeers(peersRaw);
  const wordcloud = buildWordcloud(wordcloudRaw);
  console.log(
    `  - 同伴 ${peers.length} 人 | 绝活榜 ${rankings.length} 个英雄 | 词云 ${Object.keys(wordcloud.all_word_counts).length} 词`,
  );

  console.log('[5/6] 抓取英雄元数据与中文英雄名 ...');
  const heroStats = await getJson(`${API_BASE}/heroStats`, 'heroStats');
  const herolist = await getJson(HEROLIST_URL, 'herolist(zh)');
  const zhHeroNames = buildZhHeroNames(herolist);
  if (zhHeroNames.size < heroStats.length) {
    console.warn(`  ! 中文名接口只有 ${zhHeroNames.size} 个英雄（heroStats ${heroStats.length} 个），缺失项将回退英文名`);
  }
  const heroesMeta = buildHeroesMeta(heroStats, zhHeroNames);
  console.log(`  - heroes_meta ${Object.keys(heroesMeta).length} 项（含中文名）`);

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source: API_BASE,
    account_id: accountId,
    steamid,
    profile,
    rank,
    aliases,
    matches,
    recent_matches: recentMatches,
    totals,
    counts,
    heroes,
    heroes_meta: heroesMeta,
    peers,
    rankings,
    wordcloud,
  };
}

// ===== 校验（校验通过才允许写盘） =====
function readPreviousSnapshot(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.schema_version)) return parsed;
  } catch {
    // 旧快照不存在/损坏时不做“防缩水”比较，继续正常更新
  }
  return null;
}

function validateSnapshot(snapshot, previous) {
  const errors = [];
  const matches = snapshot.matches;

  if (snapshot.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version 应为 ${SCHEMA_VERSION}，实际 ${snapshot.schema_version}`);
  }
  if (!snapshot.profile?.personaname) errors.push('profile.personaname 缺失');
  if (!snapshot.rank || typeof snapshot.rank !== 'object') errors.push('rank 缺失');
  if (!Array.isArray(matches)) {
    errors.push('matches 不是数组');
    return errors;
  }
  if (matches.length < MIN_MATCHES) {
    errors.push(`matches 仅 ${matches.length} 场（少于 ${MIN_MATCHES}，疑似半截数据）`);
  }
  const previousCount = previous?.matches?.length ?? 0;
  const minFromPrevious = Math.floor(previousCount * PREVIOUS_MIN_RATIO);
  if (previousCount > 0 && matches.length < minFromPrevious) {
    errors.push(`matches ${matches.length} 场，少于上次 ${previousCount} 场的 95%（下限 ${minFromPrevious}）`);
  }

  const seen = new Set();
  for (const match of matches) {
    const keys = Object.keys(match);
    if (keys.length !== MATCH_FIELDS.length || MATCH_FIELDS.some((field) => !keys.includes(field))) {
      errors.push(`对局字段不符合契约：match_id=${match.match_id} 实际字段 ${keys.join(',')}`);
      break;
    }
    if (seen.has(match.match_id)) {
      errors.push(`match_id 重复：${match.match_id}`);
      break;
    }
    seen.add(match.match_id);
  }
  for (let i = 1; i < matches.length; i += 1) {
    if (matches[i - 1].start_time > matches[i].start_time) {
      errors.push(`matches 未按 start_time 升序（第 ${i} 条）`);
      break;
    }
  }

  const heroIds = Object.keys(snapshot.heroes_meta ?? {});
  if (heroIds.length !== HERO_COUNT) {
    errors.push(`heroes_meta 应为 ${HERO_COUNT} 项，实际 ${heroIds.length}`);
  } else {
    const missingZh = heroIds.filter((id) => !snapshot.heroes_meta[id]?.zh);
    if (missingZh.length > 0) errors.push(`heroes_meta 缺少中文名：hero_id ${missingZh.slice(0, 5).join(',')}`);
  }
  if (!Array.isArray(snapshot.totals) || snapshot.totals.length === 0) errors.push('totals 为空');

  return errors;
}

// ===== 落盘 =====
async function writeSnapshotFile(file, snapshot) {
  const json = JSON.stringify(snapshot);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp`;
  await fsp.writeFile(tmpFile, json, 'utf8');
  await fsp.rename(tmpFile, file); // 原子替换，避免写一半留下坏文件
  return Buffer.byteLength(json, 'utf8');
}

/** 下载头像；失败只警告，不中断快照生成 */
async function downloadAvatar(snapshot) {
  const url = snapshot.profile?.avatarfull || snapshot.profile?.avatar;
  if (!url) {
    console.warn('  ! 跳过头像下载：profile 中没有头像地址');
    return { ok: false, bytes: 0 };
  }
  try {
    await fsp.mkdir(path.dirname(AVATAR_FILE), { recursive: true });
    const bytes = await downloadBinary(url, 'avatar');
    if (bytes.length < AVATAR_MIN_BYTES) throw new Error(`文件过小（${bytes.length} 字节）`);
    await fsp.writeFile(AVATAR_FILE, bytes);
    console.log(`  - 头像 ${(bytes.length / 1024).toFixed(1)} KB → ${path.relative(ROOT, AVATAR_FILE)}`);
    return { ok: true, bytes: bytes.length };
  } catch (error) {
    console.warn(`  ! 头像下载失败（不影响快照）: ${error.message}`);
    return { ok: false, bytes: 0 };
  }
}

// ===== 摘要 =====
function formatUtcDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function countWins(matches) {
  return matches.filter((match) => (match.player_slot < 128) === match.radiant_win).length;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// ===== 主流程 =====
async function main(options) {
  const startedAt = Date.now();
  const { accountId, dryRun, out } = options;
  console.log(`Dota 2 数据快照抓取（account_id=${accountId}${dryRun ? '，dry-run' : ''}）`);

  const previous = readPreviousSnapshot(out);
  const snapshot = await collectSnapshot(accountId);

  console.log('[6/6] 校验快照 ...');
  const errors = validateSnapshot(snapshot, previous);
  if (errors.length > 0) {
    for (const error of errors) console.error(`  ✖ ${error}`);
    throw new Error(`快照校验失败（${errors.length} 项），未写入任何文件`);
  }
  console.log(`  - 校验通过：schema_version=${snapshot.schema_version}，matches=${snapshot.matches.length}`);
  if (snapshot.recent_matches.length !== 20) {
    console.warn(`  ! recent_matches 实际 ${snapshot.recent_matches.length} 场（页面按 20 场展示）`);
  }
  if (snapshot.rankings.length < 90) {
    console.warn(`  ! rankings 仅 ${snapshot.rankings.length} 项（该玩家历史值约 94）`);
  }

  const jsonBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  const wins = countWins(snapshot.matches);
  const winrate = ((wins / snapshot.matches.length) * 100).toFixed(2);
  const firstDate = formatUtcDate(snapshot.matches[0].start_time);
  const lastDate = formatUtcDate(snapshot.matches.at(-1).start_time);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (dryRun) {
    console.log(`\n✔ dry-run 校验通过（未写盘）：${snapshot.matches.length} 场 | 胜率 ${winrate}%（${wins} 胜）`);
    console.log(`  数据范围 ${firstDate} → ${lastDate} | 预计快照 ${formatBytes(jsonBytes)} | 耗时 ${elapsed}s`);
    return;
  }

  const writtenBytes = await writeSnapshotFile(out, snapshot);
  console.log(`  - 快照已写入 ${path.relative(ROOT, out)}（${formatBytes(writtenBytes)}）`);

  const avatar = await downloadAvatar(snapshot);

  console.log(`\n摘要：${snapshot.matches.length} 场 | 胜率 ${winrate}%（${wins} 胜） | 更新 ${snapshot.generated_at} | 快照 ${formatBytes(writtenBytes)} | 头像 ${avatar.ok ? formatBytes(avatar.bytes) : '未更新'} | 耗时 ${elapsed}s`);
  console.log(`      数据范围 ${firstDate} → ${lastDate} | 英雄 ${Object.keys(snapshot.heroes_meta).length} 个 | 同伴 ${snapshot.peers.length} 人 | 绝活榜 ${snapshot.rankings.length} 项`);
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`✖ 参数错误：${error.message}`);
  process.exit(1);
}

await main(options).catch((error) => {
  console.error(`\n✖ ${error.message}`);
  console.error('✖ 快照未更新，旧文件保持不变。');
  process.exitCode = 1;
});
