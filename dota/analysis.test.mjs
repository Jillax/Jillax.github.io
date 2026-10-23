/**
 * dota/analysis.js —— node:test 测试
 *
 * 运行方式（两种都可以）：
 *   node --test dota/analysis.test.mjs     # 仓库根目录
 *   cd dota && npm test                    # dota/package.json: node --test analysis.test.mjs charts.test.mjs
 *
 * 覆盖：
 * 1. 合成快照边界用例：空 matches、单场、多模式混合、缺 heroes_meta / rankings / totals / rank、
 *    winrate 0/1、0 场 null、streak 边界、时区归组、不可变、可序列化等；
 * 2. 真实快照不变量：若 data/dota/snapshot.json 存在（由 scripts/fetch_dota.mjs 生成），
 *    对照契约清单做真实数据校验；契约给的参考值用 ±5% 容差。快照尚未生成时自动 skip。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  analyze,
  FILTERS,
  GAME_MODE_LABELS,
  LOBBY_LABELS,
  ATTR_LABELS,
  ATTR_ORDER,
  heroWinrateSeries,
} from './analysis.js';

/* ============================================================
 * 0. 公共工具与合成数据工厂
 * ============================================================ */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'dota', 'snapshot.json');

const RESULT_KEYS = [
  'generatedAt', 'profile', 'filter', 'filters', 'overview', 'career', 'monthly', 'hourly',
  'weekday', 'heatmap', 'side', 'modes', 'lobbies', 'streak', 'heroes', 'bestHeroes',
  'worstHeroes', 'signature', 'heroPool', 'recent', 'peers', 'wordcloud', 'insights', 'facts',
];
const OVERVIEW_KEYS = [
  'games', 'wins', 'losses', 'winrate', 'avgDurationMin', 'kda', 'avgKills', 'avgDeaths',
  'avgAssists', 'totalHours', 'firstMatchAt', 'lastMatchAt',
];
const HERO_KEYS = [
  'heroId', 'slug', 'zh', 'en', 'attr', 'attrLabel', 'attackType', 'roles', 'img', 'icon',
  'games', 'wins', 'losses', 'winrate', 'kda', 'avgDurationMin', 'lastPlayed', 'percentRank',
];
const INSIGHT_KINDS = new Set(['signature', 'mode', 'time', 'streak', 'peer', 'volume', 'habit', 'side']);

/** 本地时间（UTC+8）→ epoch 秒 */
function localEpoch(year, month, day, hour = 12, minute = 0) {
  return Math.floor(Date.UTC(year, month - 1, day, hour - 8, minute, 0) / 1000);
}

const BASE_TIME = localEpoch(2024, 1, 15, 12);
let nextMatchId = 1;

/** 造一场快照格式的对局（12 字段；extra 用于 recent_matches 的额外字段）。 */
function makeMatch(options = {}) {
  const {
    matchId = nextMatchId++,
    playerSlot = 0,
    radiantWin = true,
    heroId = 1,
    startTime,
    duration = 1800,
    gameMode = 22,
    lobbyType = 0,
    kills = 5,
    deaths = 5,
    assists = 5,
    averageRank = 50,
    extra,
  } = options;
  const match = {
    match_id: matchId,
    player_slot: playerSlot,
    radiant_win: radiantWin,
    hero_id: heroId,
    start_time: startTime === undefined ? BASE_TIME + matchId * 3600 : startTime,
    duration,
    game_mode: gameMode,
    lobby_type: lobbyType,
    kills,
    deaths,
    assists,
    average_rank: averageRank,
  };
  if (extra && typeof extra === 'object') Object.assign(match, extra);
  return match;
}

/** 造一条 heroes_meta。 */
function makeHeroMeta(overrides = {}) {
  const id = overrides.id ?? 1;
  return {
    slug: 'hero' + id,
    name: 'npc_dota_hero_hero' + id,
    zh: '英雄' + id,
    en: 'Hero ' + id,
    attr: 'agi',
    attack_type: 'Melee',
    roles: ['Carry', 'Escape'],
    img: 'https://cdn.example.com/heroes/' + id + '.png',
    icon: 'https://cdn.example.com/heroes/icons/' + id + '.png',
    ...overrides,
  };
}

/** 造一份最小合法快照。传入的 overrides 直接覆盖顶层字段。 */
function makeSnapshot(overrides = {}) {
  const base = {
    schema_version: 1,
    generated_at: '2026-10-23T13:40:00.000Z',
    source: 'https://api.opendota.com/api',
    account_id: 1063862727,
    steamid: '76561199024128455',
    profile: {
      personaname: 'Jillax',
      avatar: 'https://avatars.akamai.steamstatic.com/a.jpg',
      avatarfull: 'https://avatars.akamai.steamstatic.com/a_full.jpg',
      profileurl: 'https://steamcommunity.com/profiles/76561199024128455/',
    },
    rank: { rank_tier: 80, leaderboard_rank: 2448, computed_mmr: 3915.39, computed_mmr_turbo: 3954.24 },
    aliases: [
      { personaname: 'Jillax', name_since: '2026-06-25T10:08:32.000Z' },
      { personaname: 'Jillax.Yatoro', name_since: '2026-08-23T10:49:39.000Z' },
      { personaname: '张雪峰', name_since: '2026-06-25T09:18:25.000Z' },
    ],
    matches: [],
    recent_matches: [],
    totals: [],
    counts: {},
    heroes: [],
    heroes_meta: { 1: makeHeroMeta({ id: 1 }) },
    peers: [],
    rankings: [],
    wordcloud: { all_word_counts: {} },
  };
  return { ...base, ...overrides };
}

/** 快照里的胜负判定（测试侧独立实现，避免直接用被测代码的私有逻辑）。 */
function isWin(match) {
  return (match.player_slot < 128) === match.radiant_win;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 校验 0..1 的 winrate 形状：要么 null，要么 [0,1] 数字。 */
function assertWinrateShape(value, label) {
  if (value === null) return;
  assert.equal(typeof value, 'number', label + ' 应为数字或 null');
  assert.ok(Number.isFinite(value), label + ' 不应是 NaN/Infinity');
  assert.ok(value >= 0 && value <= 1, label + ' 应在 0..1，实际 ' + value);
}

/** 契约参考值 ±5% 容差断言。 */
function assertWithinRef(actual, expected, label) {
  const tolerance = Math.abs(expected) * 0.05;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    label + '：参考值 ' + expected + '（±5% → ' + tolerance.toFixed(2) + '），实际 ' + actual,
  );
}

/* ============================================================
 * 1. 常量
 * ============================================================ */

test('常量：FILTERS / 标签表 / 属性顺序与契约一致', () => {
  assert.deepEqual(FILTERS, [
    { key: 'all', label: '全部对局' },
    { key: 'ranked', label: '天梯' },
    { key: 'turbo', label: '快速模式' },
    { key: 'serious', label: '非快速' },
    { key: 'normal', label: '普通匹配' },
  ]);
  assert.equal(GAME_MODE_LABELS[1], '全英雄选择');
  assert.equal(GAME_MODE_LABELS[22], '全英雄选择');
  assert.equal(GAME_MODE_LABELS[23], '快速模式');
  assert.equal(GAME_MODE_LABELS[2], '队长模式');
  assert.equal(LOBBY_LABELS[0], '普通匹配');
  assert.equal(LOBBY_LABELS[7], '天梯匹配');
  assert.equal(LOBBY_LABELS[14], '新手匹配');
  assert.deepEqual(ATTR_LABELS, { str: '力量', agi: '敏捷', int: '智力', all: '全才' });
  assert.deepEqual(ATTR_ORDER, ['str', 'agi', 'int', 'all']);
});

/* ============================================================
 * 2. 合成快照边界用例
 * ============================================================ */

test('空快照：结构完整、全部安全零值、winrate=null', () => {
  const result = analyze(makeSnapshot({ heroes_meta: {} }));

  assert.deepEqual(Object.keys(result), RESULT_KEYS);
  assert.equal(result.generatedAt, '2026-10-23T13:40:00.000Z');

  // profile
  assert.equal(result.profile.accountId, 1063862727);
  assert.equal(result.profile.name, 'Jillax');
  assert.equal(result.profile.steamid, '76561199024128455');
  assert.deepEqual(result.profile.rank, {
    tier: 8, tierName: '不朽', stars: 0, leaderboardRank: 2448, mmr: 3915.39, mmrTurbo: 3954.24,
  });
  // aliases：按 name_since 升序
  assert.deepEqual(result.profile.aliases, ['张雪峰', 'Jillax', 'Jillax.Yatoro']);

  // filter / filters
  assert.deepEqual(result.filter, { key: 'all', label: '全部对局', games: 0 });
  assert.deepEqual(result.filters.map((item) => item.key), ['all', 'ranked', 'turbo', 'serious', 'normal']);
  assert.ok(result.filters.every((item) => item.games === 0 && typeof item.label === 'string'));

  // overview
  assert.deepEqual(Object.keys(result.overview), OVERVIEW_KEYS);
  assert.equal(result.overview.games, 0);
  assert.equal(result.overview.wins, 0);
  assert.equal(result.overview.losses, 0);
  assert.equal(result.overview.winrate, null);
  assert.equal(result.overview.kda, null);
  assert.equal(result.overview.totalHours, 0);
  assert.equal(result.overview.firstMatchAt, null);
  assert.equal(result.overview.lastMatchAt, null);

  // career
  assert.equal(result.career.kills, 0);
  assert.equal(result.career.hours, 0);
  assert.equal(result.career.kda, 0);

  // 时间序列
  assert.deepEqual(result.monthly, []);
  assert.equal(result.hourly.length, 24);
  assert.equal(result.weekday.length, 7);
  assert.deepEqual(result.weekday.map((item) => item.label), ['周日', '周一', '周二', '周三', '周四', '周五', '周六']);
  assert.equal(result.heatmap.length, 168);
  assert.ok(result.hourly.every((item) => item.games === 0 && item.winrate === null));
  assert.ok(result.heatmap.every((item) => item.games === 0 && item.winrate === null));

  // 分组
  assert.deepEqual(result.side.map((item) => [item.key, item.games, item.winrate]), [
    ['radiant', 0, null], ['dire', 0, null],
  ]);
  assert.deepEqual(result.modes, []);
  assert.deepEqual(result.lobbies, []);
  assert.deepEqual(result.streak, { currentType: null, currentLength: 0, longestWin: 0, longestLoss: 0 });

  // 英雄
  assert.deepEqual(result.heroes, []);
  assert.deepEqual(result.bestHeroes, []);
  assert.deepEqual(result.worstHeroes, []);
  assert.deepEqual(result.signature, []);
  assert.deepEqual(result.heroPool, {
    played: 0,
    available: 0,
    attrs: ATTR_ORDER.map((key) => ({ key, label: ATTR_LABELS[key], games: 0, share: 0 })),
    roles: [],
    meleeShare: 0,
  });

  // 最近 / 搭子 / 词云
  assert.deepEqual(result.recent, {
    count: 0, wins: 0, winrate: null, kda: null,
    avgGpm: 0, avgXpm: 0, avgLastHits: 0, avgHeroDamage: 0, items: [],
  });
  assert.deepEqual(result.peers, []);
  assert.deepEqual(result.wordcloud, []);

  // 空数据：insights 给 1 条空态，facts 不硬凑
  assert.equal(result.insights.length, 1);
  assert.equal(result.insights[0].kind, 'volume');
  assert.equal(typeof result.insights[0].title, 'string');
  assert.deepEqual(result.facts, []);
});

