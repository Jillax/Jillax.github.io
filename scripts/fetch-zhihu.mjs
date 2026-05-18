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
const MAX_PINS = 500;
const MAX_ARTICLES = 50;
const SCROLL_TIMES = 50;
const STALE_SCROLL_LIMIT = 5;

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
    const mergedPins = [...pins, ...(existingData.pins || [])];

    // 合并文章（去重）
    const existingArticleIds = new Set(existingData.articles?.map(a => a.url) || []);
    const newArticles = articles.filter(a => !existingArticleIds.has(a.url));
    const mergedArticles = [...articles, ...(existingData.articles || [])];

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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 等待 React 渲染完成
  await page.waitForTimeout(5000);

  // 滚动加载更多，直到无新内容或达到上限
  let prevCount = 0;
  let staleScrolls = 0;
  for (let i = 0; i < SCROLL_TIMES; i++) {
    // 展开所有"阅读全文"（用 try-catch 避免个别按钮报错）
    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => {
        try {
          if (b.textContent.includes('阅读全文')) b.click();
        } catch(e) {}
      });
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    const currentCount = await page.evaluate(() => {
      // 统计包含实质文本的元素数量，作为卡片数的代理指标
      const all = document.querySelectorAll('[class*="Topstory"], [class*="Pin"], [class*="Item"]');
      let count = 0;
      all.forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 20) count++;
      });
      return count;
    });

    if (currentCount === prevCount) {
      staleScrolls++;
      if (staleScrolls >= STALE_SCROLL_LIMIT) {
        console.log(`想法滚动 ${i + 1} 次后无新内容，停止`);
        break;
      }
    } else {
      staleScrolls = 0;
    }
    prevCount = currentCount;
  }

  // 仅从 DOM 提取想法数据（不依赖 initialData，后者只有首屏数据）
  const pins = await page.evaluate(() => {
    const items = [];

    // 以卡片容器为单位遍历，避免捕获用户名/签名/按钮等 UI 文字
    const cards = document.querySelectorAll('[class*="PinItem"], [class*="TopstoryItem--pin"], .TopstoryItem');

    cards.forEach(card => {
      // 只从 .RichText 提取正文，排除卡片 header/footer 的 UI 文字
      const contentEl = card.querySelector('.RichText');
      const content = contentEl?.textContent?.trim() || '';
      if (!content || content.length < 5) return;

      // 从卡片内找发布时间
      const timeEl = card.querySelector('time, [datetime]');
      const created = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';

      // 找点赞数
      const voteEl = card.querySelector('[class*="VoteButton"], [class*="vote"]');
      const likes = parseInt(voteEl?.textContent?.trim()) || 0;

      // 找评论数
      const cmtEl = card.querySelector('[class*="Comment"]');
      const comments = parseInt(cmtEl?.textContent?.trim()) || 0;

      // 只提取正文区域内的图片（排除头像、表情等）
      const images = [];
      if (contentEl) {
        contentEl.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (src && !src.includes('data:image') && !src.includes('needBackground=1')) {
            images.push(src);
          }
        });
      }

      items.push({ content, created, likes, comments, images });
    });

    return items;
  });

  console.log(`DOM 提取到 ${pins.length} 条想法内容`);
  return pins;
}

async function fetchArticles(page) {
  // 先用知乎 API 抓文章（返回 JSON，不依赖 DOM 选择器）
  let allArticles = [];
  let offset = 0;
  const limit = 20;

  for (let pageNum = 0; pageNum < 5; pageNum++) {
    const apiUrl = `https://www.zhihu.com/api/v4/members/${USER_URL_TOKEN}/articles?limit=${limit}&offset=${offset}`;
    console.log(`请求文章 API: offset=${offset}`);
    try {
      const data = await page.evaluate(async (url) => {
        const resp = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) return null;
        return await resp.json();
      }, apiUrl);

      if (!data || !data.data || data.data.length === 0) {
        console.log('文章 API 无更多数据');
        break;
      }

      const articles = data.data.map(a => ({
        title: a.title || '',
        summary: a.excerpt || '',
        created: a.created ? new Date(a.created * 1000).toISOString().split('T')[0] : '',
        url: a.url || '',
        likes: a.voteup_count || 0,
        comments: a.comment_count || 0,
      })).filter(a => a.title);

      allArticles = allArticles.concat(articles);
      console.log(`文章 API 第 ${pageNum + 1} 页: ${articles.length} 篇`);

      if (data.paging && data.paging.is_end) break;
      offset += limit;
    } catch (e) {
      console.log(`文章 API 请求失败: ${e.message}`);
      break;
    }
  }

  if (allArticles.length > 0) {
    console.log(`API 共获取 ${allArticles.length} 篇文章`);
    return allArticles;
  }

  // API 没拿到数据，降级到 DOM 提取
  console.log('API 方式未获取到文章，降级 DOM 提取...');
  const url = `https://www.zhihu.com/people/${USER_URL_TOKEN}/posts`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const articles = await page.evaluate(() => {
    const items = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/p/"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      const url = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
      if (seen.has(url)) return;
      seen.add(url);
      const title = link.textContent.trim();
      if (!title || title.length < 2) return;
      items.push({ title, summary: '', created: '', url, likes: 0, comments: 0 });
    });
    return items;
  });

  console.log(`DOM 降级提取到 ${articles.length} 篇文章`);
  return articles;
}

main();