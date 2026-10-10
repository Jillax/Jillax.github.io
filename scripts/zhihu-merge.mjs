/**
 * 知乎开放平台列表与本地存档的合并。
 * 想法、文章的字段保持 blog.html 现有读取方式。
 */

export function canonicalUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hash = '';
    u.search = '';
    const pathname = u.pathname.replace(/\/$/, '');
    return `${u.host}${pathname}`.toLowerCase();
  } catch {
    return String(url).trim();
  }
}

export function articleId(url) {
  const match = String(url || '').match(/\/p\/(\d+)/);
  return match ? match[1] : canonicalUrl(url);
}

export function shanghaiIso(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
}

export function minuteKey(created) {
  const match = String(created || '').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : '';
}

export function looksTruncated(text) {
  const value = String(text || '').trim();
  return value.endsWith('…') || value.endsWith('...');
}

export function htmlToText(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/(div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

export function sanitizeHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

export function extractImages(html) {
  const images = [];
  const pattern = /<img\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(html || ''))) {
    const tag = match[0];
    const src = tag.match(/\b(?:src|data-original|data-src)\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    if (!src.startsWith('https://')) continue;
    if (src.includes('needBackground=1')) continue;
    if (!images.includes(src)) images.push(src);
  }
  return images;
}

function compact(text) {
  return String(text || '').replace(/\s+/g, '');
}

function sameText(a, b) {
  const left = compact(a).replace(/[…\.]+$/u, '');
  const right = compact(b).replace(/[…\.]+$/u, '');
  if (!left || !right) return false;
  const size = Math.min(24, left.length, right.length);
  return left.slice(0, size) === right.slice(0, size);
}

function longer(current, incoming) {
  const left = current || '';
  const right = incoming || '';
  return left.length >= right.length ? left : right;
}

function cleanArticles(articles) {
  return (articles || []).filter((article) => {
    const title = String(article?.title || '').trim();
    if (!title || title === '侵权举报') return false;
    return /\/p\/\d+/.test(article?.url || '');
  });
}

function httpsUrl(url) {
  return String(url || '').replace(/^http:\/\//i, 'https://');
}

/**
 * 只有完整且数量没有骤降的列表，才把存档里消失的想法标成屏蔽。
 * 空列表或明显不完整的列表保持原样，避免一次失败把全部历史标成已屏蔽。
 */
export function canMarkMissingBlocked(existingCount, fetchedCount, listComplete) {
  if (!listComplete || fetchedCount <= 0) return false;
  if (existingCount <= 5) return true;
  return fetchedCount >= Math.ceil(existingCount * 0.5);
}

export function mergeZhihu({ existing = {}, pinItems = [], articleItems = [], pinsComplete = false } = {}) {
  const existingPins = existing.pins || [];
  const pinDetailUrls = [];
  const used = new Set();
  const mergedPins = [];

  for (const item of pinItems) {
    const created = shanghaiIso(item.CreatedAt);
    const minute = minuteKey(created);
    const summary = item.Summary || item.Title || '';
    const url = httpsUrl(item.Url || '');
    let matchIndex = -1;

    if (url) {
      matchIndex = existingPins.findIndex((pin, index) => !used.has(index) && pin.url && canonicalUrl(pin.url) === canonicalUrl(url));
    }
    if (matchIndex < 0 && minute && summary) {
      const candidates = existingPins
        .map((pin, index) => ({ pin, index }))
        .filter(({ pin, index }) => !used.has(index) && minuteKey(pin.created) === minute && sameText(pin.content, summary));
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const gapA = Math.abs((a.pin.content || '').length - summary.length);
          const gapB = Math.abs((b.pin.content || '').length - summary.length);
          return gapA - gapB;
        });
        matchIndex = candidates[0].index;
      }
    }

    const prev = matchIndex >= 0 ? existingPins[matchIndex] : null;
    if (matchIndex >= 0) used.add(matchIndex);

    const content = longer(prev?.content, summary);
    mergedPins.push({
      content,
      created: created || prev?.created || '',
      likes: Number(item.LikeCount ?? prev?.likes ?? 0),
      comments: Number(item.CommentCount ?? prev?.comments ?? 0),
      images: Array.isArray(prev?.images) ? prev.images : [],
      ...(url || prev?.url ? { url: url || prev.url } : {}),
    });

    const stillShort = !prev || (prev.content || '').length <= summary.length;
    const likelyPartial = !summary || looksTruncated(summary) || summary.length >= 80;
    if (url && stillShort && likelyPartial) pinDetailUrls.push(url);
  }

  const markBlocked = canMarkMissingBlocked(existingPins.length, pinItems.length, pinsComplete);
  for (let index = 0; index < existingPins.length; index += 1) {
    if (used.has(index)) continue;
    const prev = existingPins[index];
    if (markBlocked) mergedPins.push({ ...prev, blocked: true });
    else {
      const kept = { ...prev };
      mergedPins.push(kept);
    }
  }

  mergedPins.sort((a, b) => String(b.created).localeCompare(String(a.created)));

  const articleDetailUrls = [];
  const previousArticles = cleanArticles(existing.articles);
  const byId = new Map(previousArticles.map((article) => [articleId(article.url), article]));
  const seen = new Set();
  const mergedArticles = [];

  for (const item of articleItems) {
    const url = httpsUrl(item.Url || '');
    const id = articleId(url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const prev = byId.get(id);
    const created = item.CreatedAt ? shanghaiIso(item.CreatedAt).slice(0, 10) : (prev?.created || '');
    const article = {
      title: item.Title || prev?.title || '',
      summary: longer(prev?.summary, item.Summary || ''),
      created,
      url: url || prev?.url || '',
      likes: Number(item.LikeCount ?? prev?.likes ?? 0),
      comments: Number(item.CommentCount ?? prev?.comments ?? 0),
    };
    if (prev?.body_html) article.body_html = prev.body_html;
    if (article.title === '侵权举报' || !/\/p\/\d+/.test(article.url)) continue;
    mergedArticles.push(article);
    if (!article.body_html && article.url) articleDetailUrls.push(article.url);
  }

  // 文章没有“已屏蔽”展示。无论本次列表是否完整，接口没覆盖到的旧文都继续留在存档里。
  for (const article of previousArticles) {
    const id = articleId(article.url);
    if (seen.has(id)) continue;
    mergedArticles.push({
      ...article,
      url: httpsUrl(article.url),
    });
  }

  mergedArticles.sort((a, b) => String(b.created).localeCompare(String(a.created)));

  return { pins: mergedPins, articles: mergedArticles, pinDetailUrls, articleDetailUrls };
}

export function applyPinDetail(pin, bodyHtml) {
  const text = htmlToText(bodyHtml);
  const images = extractImages(bodyHtml);
  return {
    ...pin,
    content: text.length >= (pin.content || '').length ? text : pin.content,
    images: images.length ? images : (pin.images || []),
  };
}

export function applyArticleDetail(article, bodyHtml) {
  const html = sanitizeHtml(bodyHtml);
  const text = htmlToText(html);
  const excerpt = text.slice(0, 140);
  const summary = looksTruncated(article.summary) && excerpt
    ? excerpt
    : longer(article.summary, excerpt);
  return {
    ...article,
    body_html: html || article.body_html || '',
    summary,
  };
}