test('单场快照：胜率 / 时长 / KDA / 英雄 / 时间桶基线', () => {
  const match = makeMatch({
    playerSlot: 0,
    radiantWin: true,
    heroId: 1,
    startTime: localEpoch(2024, 1, 15, 12),
    duration: 1800,
    kills: 5,
    deaths: 5,
    assists: 5,
    gameMode: 22,
    lobbyType: 0,
  });
  const result = analyze(makeSnapshot({ matches: [match], rankings: [{ hero_id: 1, percent_rank: 0.5 }] }));

  assert.equal(result.overview.games, 1);
  assert.equal(result.overview.wins, 1);
  assert.equal(result.overview.losses, 0);
  assert.equal(result.overview.winrate, 1);
  assert.equal(result.overview.avgDurationMin, 30);
  assert.equal(result.overview.kda, 2); // (5+5)/5，总量比
  assert.equal(result.overview.totalHours, 0.5);
  assert.equal(result.overview.firstMatchAt, match.start_time);
  assert.equal(result.overview.lastMatchAt, match.start_time);

  assert.deepEqual(result.streak, { currentType: 'win', currentLength: 1, longestWin: 1, longestLoss: 0 });

  assert.equal(result.heroes.length, 1);
  const hero = result.heroes[0];
  assert.deepEqual(Object.keys(hero), HERO_KEYS);
  assert.equal(hero.heroId, 1);
  assert.equal(hero.slug, 'hero1');
  assert.equal(hero.zh, '英雄1');
  assert.equal(hero.en, 'Hero 1');
  assert.equal(hero.attr, 'agi');
  assert.equal(hero.attrLabel, '敏捷');
  assert.equal(hero.attackType, 'Melee');
  assert.deepEqual(hero.roles, ['Carry', 'Escape']);
  assert.equal(hero.games, 1);
  assert.equal(hero.wins, 1);
  assert.equal(hero.losses, 0);
  assert.equal(hero.winrate, 1);
  assert.equal(hero.kda, 2);
  assert.equal(hero.avgDurationMin, 30);
  assert.equal(hero.lastPlayed, match.start_time);
  assert.equal(hero.percentRank, 0.5);

  assert.deepEqual(result.bestHeroes, []); // 样本 < 8
  assert.deepEqual(result.worstHeroes, []);
  assert.equal(result.signature.length, 1);
  assert.deepEqual(result.signature[0], {
    heroId: 1, zh: '英雄1', icon: 'https://cdn.example.com/heroes/icons/1.png',
    games: 1, wins: 1, winrate: 1, percentRank: 0.5,
  });

  assert.deepEqual(result.monthly, [{ key: '2024-01', games: 1, wins: 1, winrate: 1 }]);
  assert.equal(result.hourly.reduce((sum, item) => sum + item.games, 0), 1);
  assert.equal(result.weekday.reduce((sum, item) => sum + item.games, 0), 1);
  assert.equal(result.heatmap.reduce((sum, item) => sum + item.games, 0), 1);

  assert.deepEqual(result.side.map((item) => [item.key, item.games, item.wins, item.winrate]), [
    ['radiant', 1, 1, 1], ['dire', 0, 0, null],
  ]);
  assert.deepEqual(result.modes, [{ key: 22, label: '全英雄选择', games: 1, wins: 1, winrate: 1 }]);
  assert.deepEqual(result.lobbies, [{ key: 0, label: '普通匹配', games: 1, wins: 1, winrate: 1 }]);

  // 每个筛选的 games 手算一致
  const gamesByFilter = {
    all: 1, ranked: 0, turbo: 0, serious: 1, normal: 1,
  };
  assert.deepEqual(result.filters.map((item) => item.games), [
    gamesByFilter.all, gamesByFilter.ranked, gamesByFilter.turbo, gamesByFilter.serious, gamesByFilter.normal,
  ]);
  assert.equal(analyze(makeSnapshot({ matches: [match] }), 'turbo').overview.winrate, null);

  // facts：无 totals 时用 matches 兜底，仍是 3-6 条有数可讲的事实
  assert.ok(result.facts.length >= 3 && result.facts.length <= 6);
  assert.ok(result.facts.every((fact) =>
    typeof fact.label === 'string' && fact.label &&
    typeof fact.value === 'string' && fact.value &&
    typeof fact.hint === 'string'));
});

test('多模式混合：filters 计数、聚合、筛选联动与固定区块', () => {
  const at = (index) => BASE_TIME + index * 3600;
  const matches = [
    makeMatch({ heroId: 1, gameMode: 23, lobbyType: 0, radiantWin: true, startTime: at(0) }),
    makeMatch({ heroId: 1, gameMode: 23, lobbyType: 0, radiantWin: false, startTime: at(1) }),
    makeMatch({ heroId: 1, gameMode: 23, lobbyType: 0, radiantWin: true, startTime: at(2) }),
    makeMatch({ heroId: 2, gameMode: 22, lobbyType: 7, radiantWin: true, startTime: at(3) }),
    makeMatch({ heroId: 2, gameMode: 22, lobbyType: 7, radiantWin: true, startTime: at(4) }),
    makeMatch({ heroId: 1, gameMode: 22, lobbyType: 0, radiantWin: false, startTime: at(5) }),
    makeMatch({ heroId: 1, gameMode: 22, lobbyType: 0, radiantWin: false, startTime: at(6) }),
    makeMatch({ heroId: 3, gameMode: 1, lobbyType: 1, radiantWin: true, startTime: at(7) }),
    makeMatch({ heroId: 3, gameMode: 1, lobbyType: 1, radiantWin: false, startTime: at(8) }),
    makeMatch({ heroId: 2, gameMode: 23, lobbyType: 7, radiantWin: true, startTime: at(9) }),
  ];
  const peers = [{ account_id: 9, personaname: '搭子', with_games: 4, with_win: 3, last_played: 1700000000, avatar: 'x' }];
  const wordcloud = { all_word_counts: { swap: 40, gg: 30 } };
  const snapshot = makeSnapshot({ matches, peers, wordcloud });

  const expectedGames = {
    all: matches.length,
    ranked: matches.filter((match) => match.lobby_type === 7).length,
    turbo: matches.filter((match) => match.game_mode === 23).length,
    serious: matches.filter((match) => match.game_mode !== 23).length,
    normal: matches.filter((match) => match.lobby_type === 0).length,
  };
  // 手算：turbo=4（含 1 场天梯快速）、serious=6、ranked=3、normal=5
  assert.deepEqual(expectedGames, { all: 10, ranked: 3, turbo: 4, serious: 6, normal: 5 });

  const allResult = analyze(snapshot, 'all');
  assert.deepEqual(allResult.filters.map((item) => [item.key, item.games]), [
    ['all', 10], ['ranked', 3], ['turbo', 4], ['serious', 6], ['normal', 5],
  ]);
  assert.equal(allResult.filter.games, 10);

  for (const key of Object.keys(expectedGames)) {
    const result = analyze(snapshot, key);
    const games = expectedGames[key];
    assert.equal(result.overview.games, games, key + ' overview.games');
    assert.equal(result.filter.games, games, key + ' filter.games');
    assert.equal(result.filter.key, key);
    assert.equal(result.overview.wins, matches.filter((match) => {
      const matchesFilter = key === 'all' ? true
        : key === 'ranked' ? match.lobby_type === 7
          : key === 'turbo' ? match.game_mode === 23
            : key === 'serious' ? match.game_mode !== 23
              : match.lobby_type === 0;
      return matchesFilter && isWin(match);
    }).length, key + ' overview.wins');

    // 各聚合的 games 合计必须等于筛选后的场次
    assert.equal(result.heroes.reduce((sum, hero) => sum + hero.games, 0), games, key + ' heroes 合计');
    assert.equal(result.modes.reduce((sum, mode) => sum + mode.games, 0), games, key + ' modes 合计');
    assert.equal(result.lobbies.reduce((sum, lobby) => sum + lobby.games, 0), games, key + ' lobbies 合计');
    assert.equal(result.hourly.reduce((sum, item) => sum + item.games, 0), games, key + ' hourly 合计');
    assert.equal(result.weekday.reduce((sum, item) => sum + item.games, 0), games, key + ' weekday 合计');
    assert.equal(result.heatmap.reduce((sum, item) => sum + item.games, 0), games, key + ' heatmap 合计');
    assert.equal(result.side.reduce((sum, item) => sum + item.games, 0), games, key + ' side 合计');

    // modes / lobbies 按 games 降序
    for (const rows of [result.modes, result.lobbies]) {
      for (let index = 1; index < rows.length; index += 1) {
        assert.ok(rows[index - 1].games >= rows[index].games, key + ' 分组未按场次降序');
      }
    }
  }

  // turbo 筛选下：heroes 只含快速模式用过的英雄；career / recent / peers / wordcloud 不受影响
  const turboResult = analyze(snapshot, 'turbo');
  assert.ok(turboResult.heroes.every((hero) => [1, 2].includes(hero.heroId)));
  for (const section of ['career', 'recent', 'peers', 'wordcloud', 'facts']) {
    assert.deepEqual(turboResult[section], allResult[section], section + ' 不应随筛选变化');
  }

  // 未知筛选 key 回退 all
  const fallback = analyze(snapshot, 'not-a-filter');
  assert.equal(fallback.filter.key, 'all');
  assert.equal(fallback.overview.games, 10);
});

