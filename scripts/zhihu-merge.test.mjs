import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyArticleDetail,
  applyPinDetail,
  articleId,
  canMarkMissingBlocked,
  htmlToText,
  mergeZhihu,
  minuteKey,
  shanghaiIso,
} from './zhihu-merge.mjs';

const sampleCreated = '2026-05-25T05:23:00+08:00';
const sampleUnix = Date.parse(sampleCreated) / 1000;

test('上海时间与现有存档的分钟对齐', () => {
  assert.equal(shanghaiIso(sampleUnix), sampleCreated);
  assert.equal(minuteKey(shanghaiIso(sampleUnix)), minuteKey(sampleCreated));
});

test('用分钟和正文开头对齐旧想法，并保留更长正文', () => {
  const merged = mergeZhihu({
    existing: {
      pins: [{
        content: '你的身体素质决定我的破案速度——聂海芬。后面还有一句。',
        created: sampleCreated,
        likes: 0,
        comments: 0,
        images: ['https://pic.example/a.jpg'],
        blocked: true,
      }],
      articles: [],
    },
    pinItems: [{
      ContentType: 'pin',
      Url: 'https://www.zhihu.com/pin/100',
      CreatedAt: sampleUnix,
      LikeCount: 3,
      CommentCount: 1,
      Title: '',
      Summary: '你的身体素质决定我的破案速度——聂海芬…',
    }],
    pinsComplete: true,
  });

  assert.equal(merged.pins.length, 1);
  assert.equal(merged.pins[0].blocked, undefined);
  assert.equal(merged.pins[0].content, '你的身体素质决定我的破案速度——聂海芬。后面还有一句。');
  assert.equal(merged.pins[0].likes, 3);
  assert.equal(merged.pins[0].url, 'https://www.zhihu.com/pin/100');
  assert.deepEqual(merged.pins[0].images, ['https://pic.example/a.jpg']);
  assert.deepEqual(merged.pinDetailUrls, []);
});

test('同一分钟的两条想法按正文区分', () => {
  const created = '2024-12-08T12:43:00+08:00';
  const unix = Date.parse(created) / 1000;
  const merged = mergeZhihu({
    existing: {
      pins: [
        { content: '不求甚解以前背李煜', created, likes: 0, comments: 0, images: [] },
        { content: '志愿与投资一些专业像个股', created, likes: 0, comments: 0, images: [] },
      ],
    },
    pinItems: [
      { Url: 'https://www.zhihu.com/pin/1', CreatedAt: unix, LikeCount: 0, CommentCount: 0, Summary: '志愿与投资一些专业像个股，锚定某行业' },
      { Url: 'https://www.zhihu.com/pin/2', CreatedAt: unix, LikeCount: 0, CommentCount: 0, Summary: '不求甚解以前背李煜《相见欢》' },
    ],
    pinsComplete: true,
  });
  assert.deepEqual(merged.pins.map((pin) => pin.url).sort(), [
    'https://www.zhihu.com/pin/1',
    'https://www.zhihu.com/pin/2',
  ]);
  const poem = merged.pins.find((pin) => pin.url.endsWith('/2'));
  assert.match(poem.content, /^不求甚解以前背李煜/);
});

test('空列表或不完整列表不会把历史想法标成屏蔽', () => {
  const existing = {
    pins: [
      { content: '还在', created: sampleCreated, likes: 0, comments: 0, images: [] },
    ],
  };
  const empty = mergeZhihu({ existing, pinItems: [], pinsComplete: true });
  assert.equal(empty.pins[0].blocked, undefined);

  const partial = mergeZhihu({
    existing: {
      pins: Array.from({ length: 10 }, (_, index) => ({
        content: `想法${index}`,
        created: `2026-01-01T00:0${index}:00+08:00`,
        likes: 0,
        comments: 0,
        images: [],
      })),
    },
    pinItems: [{
      Url: 'https://www.zhihu.com/pin/9',
      CreatedAt: Date.parse('2026-01-01T00:00:00+08:00') / 1000,
      Summary: '想法0',
      LikeCount: 1,
      CommentCount: 0,
    }],
    pinsComplete: false,
  });
  assert.equal(partial.pins.filter((pin) => pin.blocked).length, 0);
  assert.equal(canMarkMissingBlocked(10, 1, false), false);
  assert.equal(canMarkMissingBlocked(209, 0, true), false);
});

