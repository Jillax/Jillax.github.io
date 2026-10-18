/**
 * 同步知乎想法（pins）与文章。
 *
 *   node scripts/fetch-zhihu.mjs
 *
 * 想法走公开接口 /api/v4/members/{token}/pins，不需要任何凭证。
 * 文章接口需要登录态：设置了 ZHIHU_COOKIE 才同步文章，否则保留存档里的旧文章。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyArticleDetail, articleId, htmlToText, mergeZhihu } from './zhihu-merge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '..', 'data', 'zhihu.json');
const USER_URL_TOKEN = 'yi-ban-tong-guo-63';
const PAGE_LIMIT = 20;
const MAX_PAGES = 40;
const PAGE_DELAY_MS = 300;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function requestHeaders() {
  const cookie = (process.env.ZHIHU_COOKIE || '').trim();
  return {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function getJson(url) {
  const response = await fetch(url, { headers: requestHeaders() });
  if (!response.ok) return { status: response.status, data: null };
  return { status: response.status, data: await response.json() };
}

// 知乎图片地址带 /50/ 之类的尺寸段和 _qhd/_ms 后缀，去掉才拿到原图
function originalImage(url) {
  return String(url || '')
    .replace(/\/\d{2,4}\/(?=v2-)/, '/')
    .replace(/_(?:xs|s|b|ms|hd|qhd|r)\.(?:jpg|jpeg|png|webp|gif)$/i, (match) => match.replace(/^_(?:xs|s|b|ms|hd|qhd|r)/, ''));
}

// 接口返回的 own_text 带 <br>、<a> 等标记，先转成纯文本再入库
function partText(part) {
  const raw = typeof part?.own_text === 'string' && part.own_text.trim() ? part.own_text : part?.content;
  return htmlToText(raw || '');
}

function toPinItem(item) {
  const parts = Array.isArray(item.content) ? item.content : [];
  const text = parts
    .map(partText)
    .filter(Boolean)
    .join('\n');
  const images = parts
    .filter((part) => part && part.type === 'image' && part.url)
    .map((part) => originalImage(part.url));
  const title = htmlToText(item.excerpt_title || '');

  return {
    ContentType: 'pin',
    Url: `https://www.zhihu.com/pins/${item.id}`,
    CreatedAt: item.created,
    Title: title,
    Summary: text || title,
    LikeCount: item.like_count ?? 0,
    CommentCount: item.comment_count ?? 0,
    Images: images,
  };
}

async function listPins() {
  const items = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_LIMIT;
    const { status, data } = await getJson(`https://www.zhihu.com/api/v4/members/${USER_URL_TOKEN}/pins?limit=${PAGE_LIMIT}&offset=${offset}`);
    if (!data) {
      console.log(`想法接口返回 ${status}，已取到 ${items.length} 条，按不完整处理`);
      return { items, complete: false };
    }
    const batch = Array.isArray(data.data) ? data.data : [];
    items.push(...batch);
    console.log(`想法第 ${page + 1} 页：${batch.length} 条，累计 ${items.length}`);
    if (data.paging?.is_end || batch.length === 0) return { items, complete: true };
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }
  console.log('达到分页上限，按不完整处理');
  return { items, complete: false };
}

async function listArticles() {
  if (!(process.env.ZHIHU_COOKIE || '').trim()) {
    console.log('未设置 ZHIHU_COOKIE，跳过文章同步，保留存档里的旧文章');
    return { items: [], withBodies: false };
  }

  const items = [];
  for (let page = 0; page < 10; page += 1) {
    const offset = page * PAGE_LIMIT;
    const { status, data } = await getJson(`https://www.zhihu.com/api/v4/members/${USER_URL_TOKEN}/articles?limit=${PAGE_LIMIT}&offset=${offset}`);
    if (!data) {
      console.log(`文章接口返回 ${status}，保留存档里的旧文章`);
      return { items: [], withBodies: false };
    }
    const batch = Array.isArray(data.data) ? data.data : [];
    items.push(...batch.map((article) => ({
      Url: article.url,
      CreatedAt: article.created,
      Title: article.title || '',
      Summary: article.excerpt || '',
      LikeCount: article.voteup_count ?? 0,
      CommentCount: article.comment_count ?? 0,
    })));
    if (data.paging?.is_end || batch.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }
  console.log(`文章列表 ${items.length} 篇`);
  return { items, withBodies: true };
}

async function fillArticleBodies(merged) {
  for (const url of merged.articleDetailUrls) {
    const id = articleId(url);
    if (!/^\d+$/.test(id)) continue;
    const { data } = await getJson(`https://zhuanlan.zhihu.com/api/articles/${id}`);
    if (!data?.content) continue;
    const index = merged.articles.findIndex((article) => articleId(article.url) === id);
    if (index >= 0) merged.articles[index] = applyArticleDetail(merged.articles[index], data.content);
    console.log(`已补全文：${url}`);
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { pins: [], articles: [] };
  }
}

async function main() {
  const pins = await listPins();
  const articles = await listArticles();

  if (pins.items.length === 0 && articles.items.length === 0) {
    console.log('本次没有拉到想法或文章，不改动存档。');
    return;
  }

  const existing = loadExisting();
  const merged = mergeZhihu({
    existing,
    pinItems: pins.items.map(toPinItem),
    articleItems: articles.items,
    pinsComplete: pins.complete,
  });
  if (articles.withBodies) await fillArticleBodies(merged);

  const output = {
    updated: new Date().toISOString(),
    source: 'zhihu',
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
  console.log(`想法 ${output.pins.length} 条（其中已屏蔽 ${blocked}），文章 ${output.articles.length} 篇`);
}

main();