test('winrate：0 与 1 都保留为数字，0 场时为 null', () => {
  const losses = [
    makeMatch({ radiantWin: false, startTime: BASE_TIME }),
    makeMatch({ radiantWin: false, startTime: BASE_TIME + 3600 }),
  ];
  const losing = analyze(makeSnapshot({ matches: losses }));
  assert.equal(losing.overview.games, 2);
  assert.equal(losing.overview.wins, 0);
  assert.equal(losing.overview.losses, 2);
  assert.equal(losing.overview.winrate, 0); // 0% 不是 null
  assert.equal(losing.side[0].winrate, 0);
  assert.equal(losing.streak.currentType, 'loss');
  assert.equal(losing.streak.currentLength, 2);
  assert.equal(losing.streak.longestLoss, 2);

  const winning = analyze(makeSnapshot({ matches: [makeMatch({ radiantWin: true })] }));
  assert.equal(winning.overview.winrate, 1);

  // 该快照没有快速模式对局 → turbo 筛选 0 场，winrate 必须是 null
  const emptyFilter = analyze(makeSnapshot({ matches: losses }), 'turbo');
  assert.equal(emptyFilter.overview.games, 0);
  assert.equal(emptyFilter.overview.winrate, null);
  assert.equal(emptyFilter.filter.games, 0);
  assert.equal(emptyFilter.monthly.length, 0);
  assert.ok(emptyFilter.hourly.every((item) => item.winrate === null));
  assert.ok(emptyFilter.weekday.every((item) => item.winrate === null));
  assert.ok(emptyFilter.heatmap.every((item) => item.winrate === null));
  assert.deepEqual(emptyFilter.heroes, []);
});

test('KDA 口径：统一为总量比；整组 0 死亡时返回 null', () => {
  // 两场：(10+5)/1 与 (0+0)/9 → 总量比 (10+5+0+0)/(1+9)=1.5（若按每局平均会是 7.5）
  const matches = [
    makeMatch({ kills: 10, deaths: 1, assists: 5, startTime: BASE_TIME }),
    makeMatch({ kills: 0, deaths: 9, assists: 0, startTime: BASE_TIME + 3600 }),
  ];
  const snapshot = makeSnapshot({ matches });
  const result = analyze(snapshot);
  assert.equal(result.overview.kda, 1.5);
  assert.equal(result.heroes[0].kda, 1.5);

  // 全组 0 死亡 → null（不是 Infinity）
  const zeroDeaths = analyze(makeSnapshot({
    matches: [makeMatch({ kills: 8, deaths: 0, assists: 4, startTime: BASE_TIME })],
  }));
  assert.equal(zeroDeaths.overview.kda, null);
  assert.equal(zeroDeaths.heroes[0].kda, null);
  assert.ok(Number.isFinite(zeroDeaths.overview.avgDeaths));

  // recent 同样用总量比
  const recent = analyze(makeSnapshot({
    recent_matches: [
      makeMatch({ matchId: 1, kills: 10, deaths: 2, assists: 6, startTime: BASE_TIME }),
      makeMatch({ matchId: 2, kills: 2, deaths: 8, assists: 2, startTime: BASE_TIME + 3600 }),
    ],
  }));
  assert.equal(recent.recent.kda, 2); // (10+6+2+2)/(2+8)

  // career.kda 沿用契约公式（总量比），和 overview 口径一致
  const career = analyze(makeSnapshot({
    totals: [
      { field: 'kills', n: 3, sum: 30 },
      { field: 'deaths', n: 3, sum: 10 },
      { field: 'assists', n: 3, sum: 20 },
    ],
  }));
  assert.equal(career.career.kda, 5); // (30+20)/10
});

test('monthly：连续填月、空月 winrate=null、跨年连续', () => {
  const matches = [
    makeMatch({ startTime: localEpoch(2023, 12, 15, 12), radiantWin: true }),
    makeMatch({ startTime: localEpoch(2024, 1, 10, 12), radiantWin: false }),
    makeMatch({ startTime: localEpoch(2024, 3, 2, 12), radiantWin: true }),
  ];
  const result = analyze(makeSnapshot({ matches }));

  assert.deepEqual(result.monthly.map((item) => item.key), ['2023-12', '2024-01', '2024-02', '2024-03']);
  assert.deepEqual(result.monthly.map((item) => item.games), [1, 1, 0, 1]);
  assert.deepEqual(result.monthly.map((item) => item.wins), [1, 0, 0, 1]);
  assert.deepEqual(result.monthly.map((item) => item.winrate), [1, 0, null, 1]);
  assert.equal(result.monthly.reduce((sum, item) => sum + item.games, 0), 3);
});

