/**
 * 从知乎抓取用户想法 (Pins)
 *
 * 使用方法:
 *   ZHIHU_COOKIE="xxx" node scripts/fetch-zhihu.mjs
 *
 * 环境变量:
 *   ZHIHU_COOKIE - 知乎登录后的 Cookie 字符串（必需）
 *
 * 获取 Cookie 的方法:
 *   1. 在浏览器登录 zhihu.com
 *   2. 打开开发者工具 (F12) → Application/存储 → Cookies
 *   3. 复制所有 Cookie 值（完整字符串，如 "d_c0=xxx; z_c0=xxx; ..."）
 *   4. 添加到 GitHub 仓库 Secrets，名称设为 ZHIHU_COOKIE
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '..', 'data', 'zhihu.json');
const USER_URL_TOKEN = 'yi-ban-tong-guo-63';
const MAX_PINS = 200;
const MAX_ARTICLES = 50;
const SCROLL_TIMES = 20;

async function main() {
  const cookieStr = process.env.ZHIHU_COOKIE;
  if (!cookieStr) {
    console.log('未设置 ZHIHU_COOKIE 环境变量，使用本地数据。');
    console.log('如需自动同步，请将知乎 Cookie 添加到 GitHub Secrets。');
    return;
  }

  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  // 设置 Cookie
  const cookies = cookieStr.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return {
      name: name.trim(),
      value: rest.join('=').trim(),
      domain: '.zhihu.com',
      path: '/',
    };
  }).filter(c => c.name && c.value);

  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    let pins = [];
    let articles = [];

    // ===== 抓取想法 =====
    pins = await fetchPins(page);
    console.log(`抓取到 ${pins.length} 条想法`);

    // ===== 抓取文章 =====
    articles = await fetchArticles(page);
    console.log(`抓取到 ${articles.length} 篇文章`);

    // ===== 读取现有数据 =====
    let existingData = { pins: [] };
    try {
      existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      // 文件不存在或格式错误
    }

    // 合并想法（去重）
    const existingPinIds = new Set(existingData.pins?.map(p => p.content || p.url) || []);
    const newPins = pins.filter(p => !existingPinIds.has(p.content || p.url));
    const mergedPins = [...pins, ...(existingData.pins || [])].slice(0, MAX_PINS);

    // 合并文章（去重）
    const existingArticleIds = new Set(existingData.articles?.map(a => a.url) || []);
    const newArticles = articles.filter(a => !existingArticleIds.has(a.url));
    const mergedArticles = [...articles, ...(existingData.articles || [])].slice(0, MAX_ARTICLES);

    const output = {
      updated: new Date().toISOString(),
      source: 'zhihu',
      profile: {
        name: 'Jillax',
        url: `https://www.zhihu.com/people/${USER_URL_TOKEN}`,
        bio: '',
      },
      pins: mergedPins,
      articles: mergedArticles,
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`已更新 ${DATA_FILE}`);
    console.log(`想法: ${mergedPins.length} 条（新增 ${newPins.length} 条）`);
    console.log(`文章: ${mergedArticles.length} 篇（新增 ${newArticles.length} 篇）`);

  } catch (err) {
    console.error('抓取失败:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function fetchPins(page) {
  const url = `https://www.zhihu.com/people/${USER_URL_TOKEN}/pins`;
  console.log(`访问想法页: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 滚动加载更多，直到无新内容或达到上限
  let prevCount = 0;
  let staleScrolls = 0;
  for (let i = 0; i < SCROLL_TIMES; i++) {
    // 展开所有"阅读全文"
    await page.evaluate(() => {
      document.querySelectorAll('.RichText-expandButton, button:has-text("展开阅读全文")').forEach(b => b.click());
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);

    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('.PinItem, [data-za-module="PinItem"], .TopstoryItem--pin').length;
    });

    if (currentCount === prevCount) {
      staleScrolls++;
      if (staleScrolls >= 3) {
        console.log(`滚动 ${i + 1} 次后无新内容，停止`);
        break;
      }
    } else {
      staleScrolls = 0;
    }
    prevCount = currentCount;
  }

  // 提取想法数据
  const pins = await page.evaluate(() => {
    const items = [];

    // 尝试 initialData（React 渲染数据）
    try {
      const initialData = JSON.parse(
        document.querySelector('script#js-initialData')?.textContent ||
        document.querySelector('script[data-initial-state]')?.textContent ||
        '{}'
      );
      if (initialData?.people?.pins) {
        const raw = Object.values(initialData.people.pins);
        return raw.map(p => ({
          content: p.excerpt || p.content || '',
          created: p.created || p.updated || '',
          likes: p.like_count || 0,
          comments: p.comment_count || 0,
          images: (p.content_images || []).map(img => img.url || img),
          url: p.url || '',
        })).filter(p => p.content);
      }
    } catch (e) {
      // fallback to DOM
    }

    // DOM 提取
    const cards = document.querySelectorAll('.PinItem, [data-za-module="PinItem"], .TopstoryItem--pin');
    cards.forEach(card => {
      // 先点击"阅读全文"
      const expandBtn = card.querySelector('.RichText-expandButton, button:has-text("展开阅读全文")');
      if (expandBtn) expandBtn.click();

      const contentEl = card.querySelector('.RichText');
      const timeEl = card.querySelector('time, .PublishTime, .Time');
      const likeEl = card.querySelector('.VoteButton--up, .LikeButton, .zm-item-vote-count');
      const commentEl = card.querySelector('.CommentButton, .zm-item-meta-comment');

      const content = contentEl?.textContent?.trim() || '';
      const timeStr = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
      const likes = parseInt(likeEl?.textContent?.trim()) || 0;
      const comments = parseInt(commentEl?.textContent?.trim()) || 0;

      // 只从内容区域提取图片
      const images = [];
      if (contentEl) {
        contentEl.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-actualsrc');
          if (src && !src.includes('data:image')) {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if ((w >= 50 && h >= 50) || (w === 0 && h === 0)) {
              images.push(src);
            }
          }
        });
      }

      if (content) {
        items.push({ content, created: timeStr, likes, comments, images });
      }
    });

    return items;
  });

  return pins;
}

async function fetchArticles(page) {
  const url = `https://www.zhihu.com/people/${USER_URL_TOKEN}/posts`;
  console.log(`访问文章页: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 滚动加载更多
  let prevCount = 0;
  let staleScrolls = 0;
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);

    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('.PostItem, .ContentItem, [data-za-module="PostItem"]').length;
    });

    if (currentCount === prevCount) {
      staleScrolls++;
      if (staleScrolls >= 3) break;
    } else {
      staleScrolls = 0;
    }
    prevCount = currentCount;
  }

  const articles = await page.evaluate(() => {
    const items = [];

    // 尝试 initialData
    try {
      const initialData = JSON.parse(
        document.querySelector('script#js-initialData')?.textContent || '{}'
      );
      if (initialData?.people?.articles) {
        const raw = Object.values(initialData.people.articles);
        return raw.map(a => ({
          title: a.title || '',
          summary: a.excerpt || a.summary || '',
          created: a.created || a.updated || '',
          url: a.url || '',
          likes: a.like_count || 0,
          comments: a.comment_count || 0,
        })).filter(a => a.title);
      }
    } catch (e) {
      // fallback to DOM
    }

    // DOM 提取
    const cards = document.querySelectorAll('.PostItem, .ContentItem, [data-za-module="PostItem"], .TopstoryItem');
    cards.forEach(card => {
      const titleEl = card.querySelector('.PostItem-title a, h2 a, .ContentItem-title a');
      const summaryEl = card.querySelector('.PostItem-excerpt, .RichText');
      const timeEl = card.querySelector('time, .PublishTime, .Time, .Date');
      const likeEl = card.querySelector('.VoteButton--up, .LikeButton');
      const commentEl = card.querySelector('.CommentButton');

      const title = titleEl?.textContent?.trim() || '';
      const summary = summaryEl?.textContent?.trim() || '';
      const timeStr = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
      const href = titleEl?.getAttribute('href') || '';
      const likes = parseInt(likeEl?.textContent?.trim()) || 0;
      const comments = parseInt(commentEl?.textContent?.trim()) || 0;

      if (title) {
        items.push({
          title,
          summary,
          created: timeStr,
          url: href.startsWith('http') ? href : `https://www.zhihu.com${href}`,
          likes,
          comments,
        });
      }
    });

    return items;
  });

  return articles;
}
