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
const MAX_PINS = 50;

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
    const url = `https://www.zhihu.com/people/${USER_URL_TOKEN}/pins`;
    console.log(`访问: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 等待内容加载
    await page.waitForTimeout(3000);

    // 滚动加载更多
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
    }

    // 提取想法数据
    const pins = await page.evaluate(() => {
      const items = [];

      // 尝试从页面 JavaScript 状态中提取（Zhihu 使用 React/NEXT 渲染）
      try {
        const initialData = JSON.parse(
          document.querySelector('script#js-initialData')?.textContent ||
          document.querySelector('script[data-initial-state]')?.textContent ||
          '{}'
        );
        // 如果有 initialData，从这里提取
        if (initialData?.people?.pins) {
          return Object.values(initialData.people.pins);
        }
      } catch (e) {
        // fallback to DOM extraction
      }

      // DOM 提取：查找想法卡片
      const cards = document.querySelectorAll('.PinItem, [data-za-module="PinItem"], .TopstoryItem--pin');
      cards.forEach(card => {
        const contentEl = card.querySelector('.RichText');
        const timeEl = card.querySelector('time, .PublishTime, .Time');
        const likeEl = card.querySelector('.VoteButton--up, .LikeButton, .zm-item-vote-count');
        const commentEl = card.querySelector('.CommentButton, .zm-item-meta-comment');

        const content = contentEl?.textContent?.trim() || '';
        const timeStr = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
        const likes = parseInt(likeEl?.textContent?.trim()) || 0;
        const comments = parseInt(commentEl?.textContent?.trim()) || 0;

        // 只从内容区域提取图片，排除头像
        const images = [];
        if (contentEl) {
          contentEl.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-actualsrc');
            if (src && !src.includes('data:image')) {
              // 过滤掉小图标（头像通常 < 50px）
              const w = img.naturalWidth || img.width;
              const h = img.naturalHeight || img.height;
              if ((w >= 50 && h >= 50) || (w === 0 && h === 0)) {
                images.push(src);
              }
            }
          });
        }

        if (content) {
          items.push({
            content,
            created: timeStr,
            likes,
            comments,
            images,
          });
        }
      });

      return items;
    });

    console.log(`抓取到 ${pins.length} 条想法`);

    // 读取现有数据
    let existingData = { pins: [] };
    try {
      existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      // 文件不存在或格式错误
    }

    // 合并数据（去重）
    const existingIds = new Set(existingData.pins?.map(p => p.content) || []);
    const newPins = pins.filter(p => !existingIds.has(p.content));
    const mergedPins = [...pins, ...(existingData.pins || [])].slice(0, MAX_PINS);

    const output = {
      updated: new Date().toISOString(),
      source: 'zhihu',
      profile: {
        name: 'Jillax',
        url: `https://www.zhihu.com/people/${USER_URL_TOKEN}`,
        bio: '',
      },
      pins: mergedPins,
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`已更新 ${DATA_FILE}，共 ${mergedPins.length} 条想法`);
    console.log(`新增 ${newPins.length} 条`);

  } catch (err) {
    console.error('抓取失败:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