test('hourly / weekday / heatmap：UTC+8 口径、24 小时 × 7 天、合计=场次', () => {
  // A: UTC 周日 20:00 → 本地周一 04:00
  const matchA = makeMatch({ startTime: Date.UTC(2024, 0, 7, 20, 0, 0) / 1000, radiantWin: true });
  // B: 本地周六 23:30
  const matchB = makeMatch({ startTime: localEpoch(2024, 1, 6, 23, 30), radiantWin: false });
  // C: 本地周日 00:10
  const matchC = makeMatch({ startTime: localEpoch(2024, 1, 7, 0, 10), radiantWin: true });
  const result = analyze(makeSnapshot({ matches: [matchA, matchB, matchC] }));

  assert.equal(result.hourly.length, 24);
  assert.deepEqual(result.hourly.map((item) => item.hour), Array.from({ length: 24 }, (_, hour) => hour));
  assert.equal(result.weekday.length, 7);
  assert.deepEqual(result.weekday.map((item) => item.day), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(result.heatmap.length, 168);
  result.heatmap.forEach((cell, index) => {
    assert.equal(cell.day, Math.floor(index / 24), 'heatmap 应为 day-major');
    assert.equal(cell.hour, index % 24);
    assert.equal(typeof cell.game === 'undefined', true);
  });

  // A → 周一（day 1）04 点
  assert.equal(result.weekday[1].games, 1);
  assert.equal(result.weekday[1].label, '周一');
  assert.equal(result.hourly[4].games, 1);
  assert.equal(result.heatmap[1 * 24 + 4].games, 1);
  assert.equal(result.heatmap[1 * 24 + 4].winrate, 1);

  // B → 周六（day 6）23 点
  assert.equal(result.weekday[6].games, 1);
  assert.equal(result.hourly[23].games, 1);
  assert.equal(result.heatmap[6 * 24 + 23].games, 1);
  assert.equal(result.heatmap[6 * 24 + 23].winrate, 0);

  // C → 周日（day 0）0 点
  assert.equal(result.weekday[0].games, 1);
  assert.equal(result.hourly[0].games, 1);
  assert.equal(result.heatmap[0].games, 1);

  assert.equal(result.hourly.reduce((sum, item) => sum + item.games, 0), 3);
  assert.equal(result.weekday.reduce((sum, item) => sum + item.games, 0), 3);
  assert.equal(result.heatmap.reduce((sum, item) => sum + item.games, 0), 3);
  assert.deepEqual(result.monthly.map((item) => item.key), ['2024-01']);
  assert.ok(result.hourly.every((item) => item.winrate === null || (item.winrate >= 0 && item.winrate <= 1)));
});

test('side：player_slot < 128 为天辉，胜负与 radiant_win 一致', () => {
  const matches = [
    makeMatch({ playerSlot: 0, radiantWin: true }), // 天辉胜
    makeMatch({ playerSlot: 3, radiantWin: false }), // 天辉负
    makeMatch({ playerSlot: 131, radiantWin: false }), // 夜魇胜
    makeMatch({ playerSlot: 128, radiantWin: true }), // 夜魇负
  ];
  const result = analyze(makeSnapshot({ matches }));
  assert.deepEqual(result.side.map((item) => [item.key, item.label, item.games, item.wins, item.winrate]), [
    ['radiant', '天辉', 2, 1, 0.5],
    ['dire', '夜魇', 2, 1, 0.5],
  ]);
});

test('streak：连胜 / 连败 / 单场 / 筛选内序列边界', () => {
  const sequence = (wins, startIndex = 0) => wins.map((win, index) => makeMatch({
    radiantWin: win,
    startTime: BASE_TIME + (startIndex + index) * 3600,
    matchId: 1000 + startIndex + index,
  }));

  const mixed = analyze(makeSnapshot({ matches: sequence([true, true, false, false, false, true]) }));
  assert.deepEqual(mixed.streak, { currentType: 'win', currentLength: 1, longestWin: 2, longestLoss: 3 });

  const losing = analyze(makeSnapshot({ matches: sequence([false, false, false]) }));
  assert.deepEqual(losing.streak, { currentType: 'loss', currentLength: 3, longestWin: 0, longestLoss: 3 });

  const singleWin = analyze(makeSnapshot({ matches: sequence([true]) }));
  assert.deepEqual(singleWin.streak, { currentType: 'win', currentLength: 1, longestWin: 1, longestLoss: 0 });

  // 不同筛选下 streak 按各自序列计算：全量 W(快速) L(天梯) W(快速) → 当前 1 连胜；仅快速 → 2 连胜
  const filtered = makeSnapshot({
    matches: [
      makeMatch({ gameMode: 23, lobbyType: 0, radiantWin: true, startTime: BASE_TIME }),
      makeMatch({ gameMode: 22, lobbyType: 7, radiantWin: false, startTime: BASE_TIME + 3600 }),
      makeMatch({ gameMode: 23, lobbyType: 0, radiantWin: true, startTime: BASE_TIME + 7200 }),
    ],
  });
  const allStreak = analyze(filtered, 'all').streak;
  assert.deepEqual(allStreak, { currentType: 'win', currentLength: 1, longestWin: 1, longestLoss: 1 });
  const turboStreak = analyze(filtered, 'turbo').streak;
  assert.deepEqual(turboStreak, { currentType: 'win', currentLength: 2, longestWin: 2, longestLoss: 0 });
});

test('heroes：按 games 降序、best/worst 样本门槛、signature 绝活榜、percentRank 缺失为 null', () => {
  const matches = [];
  const push = (heroId, games, wins, offsetHours) => {
    for (let index = 0; index < games; index += 1) {
      matches.push(makeMatch({
        heroId,
        radiantWin: index < wins,
        startTime: BASE_TIME + (offsetHours + index) * 3600,
        matchId: 5000 + matches.length,
      }));
    }
  };
  push(1, 9, 9, 0);
  push(2, 8, 2, 100);
  push(3, 7, 7, 200);
  push(4, 20, 10, 300);

  const snapshot = makeSnapshot({
    matches,
    heroes_meta: {
      1: makeHeroMeta({ id: 1, attr: 'str', attack_type: 'Melee', roles: ['Carry', 'Nuker'], zh: '甲' }),
      2: makeHeroMeta({ id: 2, attr: 'agi', attack_type: 'Ranged', roles: ['Escape'], zh: '乙' }),
      3: makeHeroMeta({ id: 3, attr: 'int', attack_type: 'Ranged', roles: ['Support'], zh: '丙' }),
      4: makeHeroMeta({ id: 4, attr: 'all', attack_type: 'Melee', roles: ['Carry', 'Durable'], zh: '丁' }),
    },
    rankings: [
      { hero_id: 4, percent_rank: 0.99 },
      { hero_id: 3, percent_rank: 0.7 },
      { hero_id: 1, percent_rank: 0.5 },
    ],
  });
  const result = analyze(snapshot);

  assert.deepEqual(result.heroes.map((hero) => hero.heroId), [4, 1, 2, 3]);
  assert.deepEqual(result.heroes.map((hero) => hero.games), [20, 9, 8, 7]);
  assert.equal(result.heroes.reduce((sum, hero) => sum + hero.games, 0), 44);
  assert.equal(result.heroes.find((hero) => hero.heroId === 2).percentRank, null);

  // best：样本 >= 8，按 winrate 降序
  assert.deepEqual(result.bestHeroes.map((hero) => hero.heroId), [1, 4, 2]);
  assert.ok(result.bestHeroes.every((hero) => hero.games >= 8));
  // worst：样本 >= 8，按 winrate 升序
  assert.deepEqual(result.worstHeroes.map((hero) => hero.heroId), [2, 4, 1]);

  // 与 heroes 是同一批对象引用（契约要求“同结构对象引用”）
  for (const hero of [...result.bestHeroes, ...result.worstHeroes]) {
    assert.ok(result.heroes.includes(hero), 'best/worst 应复用 heroes 里的对象引用');
  }

  assert.deepEqual(result.signature.map((item) => item.heroId), [4, 3, 1]);
  assert.ok(result.signature.every((item) => item.percentRank != null));
  for (let index = 1; index < result.signature.length; index += 1) {
    assert.ok(result.signature[index - 1].percentRank >= result.signature[index].percentRank);
  }

  // 筛选后 heroes games 合计 = 筛选场次（这里没有 turbo 对局）
  assert.deepEqual(analyze(snapshot, 'turbo').heroes, []);
});

test('缺 heroes_meta / hero_id=0：兜底完整、不抛错', () => {
  const snapshot = makeSnapshot({
    heroes_meta: {},
    heroes: [{ hero_id: 42, games: 1, win: 1, last_played: BASE_TIME }],
    matches: [
      makeMatch({ heroId: 42, radiantWin: true, startTime: BASE_TIME }),
      makeMatch({ heroId: 0, radiantWin: false, startTime: BASE_TIME + 3600 }),
    ],
    rankings: [{ hero_id: 42, percent_rank: 0.9 }],
  });
  const result = analyze(snapshot);

  assert.equal(result.heroes.length, 2);
  const unknown42 = result.heroes.find((hero) => hero.heroId === 42);
  assert.equal(unknown42.slug, 'hero-42');
  assert.equal(unknown42.zh, '英雄 42');
  assert.equal(unknown42.en, '');
  assert.equal(unknown42.attr, null);
  assert.equal(unknown42.attrLabel, null);
  assert.equal(unknown42.attackType, null);
  assert.deepEqual(unknown42.roles, []);
  assert.equal(unknown42.img, null);
  assert.equal(unknown42.icon, null);
  assert.equal(unknown42.games, 1);
  assert.equal(unknown42.percentRank, 0.9);

  const unknownZero = result.heroes.find((hero) => hero.heroId === 0);
  assert.equal(unknownZero.zh, '未知英雄');

  assert.equal(result.heroPool.played, 2);
  assert.equal(result.heroPool.available, 1); // 没有 meta 时回退 snapshot.heroes 行数
  assert.deepEqual(result.heroPool.attrs.map((attr) => attr.games), [0, 0, 0, 0]);
  assert.equal(result.heroPool.meleeShare, 0);
  assert.equal(result.heroes.reduce((sum, hero) => sum + hero.games, 0), 2);
  assert.equal(analyze(makeSnapshot({ matches: [] })).heroPool.available, 1); // meta 兜底
});

test('缺 rank / null average_rank / 缺其它字段：零值兜底', () => {
  const snapshot = makeSnapshot({
    rank: undefined,
    generated_at: undefined,
    profile: { personaname: 'Jillax' },
    aliases: undefined,
    totals: undefined,
    rankings: undefined,
    heroes_meta: undefined,
    matches: [makeMatch({
      averageRank: null,
      kills: null,
      deaths: null,
      assists: null,
      duration: null,
      startTime: BASE_TIME,
    })],
  });
  const result = analyze(snapshot);

  assert.equal(result.generatedAt, null);
  assert.equal(result.profile.accountId, 1063862727);
  assert.equal(result.profile.steamid, '76561199024128455');
  assert.deepEqual(result.profile.rank, {
    tier: null, tierName: '未定级', stars: 0, leaderboardRank: null, mmr: null, mmrTurbo: null,
  });
  assert.deepEqual(result.profile.aliases, []);

  assert.equal(result.overview.games, 1);
  assert.equal(result.overview.winrate, 1);
  assert.equal(result.overview.avgKills, 0);
  assert.equal(result.overview.avgDeaths, 0);
  assert.equal(result.overview.avgAssists, 0);
  assert.equal(result.overview.avgDurationMin, 0);
  assert.equal(result.overview.totalHours, 0);
  assert.equal(result.overview.kda, null); // 0 死亡，不返回 Infinity
  assert.equal(result.heroes[0].kda, null);
  assert.equal(result.heroes[0].avgDurationMin, 0);
  assert.equal(result.heroPool.played, 1);
  assert.equal(result.heroPool.available, 1); // 全部兜底都缺时用 heroes 数
  assert.ok(Array.isArray(result.insights));
  assert.ok(result.insights.length >= 1);
});

test('recent：固定取 recent_matches、按时间倒序、不受筛选影响', () => {
  const recentMatches = [
    makeMatch({ matchId: 11, heroId: 1, startTime: BASE_TIME, radiantWin: true, kills: 3, deaths: 4, assists: 5, duration: 1200, gameMode: 22 }),
    makeMatch({
      matchId: 13, heroId: 2, startTime: BASE_TIME + 7200, radiantWin: false, kills: 1, deaths: 6,
      assists: 2, duration: 1846, gameMode: 23,
      extra: { gold_per_min: 500, xp_per_min: 700, last_hits: 100, hero_damage: 20000 },
    }),
    makeMatch({
      matchId: 12, heroId: 1, startTime: BASE_TIME + 3600, radiantWin: true, kills: 10, deaths: 2,
      assists: 8, duration: 900, gameMode: 23,
      extra: { gold_per_min: 1442, xp_per_min: 1702, last_hits: 197, hero_damage: 37935 },
    }),
  ];
  const snapshot = makeSnapshot({
    matches: [makeMatch({ matchId: 99, gameMode: 22, startTime: BASE_TIME })],
    recent_matches: recentMatches,
    heroes_meta: { 1: makeHeroMeta({ id: 1, zh: '甲' }), 2: makeHeroMeta({ id: 2, zh: '乙' }) },
  });
  const allResult = analyze(snapshot, 'all');
  const result = allResult.recent;

  assert.equal(result.count, 3);
  assert.equal(result.wins, 2);
  assert.equal(result.winrate, round(2 / 3, 4));
  // 总量比：(3+5+1+2+10+8)/(4+6+2)
  assert.equal(result.kda, 2.42);
  assert.deepEqual(result.items.map((item) => item.matchId), [13, 12, 11]);
  assert.equal(result.items[0].durationMin, 31); // 1846s → 31 分钟
  assert.equal(result.items[0].gameModeLabel, '快速模式');

  // items 字段形状
  assert.deepEqual(Object.keys(result.items[0]), [
    'matchId', 'heroId', 'zh', 'icon', 'win', 'kills', 'deaths', 'assists', 'durationMin',
    'startTime', 'gameMode', 'gameModeLabel', 'gpm', 'xpm',
  ]);

  // 平均值只统计有值的字段（第一场缺 gpm 等）
  assert.equal(result.avgGpm, 971); // (500+1442)/2
  assert.equal(result.avgXpm, 1201); // (700+1702)/2
  assert.equal(result.avgLastHits, 149); // (100+197)/2
  assert.equal(result.avgHeroDamage, 28968); // (20000+37935)/2

  // 固定区块不受筛选影响
  assert.deepEqual(analyze(snapshot, 'turbo').recent, result);
  assert.deepEqual(analyze(snapshot, 'ranked').recent, result);
});

test('career：来自 totals、口径固定、不受筛选影响；facts 3-6 条中文换算', () => {
  const totals = [
    { field: 'kills', n: 3, sum: 30 },
    { field: 'deaths', n: 3, sum: 10 },
    { field: 'assists', n: 3, sum: 20 },
    { field: 'hero_damage', n: 3, sum: 120000 },
    { field: 'tower_damage', n: 3, sum: 30000 },
    { field: 'last_hits', n: 3, sum: 900 },
    { field: 'denies', n: 3, sum: 60 },
    { field: 'duration', n: 3, sum: 10800 },
    { field: 'pings', n: 3, sum: 12 },
    { field: 'purchase_ward_observer', n: 2, sum: 4 },
    { field: 'purchase_ward_sentry', n: 2, sum: 6 },
  ];
  const snapshot = makeSnapshot({
    matches: [makeMatch({ gameMode: 23, duration: 3600, startTime: BASE_TIME })],
    totals,
  });
  const result = analyze(snapshot);
  assert.deepEqual(result.career, {
    kills: 30,
    deaths: 10,
    assists: 20,
    heroDamage: 120000,
    towerDamage: 30000,
    lastHits: 900,
    denies: 60,
    durationSeconds: 10800,
    pings: 12,
    hours: 3,
    kda: 5, // (30+20)/10
    purchaseWardObserver: 4,
    purchaseWardSentry: 6,
  });
  assert.deepEqual(analyze(snapshot, 'turbo').career, result.career);

  assert.ok(result.facts.length >= 3 && result.facts.length <= 6);
  const labels = result.facts.map((fact) => fact.label);
  assert.ok(labels.includes('游戏内总时长'));
  assert.ok(labels.includes('生涯总场次'));
  assert.ok(labels.includes('生涯 KDA'));
  for (const fact of result.facts) {
    assert.equal(typeof fact.label, 'string');
    assert.equal(typeof fact.value, 'string');
    assert.equal(typeof fact.hint, 'string');
    assert.ok(fact.label.length > 0 && fact.value.length > 0);
    assert.match(fact.label, /[\u4e00-\u9fa5]/); // 中文文案
  }
});

test('peers / wordcloud：排序、过滤、上限', () => {
  const peers = [
    { account_id: 3, personaname: 'C', avatar: 'c', with_games: 5, with_win: 1, last_played: BASE_TIME },
    { account_id: 1, personaname: 'A', avatar: 'a', with_games: 50, with_win: 30, last_played: BASE_TIME + 10 },
    { account_id: 2, personaname: 'B', avatar: 'b', with_games: 10, with_win: 8, last_played: BASE_TIME + 20 },
    { account_id: 4, personaname: 'D', avatar: 'd', with_games: 0, with_win: 0 },
  ];
  const wordCounts = {
    u: 50, i: 40, the: 30, and: 20, to: 18, swap: 10, gg: 6, bro: 5, rare: 2, lonely: 3,
  };
  const baseResult = analyze(makeSnapshot({ peers, wordcloud: { all_word_counts: wordCounts } }));

  assert.deepEqual(baseResult.peers.map((peer) => peer.accountId), [1, 2, 3, 4]);
  assert.equal(baseResult.peers[0].winrate, 0.6);
  assert.equal(baseResult.peers[0].games, 50);
  assert.equal(baseResult.peers[1].winrate, 0.8);
  assert.equal(baseResult.peers[3].winrate, null); // 0 场

  // 单字母 / 停用词 / 低频词都被过滤，游戏用语保留
  assert.deepEqual(baseResult.wordcloud, [
    { word: 'swap', count: 10 },
    { word: 'gg', count: 6 },
    { word: 'bro', count: 5 },
    { word: 'lonely', count: 3 },
  ]);

  // 词频降序最多 48 条：补 60 个高频词验证上限
  const manyCounts = { ...wordCounts };
  for (let index = 0; index < 60; index += 1) {
    manyCounts['word' + String(index).padStart(2, '0')] = 100 + index;
  }
  const manyResult = analyze(makeSnapshot({ wordcloud: { all_word_counts: manyCounts } }));
  assert.equal(manyResult.wordcloud.length, 48);
  for (let index = 1; index < manyResult.wordcloud.length; index += 1) {
    assert.ok(manyResult.wordcloud[index - 1].count >= manyResult.wordcloud[index].count);
  }
  assert.ok(manyResult.wordcloud.every((item) => item.count >= 3 && item.word.length > 1));
});

test('heroPool：属性分布 / 角色统计 / 近战占比 / 英雄池数量', () => {
  const matches = [];
  const push = (heroId, games) => {
    for (let index = 0; index < games; index += 1) {
      matches.push(makeMatch({ heroId, startTime: BASE_TIME + matches.length * 3600, matchId: 9000 + matches.length }));
    }
  };
  push(1, 3); // str melee Carry
  push(2, 1); // agi ranged Escape
  const snapshot = makeSnapshot({
    matches,
    heroes_meta: {
      1: makeHeroMeta({ id: 1, attr: 'str', attack_type: 'Melee', roles: ['Carry'] }),
      2: makeHeroMeta({ id: 2, attr: 'agi', attack_type: 'Ranged', roles: ['Escape'] }),
      3: makeHeroMeta({ id: 3, attr: 'int', attack_type: 'Melee', roles: ['Carry'] }), // 没玩过
    },
  });
  const result = analyze(snapshot);

  assert.equal(result.heroPool.played, 2);
  assert.equal(result.heroPool.available, 3);
  assert.deepEqual(result.heroPool.attrs, [
    { key: 'str', label: '力量', games: 3, share: 0.75 },
    { key: 'agi', label: '敏捷', games: 1, share: 0.25 },
    { key: 'int', label: '智力', games: 0, share: 0 },
    { key: 'all', label: '全才', games: 0, share: 0 },
  ]);
  assert.deepEqual(result.heroPool.roles, [{ role: 'Carry', games: 3 }, { role: 'Escape', games: 1 }]);
  assert.equal(result.heroPool.meleeShare, 0.75);
});

test('insights：5-8 条、kind 合法、中文且带真实数字', () => {
  const at = (index) => BASE_TIME + index * 3600;
  const matches = [];
  // 25 场克林克兹（模拟绝活），分布到不同时间；再掺一些其他英雄
  for (let index = 0; index < 25; index += 1) {
    matches.push(makeMatch({
      heroId: 1, radiantWin: index % 5 !== 0, startTime: at(index), matchId: 10000 + index,
    }));
  }
  for (let index = 0; index < 12; index += 1) {
    matches.push(makeMatch({
      heroId: 2, radiantWin: index % 2 === 0, startTime: at(100 + index), matchId: 11000 + index,
    }));
  }
  const snapshot = makeSnapshot({
    matches,
    heroes_meta: { 1: makeHeroMeta({ id: 1, zh: '克林克兹' }), 2: makeHeroMeta({ id: 2, zh: '敌法师' }) },
    rankings: [{ hero_id: 1, percent_rank: 0.99 }],
    peers: [{ account_id: 7, personaname: 'Kamikaze', with_games: 15, with_win: 11, last_played: BASE_TIME }],
  });
  const result = analyze(snapshot);

  assert.ok(result.insights.length >= 5 && result.insights.length <= 8, 'insights 应为 5-8 条');
  for (const insight of result.insights) {
    assert.ok(INSIGHT_KINDS.has(insight.kind), '非法 kind：' + insight.kind);
    assert.equal(typeof insight.title, 'string');
    assert.equal(typeof insight.text, 'string');
    assert.ok(insight.title.length > 0 && insight.text.length > 0);
    assert.match(insight.text, /\d/, 'insight 文案应包含数字');
    assert.match(insight.text, /[\u4e00-\u9fa5]/, 'insight 文案应为中文');
  }
  // 该快照没有天梯/快速模式差异，也没有足够样本给 side，但至少要有绝活/习惯/连胜/产量
  assert.ok(result.insights.some((insight) => insight.kind === 'signature'));
  assert.ok(result.insights.some((insight) => insight.kind === 'habit'));

  // 空数据只给一条空态
  const empty = analyze(makeSnapshot({ matches: [], heroes_meta: {} }));
  assert.equal(empty.insights.length, 1);
});

test('start_time 全部缺失：时区桶安全为空，insights 仍有 5-8 条', () => {
  const snapshot = makeSnapshot({
    matches: [
      // 用 extra 覆盖掉工厂给的时间字段
      makeMatch({ matchId: 21, heroId: 1, extra: { start_time: null } }),
      makeMatch({ matchId: 22, heroId: 2, radiantWin: false, extra: { start_time: null } }),
    ],
    heroes_meta: { 1: makeHeroMeta({ id: 1, zh: '甲' }), 2: makeHeroMeta({ id: 2, zh: '乙' }) },
  });
  const result = analyze(snapshot);

  assert.equal(result.overview.games, 2);
  assert.deepEqual(result.monthly, []);
  assert.ok(result.hourly.every((item) => item.games === 0 && item.winrate === null));
  assert.ok(result.heatmap.every((item) => item.games === 0 && item.winrate === null));
  assert.ok(result.overview.firstMatchAt === null && result.overview.lastMatchAt === null);
  assert.ok(result.insights.length >= 5 && result.insights.length <= 8);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('analyze 不修改入参（深比较前后快照）', () => {
  const snapshot = makeSnapshot({
    matches: [
      makeMatch({ heroId: 1, gameMode: 23, radiantWin: true, startTime: BASE_TIME }),
      makeMatch({ heroId: 2, gameMode: 22, lobbyType: 7, radiantWin: false, startTime: BASE_TIME + 3600 }),
      makeMatch({ heroId: 1, gameMode: 22, lobbyType: 0, radiantWin: true, startTime: BASE_TIME + 7200 }),
    ],
    recent_matches: [makeMatch({ matchId: 77, startTime: BASE_TIME })],
    peers: [{ account_id: 5, personaname: 'P', with_games: 3, with_win: 2 }],
    rankings: [{ hero_id: 1, percent_rank: 0.8 }],
    wordcloud: { all_word_counts: { swap: 5, gg: 4 } },
    totals: [{ field: 'kills', n: 3, sum: 15 }],
    heroes_meta: { 1: makeHeroMeta({ id: 1 }), 2: makeHeroMeta({ id: 2 }) },
  });
  const before = JSON.parse(JSON.stringify(snapshot));
  for (const key of ['all', 'ranked', 'turbo', 'serious', 'normal']) analyze(snapshot, key);
  heroWinrateSeries(analyze(snapshot).heroes);
  assert.deepEqual(snapshot, before);
});

test('输出可 JSON 序列化（无 NaN / undefined / Infinity）', () => {
  const snapshot = makeSnapshot({
    matches: [
      makeMatch({ heroId: 1, gameMode: 23, radiantWin: true, startTime: BASE_TIME }),
      makeMatch({ heroId: 2, gameMode: 22, lobbyType: 7, radiantWin: false, startTime: BASE_TIME + 3600 }),
    ],
    recent_matches: [makeMatch({ matchId: 88, startTime: BASE_TIME, gold_per_min: 500, xp_per_min: 600, last_hits: 100, hero_damage: 20000 })],
    peers: [{ account_id: 5, personaname: 'P', with_games: 2, with_win: 1 }],
    rankings: [{ hero_id: 1, percent_rank: 0.8 }],
    wordcloud: { all_word_counts: { swap: 5 } },
    totals: [{ field: 'duration', n: 2, sum: 3600 }],
    heroes_meta: { 1: makeHeroMeta({ id: 1 }), 2: makeHeroMeta({ id: 2 }) },
  });
  const result = analyze(snapshot);
  const roundTripped = JSON.parse(JSON.stringify(result));
  assert.deepEqual(roundTripped, result);
});

/* ============================================================
 * 3. heroWinrateSeries
 * ============================================================ */

test('heroWinrateSeries：默认门槛 8、按胜率降序、meta 保留原对象引用', () => {
  const heroes = [
    { heroId: 1, zh: '甲', en: '', slug: 'a', games: 10, winrate: 0.5 },
    { heroId: 2, zh: '乙', en: '', slug: 'b', games: 8, winrate: 0.75 },
    { heroId: 3, zh: '丙', en: '', slug: 'c', games: 7, winrate: 1 },
    { heroId: 4, en: 'Hero 4', slug: 'd', games: 12, winrate: null },
    { heroId: 5, zh: '戊', en: '', slug: 'e', games: 9, winrate: 0.6 },
  ];
  const series = heroWinrateSeries(heroes);
  assert.deepEqual(series.map((item) => item.label), ['乙', '戊', '甲']);
  assert.deepEqual(series.map((item) => item.value), [0.75, 0.6, 0.5]);
  assert.equal(series[0].meta, heroes[1]);

  const relaxed = heroWinrateSeries(heroes, 1);
  assert.deepEqual(relaxed.map((item) => item.label), ['丙', '乙', '戊', '甲']);
  assert.deepEqual(heroWinrateSeries(heroes, 20), []);
  assert.deepEqual(heroWinrateSeries(null), []);
  assert.deepEqual(heroWinrateSeries([]), []);
});

/* ============================================================
 * 4. 真实快照不变量（data/dota/snapshot.json 存在才有意义）
 * ============================================================ */

let REAL_SNAPSHOT = null;
if (existsSync(SNAPSHOT_PATH)) {
  try {
    REAL_SNAPSHOT = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch (error) {
    REAL_SNAPSHOT = null;
    console.warn('[analysis.test] 读取真实快照失败，跳过真实数据校验：' + error.message);
  }
}
const REAL = REAL_SNAPSHOT ? analyze(REAL_SNAPSHOT, 'all') : null;
const REAL_SKIP = REAL ? false : 'data/dota/snapshot.json 不存在或不可读，跳过真实数据校验';

/** 真实快照的独立对照工具 */
const TZ8 = 8 * 3600;
const realIsWin = (match) => (match.player_slot < 128) === match.radiant_win;
const localMonthKey = (seconds) => {
  const date = new Date((seconds + TZ8) * 1000);
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
};
const nextMonthKey = (key) => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
};

test('真实快照：overview / filters 与手算一致，参考值 ±5%', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const result = REAL;
  const matches = snapshot.matches;
  const winCount = matches.filter(realIsWin).length;

  // 契约清单：all 筛选 games === matches.length
  assert.equal(result.overview.games, matches.length);
  assert.equal(result.overview.wins, winCount);
  assert.equal(result.overview.losses, matches.length - winCount);
  assert.ok(Math.abs(result.overview.winrate - winCount / matches.length) < 1e-3);

  // 参考值 ±5%：1814 场 / 胜 1067 / turbo 809 / serious 1005 / ranked 544
  assertWithinRef(result.overview.games, 1814, 'all games');
  assertWithinRef(result.overview.wins, 1067, 'all wins');
  const byFilter = Object.fromEntries(result.filters.map((item) => [item.key, item.games]));
  assertWithinRef(byFilter.turbo, 809, 'turbo games');
  assertWithinRef(byFilter.serious, 1005, 'serious games');
  assertWithinRef(byFilter.ranked, 544, 'ranked games');

  // filters 各项与手算一致（精确）
  const expected = {
    all: matches.length,
    ranked: matches.filter((match) => match.lobby_type === 7).length,
    turbo: matches.filter((match) => match.game_mode === 23).length,
    serious: matches.filter((match) => match.game_mode !== 23).length,
    normal: matches.filter((match) => match.lobby_type === 0).length,
  };
  assert.deepEqual(byFilter, expected);
  assert.deepEqual(result.filters.map((item) => item.key), ['all', 'ranked', 'turbo', 'serious', 'normal']);
  assert.deepEqual(result.filter, { key: 'all', label: '全部对局', games: matches.length });

  // 均值口径
  const sum = (field) => matches.reduce((total, match) => total + match[field], 0);
  assert.equal(result.overview.avgKills, round(sum('kills') / matches.length, 2));
  assert.equal(result.overview.avgDeaths, round(sum('deaths') / matches.length, 2));
  assert.equal(result.overview.avgAssists, round(sum('assists') / matches.length, 2));
  assert.equal(result.overview.avgDurationMin, round(sum('duration') / matches.length / 60, 1));
  assert.equal(result.overview.totalHours, round(sum('duration') / 3600, 1));
  // KDA 统一总量比
  assert.equal(result.overview.kda, round((sum('kills') + sum('assists')) / sum('deaths'), 2));
  assertWithinRef(result.overview.kda, 3.88, 'overview.kda');
  assertWithinRef(result.career.kda, 3.88, 'career.kda');

  // profile
  assert.equal(result.generatedAt, snapshot.generated_at);
  assert.equal(result.profile.accountId, snapshot.account_id);
  assert.equal(result.profile.name, snapshot.profile.personaname);
  assert.equal(result.profile.steamid, snapshot.steamid);
  assert.equal(result.profile.rank.tier, 8);
  assert.equal(result.profile.rank.tierName, '不朽');
  assert.equal(result.profile.rank.stars, 0);
  assert.equal(result.profile.rank.leaderboardRank, 2448);
  assert.equal(result.profile.rank.mmr, 3915.39);
  assert.equal(result.profile.rank.mmrTurbo, 3954.24);
  // aliases 与按 name_since 升序的手算一致
  const expectedAliases = snapshot.aliases
    .slice()
    .sort((a, b) => Date.parse(a.name_since) - Date.parse(b.name_since))
    .map((alias) => alias.personaname);
  assert.deepEqual(result.profile.aliases, expectedAliases);

  // career 与 totals 精确一致
  const totals = Object.fromEntries(snapshot.totals.map((row) => [row.field, row.sum]));
  assert.equal(result.career.kills, totals.kills);
  assert.equal(result.career.deaths, totals.deaths);
  assert.equal(result.career.assists, totals.assists);
  assert.equal(result.career.heroDamage, totals.hero_damage);
  assert.equal(result.career.towerDamage, totals.tower_damage);
  assert.equal(result.career.lastHits, totals.last_hits);
  assert.equal(result.career.denies, totals.denies);
  assert.equal(result.career.durationSeconds, totals.duration);
  assert.equal(result.career.pings, totals.pings);
  assert.equal(result.career.hours, round(totals.duration / 3600, 1));
  assert.equal(result.career.kda, round((totals.kills + totals.assists) / totals.deaths, 2));
  assert.equal(result.career.purchaseWardObserver, totals.purchase_ward_observer);
  assert.equal(result.career.purchaseWardSentry, totals.purchase_ward_sentry);
});

test('真实快照：monthly / hourly / weekday / heatmap / side / modes / lobbies / streak 不变量', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const result = REAL;
  const matches = snapshot.matches;
  const games = matches.length;

  // 时间桶：长度与合计
  assert.equal(result.hourly.length, 24);
  assert.equal(result.weekday.length, 7);
  assert.equal(result.heatmap.length, 168);
  assert.deepEqual(result.weekday.map((item) => item.label), ['周日', '周一', '周二', '周三', '周四', '周五', '周六']);
  assert.equal(result.hourly.reduce((total, item) => total + item.games, 0), games);
  assert.equal(result.weekday.reduce((total, item) => total + item.games, 0), games);
  assert.equal(result.heatmap.reduce((total, item) => total + item.games, 0), games);

  // 与独立手算逐格对照
  const hourly = Array.from({ length: 24 }, () => ({ games: 0, wins: 0 }));
  const weekday = Array.from({ length: 7 }, () => ({ games: 0, wins: 0 }));
  const heatmap = Array.from({ length: 168 }, () => ({ games: 0, wins: 0 }));
  for (const match of matches) {
    const date = new Date((match.start_time + TZ8) * 1000);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    const win = realIsWin(match) ? 1 : 0;
    hourly[hour].games += 1;
    hourly[hour].wins += win;
    weekday[day].games += 1;
    weekday[day].wins += win;
    heatmap[day * 24 + hour].games += 1;
    heatmap[day * 24 + hour].wins += win;
  }
  for (let hour = 0; hour < 24; hour += 1) {
    assert.equal(result.hourly[hour].hour, hour);
    assert.equal(result.hourly[hour].games, hourly[hour].games);
    assert.equal(result.hourly[hour].wins, hourly[hour].wins);
    assertWinrateShape(result.hourly[hour].winrate, 'hourly[' + hour + ']');
    if (hourly[hour].games === 0) assert.equal(result.hourly[hour].winrate, null);
  }
  for (let day = 0; day < 7; day += 1) {
    assert.equal(result.weekday[day].day, day);
    assert.equal(result.weekday[day].games, weekday[day].games);
    assert.equal(result.weekday[day].wins, weekday[day].wins);
    assertWinrateShape(result.weekday[day].winrate, 'weekday[' + day + ']');
  }
  for (let index = 0; index < 168; index += 1) {
    assert.equal(result.heatmap[index].day, Math.floor(index / 24));
    assert.equal(result.heatmap[index].hour, index % 24);
    assert.equal(result.heatmap[index].games, heatmap[index].games);
    assert.equal(result.heatmap[index].wins, heatmap[index].wins);
    assertWinrateShape(result.heatmap[index].winrate, 'heatmap[' + index + ']');
  }

  // monthly：连续、合计 = games、逐月对照
  assert.ok(result.monthly.length > 0);
  const minutes = matches.map((match) => match.start_time);
  assert.equal(result.monthly[0].key, localMonthKey(Math.min(...minutes)));
  assert.equal(result.monthly[result.monthly.length - 1].key, localMonthKey(Math.max(...minutes)));
  for (let index = 1; index < result.monthly.length; index += 1) {
    assert.equal(result.monthly[index].key, nextMonthKey(result.monthly[index - 1].key), 'monthly 应连续填充');
  }
  const monthBuckets = new Map();
  for (const match of matches) {
    const key = localMonthKey(match.start_time);
    const bucket = monthBuckets.get(key) || { games: 0, wins: 0 };
    bucket.games += 1;
    if (realIsWin(match)) bucket.wins += 1;
    monthBuckets.set(key, bucket);
  }
  assert.equal(result.monthly.reduce((total, item) => total + item.games, 0), games);
  for (const item of result.monthly) {
    const bucket = monthBuckets.get(item.key) || { games: 0, wins: 0 };
    assert.equal(item.games, bucket.games, 'monthly ' + item.key + ' games');
    assert.equal(item.wins, bucket.wins, 'monthly ' + item.key + ' wins');
    if (item.games === 0) assert.equal(item.winrate, null, '空月 winrate 应为 null：' + item.key);
    else assertWinrateShape(item.winrate, 'monthly ' + item.key);
  }

  // side：与手算 / counts.is_radiant 一致
  const radiantMatches = matches.filter((match) => match.player_slot < 128);
  const direMatches = matches.filter((match) => match.player_slot >= 128);
  assert.deepEqual(result.side.map((item) => [item.key, item.label, item.games, item.wins]), [
    ['radiant', '天辉', radiantMatches.length, radiantMatches.filter(realIsWin).length],
    ['dire', '夜魇', direMatches.length, direMatches.filter(realIsWin).length],
  ]);
  assert.equal(result.side.reduce((total, item) => total + item.games, 0), games);
  assert.equal(result.side.reduce((total, item) => total + item.wins, 0), result.overview.wins);
  if (snapshot.counts && snapshot.counts.is_radiant) {
    assert.equal(result.side[0].games, snapshot.counts.is_radiant['1'].games);
    assert.equal(result.side[0].wins, snapshot.counts.is_radiant['1'].win);
  }

  // modes / lobbies：合计 = games，按 games 降序
  for (const rows of [result.modes, result.lobbies]) {
    assert.equal(rows.reduce((total, item) => total + item.games, 0), games);
    assert.equal(rows.reduce((total, item) => total + item.wins, 0), result.overview.wins);
    for (let index = 1; index < rows.length; index += 1) {
      assert.ok(rows[index - 1].games >= rows[index].games);
    }
    for (const row of rows) {
      assert.equal(typeof row.label, 'string');
      assert.ok(row.label.length > 0);
      assertWinrateShape(row.winrate, 'group ' + row.key);
    }
  }
  const mode22 = result.modes.find((mode) => mode.key === 22);
  assert.equal(mode22.games, matches.filter((match) => match.game_mode === 22).length);

  // streak：独立重算
  const ordered = matches.slice().sort((a, b) => a.start_time - b.start_time);
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  let runType = null;
  for (const match of ordered) {
    const won = realIsWin(match);
    if (runType === won) run += 1;
    else {
      runType = won;
      run = 1;
    }
    if (won) longestWin = Math.max(longestWin, run);
    else longestLoss = Math.max(longestLoss, run);
  }
  const lastWon = realIsWin(ordered[ordered.length - 1]);
  let currentLength = 0;
  for (let index = ordered.length - 1; index >= 0 && realIsWin(ordered[index]) === lastWon; index -= 1) {
    currentLength += 1;
  }
  assert.deepEqual(result.streak, {
    currentType: lastWon ? 'win' : 'loss',
    currentLength,
    longestWin,
    longestLoss,
  });
});

test('真实快照：heroes / best / worst / signature / heroPool 不变量', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const result = REAL;
  const matches = snapshot.matches;
  const games = matches.length;

  // heroes：games 合计 = games、按 games 降序
  assert.equal(result.heroes.reduce((total, hero) => total + hero.games, 0), games);
  const distinctHeroes = new Set(matches.map((match) => match.hero_id));
  assert.equal(result.heroes.length, distinctHeroes.size);
  for (let index = 1; index < result.heroes.length; index += 1) {
    assert.ok(result.heroes[index - 1].games >= result.heroes[index].games, 'heroes 应按 games 降序');
  }
  // 每个英雄逐项对照手算
  const heroBuckets = new Map();
  for (const match of matches) {
    const bucket = heroBuckets.get(match.hero_id) || {
      games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, duration: 0, lastPlayed: null,
    };
    bucket.games += 1;
    if (realIsWin(match)) bucket.wins += 1;
    bucket.kills += match.kills;
    bucket.deaths += match.deaths;
    bucket.assists += match.assists;
    bucket.duration += match.duration;
    bucket.lastPlayed = Math.max(bucket.lastPlayed ?? 0, match.start_time);
    heroBuckets.set(match.hero_id, bucket);
  }
  const rankingMap = new Map(snapshot.rankings.map((row) => [row.hero_id, round(row.percent_rank, 4)]));
  for (const hero of result.heroes) {
    assert.deepEqual(Object.keys(hero), HERO_KEYS);
    const bucket = heroBuckets.get(hero.heroId);
    assert.ok(bucket, 'hero ' + hero.heroId + ' 应来自对局');
    assert.equal(hero.games, bucket.games);
    assert.equal(hero.wins, bucket.wins);
    assert.equal(hero.losses, bucket.games - bucket.wins);
    assert.equal(hero.winrate, round(bucket.wins / bucket.games, 4));
    assert.equal(hero.kda, bucket.deaths > 0 ? round((bucket.kills + bucket.assists) / bucket.deaths, 2) : null);
    assert.equal(hero.lastPlayed, bucket.lastPlayed);
    assert.equal(hero.percentRank, rankingMap.has(hero.heroId) ? rankingMap.get(hero.heroId) : null);
    assert.ok(hero.zh && hero.zh.length > 0);
    if (snapshot.heroes_meta[String(hero.heroId)]) {
      assert.ok(hero.icon && hero.icon.startsWith('https://'), '真实快照英雄应有 icon');
    } else {
      // OpenDota 未解析出的 hero_id=0（1 场），没有元数据
      assert.equal(hero.heroId, 0);
      assert.equal(hero.zh, '未知英雄');
    }
    assert.ok(hero.attr == null || ATTR_ORDER.includes(hero.attr));
    assert.ok(Array.isArray(hero.roles));
    assert.equal(hero.avgDurationMin, round(bucket.duration / bucket.games / 60, 1));
  }

  // best / worst：样本 >= 8、排序、对象引用
  for (const hero of [...result.bestHeroes, ...result.worstHeroes]) {
    assert.ok(hero.games >= 8);
    assert.ok(result.heroes.includes(hero));
  }
  assert.ok(result.bestHeroes.length <= 8);
  assert.ok(result.worstHeroes.length <= 6);
  assert.ok(result.bestHeroes.every((hero) => hero.winrate != null));
  for (let index = 1; index < result.bestHeroes.length; index += 1) {
    assert.ok(result.bestHeroes[index - 1].winrate >= result.bestHeroes[index].winrate);
  }
  for (let index = 1; index < result.worstHeroes.length; index += 1) {
    assert.ok(result.worstHeroes[index - 1].winrate <= result.worstHeroes[index].winrate);
  }

  // signature：只含 percentRank、按 percentRank 降序、最多 12 条
  assert.ok(result.signature.length <= 12);
  for (let index = 0; index < result.signature.length; index += 1) {
    assert.notEqual(result.signature[index].percentRank, null);
    if (index > 0) assert.ok(result.signature[index - 1].percentRank >= result.signature[index].percentRank);
  }
  assert.equal(result.signature[0].heroId, result.heroes.slice().sort((a, b) => b.percentRank - a.percentRank)[0].heroId);

  // heroPool
  assert.equal(result.heroPool.played, result.heroes.length);
  assert.equal(result.heroPool.available, Object.keys(snapshot.heroes_meta).length);
  assert.deepEqual(result.heroPool.attrs.map((attr) => attr.key), ATTR_ORDER);
  const resolvedGames = result.heroes
    .filter((hero) => hero.attr != null)
    .reduce((total, hero) => total + hero.games, 0);
  assert.equal(result.heroPool.attrs.reduce((total, attr) => total + attr.games, 0), resolvedGames);
  assert.ok(result.heroPool.roles.length <= 6);
  for (let index = 1; index < result.heroPool.roles.length; index += 1) {
    assert.ok(result.heroPool.roles[index - 1].games >= result.heroPool.roles[index].games);
  }
  assert.ok(result.heroPool.meleeShare >= 0 && result.heroPool.meleeShare <= 1);
  const meleeGames = result.heroes
    .filter((hero) => String(hero.attackType).toLowerCase() === 'melee')
    .reduce((total, hero) => total + hero.games, 0);
  assert.equal(result.heroPool.meleeShare, round(meleeGames / games, 4));

  // 契约示例英雄：克林克兹是场次最多的英雄
  assert.equal(result.heroes[0].zh, '克林克兹');
  assertWithinRef(result.heroes[0].games, 164, 'top hero games');
});