test('完整列表里消失的想法才标成屏蔽', () => {
  const merged = mergeZhihu({
    existing: {
      pins: [
        { content: '留下', created: sampleCreated, likes: 0, comments: 0, images: [] },
        { content: '不见了', created: '2026-05-01T00:00:00+08:00', likes: 0, comments: 0, images: [] },
      ],
    },
    pinItems: [{
      Url: 'https://www.zhihu.com/pin/7',
      CreatedAt: sampleUnix,
      Summary: '留下',
      LikeCount: 2,
      CommentCount: 0,
    }],
    pinsComplete: true,
  });
  const gone = merged.pins.find((pin) => pin.content === '不见了');
  assert.equal(gone.blocked, true);
  assert.equal(merged.pins.find((pin) => pin.content === '留下').blocked, undefined);
});

test('去掉侵权举报假文章，并保留已有正文', () => {
  const merged = mergeZhihu({
    existing: {
      articles: [
        { title: '侵权举报', summary: '', created: '', url: 'https://zhuanlan.zhihu.com/p/28852607', likes: 0, comments: 0 },
        {
          title: 'Quarter-life',
          summary: '人生前四分之一',
          created: '2026-03-23',
          url: 'http://zhuanlan.zhihu.com/p/2019565546803327088',
          likes: 0,
          comments: 0,
          body_html: '<p>正文</p>',
        },
      ],
    },
    articleItems: [{
      Url: 'https://zhuanlan.zhihu.com/p/2019565546803327088',
      CreatedAt: Date.parse('2026-03-23T12:00:00+08:00') / 1000,
      Title: 'Quarter-life',
      Summary: '人生前四分之一的时间已经过去了',
      LikeCount: 4,
      CommentCount: 2,
    }],
    articlesComplete: true,
  });
  assert.equal(merged.articles.length, 1);
  assert.equal(merged.articles[0].url, 'https://zhuanlan.zhihu.com/p/2019565546803327088');
  assert.equal(merged.articles[0].body_html, '<p>正文</p>');
  assert.equal(merged.articles[0].likes, 4);
  assert.equal(articleId(merged.articles[0].url), '2019565546803327088');
  assert.deepEqual(merged.articleDetailUrls, []);
});

test('新文章进入补拉队列，全文会去掉脚本', () => {
  const merged = mergeZhihu({
    existing: { articles: [] },
    articleItems: [{
      Url: 'https://zhuanlan.zhihu.com/p/42',
      CreatedAt: sampleUnix,
      Title: '新文章',
      Summary: '摘要…',
      LikeCount: 0,
      CommentCount: 0,
    }],
    articlesComplete: true,
  });
  assert.deepEqual(merged.articleDetailUrls, ['https://zhuanlan.zhihu.com/p/42']);
  const detailed = applyArticleDetail(merged.articles[0], '<p>你好</p><script>alert(1)</script><img src="https://pic.example/a.jpg" onerror="evil()">');
  assert.equal(detailed.body_html.includes('script'), false);
  assert.equal(detailed.body_html.includes('onerror'), false);
  assert.match(detailed.summary, /你好/);
});

test('想法全文转成纯文本并抽出图片', () => {
  const pin = applyPinDetail(
    { content: '短…', created: sampleCreated, likes: 0, comments: 0, images: [], url: 'https://www.zhihu.com/pin/1' },
    '<p>短的想法写完了</p><img src="https://picx.zhimg.com/a.jpg"><img src="data:image/png;base64,aaaa">',
  );
  assert.equal(pin.content, '短的想法写完了');
  assert.deepEqual(pin.images, ['https://picx.zhimg.com/a.jpg']);
  assert.equal(htmlToText('<p>甲</p><p>乙</p>').includes('甲'), true);
});
