/**
 * 用知乎官方 CLI 同步想法和文章。
 *
 *   ZHIHU_ACCESS_SECRET="xxx" node scripts/fetch-zhihu.mjs
 *
 * Access Secret 在 https://developer.zhihu.com/profile 申请。
 * GitHub Actions 读取同名仓库 Secret。本机无密钥链时只认这个环境变量，
 * 不要把 Secret 写进仓库。
 *
 * 可选：
 *   ZHIHU_CLI            CLI 绝对路径，默认识别官方 setup 的安装位置
 *   ZHIHU_DETAIL_BUDGET  每次补拉全文的条数上限，默认 30（计入创作能力额度）
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { applyArticleDetail, applyPinDetail, mergeZhihu } from './zhihu-merge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '..', 'data', 'zhihu.json');
const USER_URL_TOKEN = 'yi-ban-tong-guo-63';
const PAGE_LIMIT = 50;
const MAX_PAGES = 40;

function resolveCli() {
  if (process.env.ZHIHU_CLI && fs.existsSync(process.env.ZHIHU_CLI)) return process.env.ZHIHU_CLI;
  const home = os.homedir();
  const xdg = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const candidates = [
    path.join(xdg, 'zhihu-cli', 'current', 'zhihu-cli'),
    path.join(home, 'Library', 'Application Support', 'zhihu-cli', 'current', 'zhihu-cli'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function callCli(bin, args) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = (result.stdout || '').trim();
  let payload = null;
  try {
    payload = stdout ? JSON.parse(stdout) : null;
  } catch {
    payload = null;
  }
  if (result.status !== 0 || payload?.ok === false) {
    const message = payload?.error?.message || payload?.Message || (result.stderr || '').trim() || stdout || `zhihu-cli exit ${result.status}`;
    const error = new Error(message);
    error.code = payload?.error?.code || payload?.Code || '';
    throw error;
  }
  if (!payload) throw new Error(`zhihu-cli 没有返回 JSON：${args.join(' ')}`);
  if (payload.Code !== undefined && payload.Code !== 0) {
    throw new Error(payload.Message || `知乎接口错误 ${payload.Code}`);
  }
  return payload;
}

function listContents(bin, type) {
  const items = [];
  let offset = 0;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = callCli(bin, [
      'me', 'contents',
      '--type', type,
      '--sort', 'ts',
      '--order', 'desc',
      '--offset', String(offset),
      '--limit', String(PAGE_LIMIT),
      '--timeout', '20s',
    ]);
    const data = payload.Data || {};
    const batch = Array.isArray(data.Items) ? data.Items : [];
    items.push(...batch);
    const paging = data.Paging || {};
    console.log(`${type} 第 ${page + 1} 页：${batch.length} 条，累计 ${items.length}`);
    if (paging.IsEnd || batch.length === 0) {
      complete = true;
      break;
    }
    if (paging.NextOffset === undefined || paging.NextOffset === null || paging.NextOffset === offset) {
      console.log(`${type} 分页缺少下一页偏移，停止继续请求`);
      complete = false;
      break;
    }
    offset = paging.NextOffset;
  }

  return { items, complete };
}

function readDetail(bin, url) {
  const payload = callCli(bin, ['me', 'content', '--content-url', url, '--timeout', '20s']);
  return payload.Data?.Body || '';
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { pins: [], articles: [] };
  }
}

function fillDetails(bin, merged) {
  const budget = Number(process.env.ZHIHU_DETAIL_BUDGET || 30);
  const jobs = [
    ...merged.pinDetailUrls.map((url) => ({ kind: 'pin', url })),
    ...merged.articleDetailUrls.map((url) => ({ kind: 'article', url })),
  ].slice(0, Number.isFinite(budget) && budget > 0 ? budget : 0);

  if (jobs.length === 0) {
    console.log('没有需要补拉的全文');
    return merged;
  }
  console.log(`补拉全文 ${jobs.length} 条（上限 ${budget}）`);

  for (const job of jobs) {
    try {
      const body = readDetail(bin, job.url);
      if (!body) {
        console.log(`全文为空：${job.url}`);
        continue;
      }
      if (job.kind === 'pin') {
        const index = merged.pins.findIndex((pin) => pin.url === job.url);
        if (index >= 0) merged.pins[index] = applyPinDetail(merged.pins[index], body);
      } else {
        const index = merged.articles.findIndex((article) => article.url === job.url);
        if (index >= 0) merged.articles[index] = applyArticleDetail(merged.articles[index], body);
      }
      console.log(`已补全文：${job.url}`);
    } catch (error) {
      console.log(`全文跳过 ${job.url}：${error.message}`);
    }
  }
  return merged;
}

function main() {
  const bin = resolveCli();
  if (!bin) {
    console.log('未找到 zhihu-cli。先运行官方 setup，或设置 ZHIHU_CLI。');
    console.log('https://developer.zhihu.com/docs?key=zhihu_cli');
    return;
  }
  if (!process.env.ZHIHU_ACCESS_SECRET) {
    console.log('未设置 ZHIHU_ACCESS_SECRET，保留现有数据。');
    console.log('打开 https://developer.zhihu.com/profile ，用知乎账号登录后申请 Access Secret。');
    console.log('本地执行：ZHIHU_ACCESS_SECRET="..." node scripts/fetch-zhihu.mjs');
    console.log('GitHub Actions：把同一串写入仓库 Secret，名称 ZHIHU_ACCESS_SECRET。');
    return;
  }

  console.log(`使用 CLI：${bin}`);
  const pins = listContents(bin, 'pin');
  const articles = listContents(bin, 'article');
  console.log(`想法 ${pins.items.length} 条，完整=${pins.complete}；文章 ${articles.items.length} 篇，完整=${articles.complete}`);

  if (pins.items.length === 0 && articles.items.length === 0) {
    console.log('本次没有拉到想法或文章，不改动存档。');
    return;
  }

  const existing = loadExisting();
  const merged = mergeZhihu({
    existing,
    pinItems: pins.items,
    articleItems: articles.items,
    pinsComplete: pins.complete,
  });
  fillDetails(bin, merged);

  const output = {
    updated: new Date().toISOString(),
    source: 'zhihu-cli',
    profile: {
      name: existing.profile?.name || 'Jillax',
      url: `https://www.zhihu.com/people/${USER_URL_TOKEN}`,
      bio: existing.profile?.bio || '',
    },
    pins: merged.pins,
    articles: merged.articles,
  };

  fs.writeFileSync(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const blocked = output.pins.filter((pin) => pin.blocked).length;
  console.log(`已写入 ${DATA_FILE}`);
  console.log(`想法 ${output.pins.length} 条（其中屏蔽 ${blocked}），文章 ${output.articles.length} 篇`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