test('真实快照：recent / peers / wordcloud 不变量', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const result = REAL;

  // recent：固定 20 条、按 start_time 倒序、字段真实
  assert.equal(result.recent.count, snapshot.recent_matches.length);
  assert.equal(result.recent.count, 20);
  const ordered = snapshot.recent_matches.slice().sort((a, b) => b.start_time - a.start_time);
  assert.deepEqual(result.recent.items.map((item) => item.matchId), ordered.map((match) => match.match_id));
  for (let index = 1; index < result.recent.items.length; index += 1) {
    assert.ok(result.recent.items[index - 1].startTime >= result.recent.items[index].startTime);
  }
  assert.equal(result.recent.wins, ordered.filter(realIsWin).length);
  assert.equal(result.recent.winrate, round(ordered.filter(realIsWin).length / ordered.length, 4));
  const sumField = (field) => ordered.reduce((total, match) => total + match[field], 0);
  assert.equal(result.recent.kda, round((sumField('kills') + sumField('assists')) / sumField('deaths'), 2));
  assert.equal(result.recent.avgGpm, Math.round(sumField('gold_per_min') / ordered.length));
  assert.equal(result.recent.avgXpm, Math.round(sumField('xp_per_min') / ordered.length));
  assert.equal(result.recent.avgLastHits, Math.round(sumField('last_hits') / ordered.length));
  assert.equal(result.recent.avgHeroDamage, Math.round(sumField('hero_damage') / ordered.length));
  for (const item of result.recent.items) {
    assert.equal(item.durationMin, Math.round(item.durationMin));
    assert.equal(item.zh, snapshot.heroes_meta[String(item.heroId)].zh);
    assert.equal(item.gameModeLabel, GAME_MODE_LABELS[item.gameMode]);
  }

  // peers：87 行、按 games 降序、胜率手算
  assert.equal(result.peers.length, snapshot.peers.length);
  for (let index = 1; index < result.peers.length; index += 1) {
    assert.ok(result.peers[index - 1].games >= result.peers[index].games);
  }
  const firstPeer = result.peers[0];
  assert.equal(firstPeer.accountId, snapshot.peers[0].account_id);
  assert.equal(firstPeer.games, snapshot.peers[0].with_games);
  assert.equal(firstPeer.winrate, round(snapshot.peers[0].with_win / snapshot.peers[0].with_games, 4));

  // wordcloud：<= 48、count >= 3、降序、无单字母/停用词
  assert.ok(result.wordcloud.length <= 48);
  for (let index = 1; index < result.wordcloud.length; index += 1) {
    assert.ok(result.wordcloud[index - 1].count >= result.wordcloud[index].count);
  }
  const banned = new Set([
    'the', 'and', 'you', 'is', 'to', 'of', 'it', 'in', 'that', 'this', 'for', 'on', 'my', 'we',
    'he', 'so', 'be', 'are', 'was', 'just', 'now', 'all', 'not', 'no', 'ok', 'im', 'dont', 'can',
    'will', 'do', 'if', 'at', 'by', 'or', 'an', 'as', 'up', 'out', 'get', 'got', 'hi', 'ye', 'ah', 'oh',
  ]);
  for (const item of result.wordcloud) {
    assert.ok(item.count >= 3);
    assert.ok(item.word.length > 1, '词云不应有单字母：' + item.word);
    assert.equal(banned.has(item.word.toLowerCase()), false, '词云不应有停用词：' + item.word);
  }
  // 真实数据里 swap / gg 这类游戏用语应保留
  const words = result.wordcloud.map((item) => item.word);
  assert.ok(words.includes('swap') || words.includes('gg'), '词云应保留 swap / gg');
});

test('真实快照：insights 5-8 条 / facts 3-6 条 / 不修改入参 / 可序列化', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const result = REAL;

  assert.ok(result.insights.length >= 5 && result.insights.length <= 8, '真实快照 insights 应为 5-8 条');
  const kinds = result.insights.map((insight) => insight.kind);
  assert.equal(new Set(kinds).size, kinds.length, 'insights 的 kind 不应重复');
  for (const insight of result.insights) {
    assert.ok(INSIGHT_KINDS.has(insight.kind));
    assert.equal(typeof insight.title, 'string');
    assert.equal(typeof insight.text, 'string');
    assert.ok(insight.title.length > 0 && insight.text.length > 0);
    assert.match(insight.text, /\d/);
  }
  // 契约示例：绝活 = 克林克兹，164 场 72.6%，绝活指数 99.98%
  const signatureInsight = result.insights.find((insight) => insight.kind === 'signature');
  assert.ok(signatureInsight);
  assert.equal(signatureInsight.title, '绝活：克林克兹');
  assert.match(signatureInsight.text, /164 场 72\.6% 胜率，绝活指数超过 99\.98% 的玩家。/);

  assert.ok(result.facts.length >= 3 && result.facts.length <= 6, 'facts 应为 3-6 条');
  for (const fact of result.facts) {
    assert.equal(typeof fact.label, 'string');
    assert.equal(typeof fact.value, 'string');
    assert.equal(typeof fact.hint, 'string');
    assert.match(fact.label, /[\u4e00-\u9fa5]/);
    assert.match(fact.value, /\d/);
  }
  // facts 是生涯口径，不随筛选变化
  assert.deepEqual(analyze(snapshot, 'turbo').facts, result.facts);

  // 不修改入参
  const before = JSON.stringify(snapshot);
  analyze(snapshot, 'ranked');
  analyze(snapshot, 'turbo');
  assert.equal(JSON.stringify(snapshot), before);

  // 可序列化（无 NaN / undefined / Infinity）
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('真实快照：career / recent / peers / wordcloud 与筛选无关；筛选区块自洽', { skip: REAL_SKIP }, () => {
  const snapshot = REAL_SNAPSHOT;
  const all = REAL;

  for (const key of ['ranked', 'turbo', 'serious', 'normal']) {
    const result = analyze(snapshot, key);
    assert.equal(result.filter.key, key);
    assert.equal(result.overview.games, result.filter.games);
    assert.equal(result.filters.find((item) => item.key === key).games, result.filter.games);
    assert.equal(result.heroes.reduce((total, hero) => total + hero.games, 0), result.overview.games);
    assert.equal(result.side.reduce((total, item) => total + item.games, 0), result.overview.games);
    assert.equal(result.hourly.reduce((total, item) => total + item.games, 0), result.overview.games);
    assert.equal(result.heatmap.reduce((total, item) => total + item.games, 0), result.overview.games);
    // 固定区块
    assert.deepEqual(result.career, all.career);
    assert.deepEqual(result.recent, all.recent);
    assert.deepEqual(result.peers, all.peers);
    assert.deepEqual(result.wordcloud, all.wordcloud);
    assert.deepEqual(result.profile, all.profile);
  }

  // 天梯筛选：lobby_type === 7 手算
  const ranked = analyze(snapshot, 'ranked');
  const rankedMatches = snapshot.matches.filter((match) => match.lobby_type === 7);
  assert.equal(ranked.overview.games, rankedMatches.length);
  assert.equal(ranked.overview.wins, rankedMatches.filter(realIsWin).length);
  assert.equal(ranked.streak.longestWin > 0, true);
  assert.ok(ranked.insights.length >= 5 && ranked.insights.length <= 8);
});
