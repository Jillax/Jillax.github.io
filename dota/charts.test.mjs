/**
 * dota/charts.js 契约测试（node:test）
 * 运行：node --test dota/charts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  winrateRing,
  barChart,
  monthlyActivity,
  heatmap,
  donut,
} from './charts.js';

const CHINESE_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const FORBIDDEN = /(NaN|undefined|Infinity)/;
const WEIRD_LABEL = `A & B < C > D "E" 'F'`;

/* ---------------------------------------------------------------- */
/* 测试工具                                                          */
/* ---------------------------------------------------------------- */

function assertValidSvg(svg, name) {
  assert.equal(typeof svg, 'string', `${name}: 必须返回字符串`);
  assert.ok(svg.startsWith('<svg'), `${name}: 必须以 <svg 开头`);
  assert.ok(svg.endsWith('</svg>'), `${name}: 必须以 </svg> 结尾`);
  assert.equal(
    (svg.match(/<svg\b/g) || []).length,
    (svg.match(/<\/svg>/g) || []).length,
    `${name}: <svg> 与 </svg> 数量必须相等`
  );
  assert.ok(svg.includes('<title>'), `${name}: 必须含 <title>`);
  assert.match(svg, /viewBox="[^"]+"/, `${name}: 必须有完整 viewBox`);
  assert.match(svg, /width="100%"/, `${name}: 必须 width="100%"`);
  assert.match(svg, /preserveAspectRatio="xMidYMid meet"/, `${name}: 必须 preserveAspectRatio`);
  assert.match(svg, /role="img"/, `${name}: 必须 role="img"`);
  assert.match(svg, /class="chart[ "]/i, `${name}: 根节点必须带 chart 类名`);
  assert.ok(!FORBIDDEN.test(svg), `${name}: 不得出现 NaN / undefined / Infinity`);
  assert.ok(!/<text\b[^>]*>\s*<(?!\/)/.test(svg), `${name}: text 节点内不得出现未转义的 <`);
}

function assertEscaped(svg, name) {
  assert.ok(svg.includes('&amp;'), `${name}: & 必须转义为 &amp;`);
  assert.ok(svg.includes('&lt;'), `${name}: < 必须转义为 &lt;`);
  assert.ok(svg.includes('&gt;'), `${name}: > 必须转义为 &gt;`);
  assert.ok(svg.includes('&quot;'), `${name}: " 必须转义为 &quot;`);
  assert.ok(svg.includes('&#39;'), `${name}: ' 必须转义为 &#39;`);
  assert.ok(
    !/&(?!amp;|lt;|gt;|quot;|#39;|apos;)/.test(svg),
    `${name}: 输出中不得出现裸 &`
  );
}

function makeHeatmapCells() {
  const cells = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const games = (day * 7 + hour * 3) % 17;
      cells.push({
        day,
        hour,
        games,
        wins: Math.floor(games * 0.6),
        winrate: games > 0 ? 0.55 : null,
      });
    }
  }
  return cells;
}

/* ---------------------------------------------------------------- */
/* winrateRing                                                       */
/* ---------------------------------------------------------------- */

test('winrateRing: 正常数据输出合法 SVG 且含胜率文字', () => {
  const svg = winrateRing({ winrate: 0.5882, wins: 1067, losses: 747, size: 200, thickness: 16 });
  assertValidSvg(svg, 'winrateRing 正常');
  assert.match(svg, /58\.8%/, '应显示四舍五入后的胜率');
  assert.match(svg, /1,067 胜/);
  assert.match(svg, /747 负/);
  assert.ok(svg.includes('chart-value'));
  assert.ok(svg.includes('chart-label'));
});

test('winrateRing: 0% 与 100% 边界', () => {
  const zero = winrateRing({ winrate: 0, wins: 0, losses: 12 });
  assertValidSvg(zero, 'winrateRing 0%');
  assert.match(zero, /0\.0%/);

  const full = winrateRing({ winrate: 1, wins: 12, losses: 0 });
  assertValidSvg(full, 'winrateRing 100%');
  assert.match(full, /100\.0%/);
});

test('winrateRing: 缺数据/非法数据不抛错', () => {
  for (const payload of [undefined, {}, { winrate: null, wins: null, losses: null }, { winrate: 'abc' }, { winrate: NaN }]) {
    const svg = winrateRing(payload);
    assertValidSvg(svg, 'winrateRing 空数据');
  }
  assert.match(winrateRing({}), /暂无对局/);
});

test('winrateRing: 极大场次与小数尺寸不产生异常数字', () => {
  const svg = winrateRing({ winrate: 0.5123, wins: 123456789, losses: 98765432, size: 190.6, thickness: 15.9 });
  assertValidSvg(svg, 'winrateRing 大数');
  assert.match(svg, /123,456,789 胜/);
});

/* ---------------------------------------------------------------- */
/* barChart                                                          */
/* ---------------------------------------------------------------- */

test('barChart: 垂直柱状图（默认参数）', () => {
  const svg = barChart({ items: [{ label: '一月', value: 12 }, { label: '二月', value: 30 }] });
  assertValidSvg(svg, 'barChart 垂直');
  assert.ok(svg.includes('chart-axis'));
  assert.ok(svg.includes('chart-tick'));
  assert.ok(svg.includes('chart-label'));
  assert.ok(svg.includes('chart-grid'));
  assert.ok(svg.includes('chart-value'));
  assert.ok(svg.includes('chart-bar'));
});

test('barChart: 水平柱状图（页面真实调用：绝活榜）', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    label: `英雄${index}`,
    value: 99.98 - index * 3.1,
    hint: `${100 + index} 场 · 胜率 60%`,
    color: index % 2 ? '#e5c15c' : '#5aa9ff',
  }));
  const svg = barChart({
    items,
    horizontal: true,
    width: 900,
    height: 408,
    valueFormat: (value) => value.toFixed(2) + '%',
    labelWidth: 108,
  });
  assertValidSvg(svg, 'barChart 水平');
  assert.match(svg, /99\.98%/);
  assert.ok(svg.includes('英雄0'));
  assert.ok(svg.includes('chart-label'));
});

test('barChart: 空数组 / 非数组 / 全 0 均返回合法 SVG', () => {
  for (const payload of [undefined, [], null, 'nope', [{ label: '甲', value: 0 }, { label: '乙', value: 0 }]]) {
    const svg = barChart({ items: payload });
    assertValidSvg(svg, 'barChart 空数据');
  }
  assert.match(barChart({ items: [] }), /暂无数据/);
});

test('barChart: maxValue / showValues / 自定义 valueFormat 生效', () => {
  const svg = barChart({
    items: [{ label: 'A', value: 5 }],
    maxValue: 50,
    showValues: false,
    valueFormat: (value) => `${value} 场`,
  });
  assertValidSvg(svg, 'barChart 参数');
  assert.ok(!svg.includes('class="chart-value"'), 'showValues=false 时不应渲染数值文本');
  assert.ok(svg.includes('5 场'), 'valueFormat 仍应作用于悬停提示');
});

test('barChart: 空值安全（null item / 缺 label / 大数 / 0）', () => {
  const svg = barChart({
    items: [null, { label: '零', value: 0 }, { value: 7 }, { label: '大数', value: 1e9 }, { label: '负', value: -3 }],
    horizontal: true,
  });
  assertValidSvg(svg, 'barChart 脏数据');
  assert.match(svg, /1000000000/);
  assert.match(svg, /亿/, '超大刻度应使用中文量级');
});

test('barChart: label / hint 特殊字符转义', () => {
  const svg = barChart({
    items: [{ label: WEIRD_LABEL, value: 10, hint: WEIRD_LABEL }],
    horizontal: true,
    labelWidth: 340,
    width: 640,
  });
  assertValidSvg(svg, 'barChart 转义');
  assertEscaped(svg, 'barChart 转义');
});

/* ---------------------------------------------------------------- */
/* monthlyActivity                                                   */
/* ---------------------------------------------------------------- */

function makeMonths() {
  return [
    { key: '2025-11', games: 40, wins: 22, winrate: 0.55 },
    { key: '2025-12', games: 0, wins: 0, winrate: null },
    { key: '2026-01', games: 88, wins: 52, winrate: 0.5909 },
    { key: '2026-02', games: 12, wins: 3, winrate: 0.25 },
    { key: '2026-03', games: 64, wins: 38, winrate: 0.59375 },
  ];
}

test('monthlyActivity: 正常序列（含 null 胜率断点）', () => {
  const svg = monthlyActivity({ items: makeMonths() });
  assertValidSvg(svg, 'monthlyActivity 正常');
  assert.ok(svg.includes('chart-bar'));
  assert.ok(svg.includes('chart-line'));
  assert.ok(svg.includes('chart-dot'));
  assert.ok(svg.includes('chart-axis'));
  assert.ok(svg.includes('chart-grid'));
  assert.ok(svg.includes('2025-11'));
  assert.ok(svg.includes('2026-03'));
});

test('monthlyActivity: 空数组 / 非数组 / 单月', () => {
  for (const payload of [undefined, [], null, 'x']) {
    const svg = monthlyActivity({ items: payload });
    assertValidSvg(svg, 'monthlyActivity 空数据');
  }
  assert.match(monthlyActivity({ items: [] }), /暂无数据/);
  assertValidSvg(monthlyActivity({ items: [{ key: '2026-01', games: 1, wins: 1, winrate: 1 }] }), 'monthlyActivity 单月');
});

test('monthlyActivity: 所有 winrate 为 null 不画折线也不报错', () => {
  const items = makeMonths().map((item) => ({ ...item, winrate: null }));
  const svg = monthlyActivity({ items });
  assertValidSvg(svg, 'monthlyActivity 全 null');
  assert.ok(!svg.includes('class="chart-line"'), '无有效胜率时不应绘制折线');
});

test('monthlyActivity: 月份 key 特殊字符转义', () => {
  const svg = monthlyActivity({ items: [{ key: WEIRD_LABEL, games: 3, wins: 1, winrate: 0.33 }] });
  assertValidSvg(svg, 'monthlyActivity 转义');
  assertEscaped(svg, 'monthlyActivity 转义');
});

/* ---------------------------------------------------------------- */
/* heatmap                                                           */
/* ---------------------------------------------------------------- */

test('heatmap: 168 格正常数据', () => {
  const svg = heatmap({ cells: makeHeatmapCells() });
  assertValidSvg(svg, 'heatmap 正常');
  assert.equal((svg.match(/class="heat-cell"/g) || []).length, 168, '应渲染 168 个格子');
  assert.ok(svg.includes('chart-label'));
  assert.ok(svg.includes('chart-tick'));
  assert.ok(svg.includes('周日'), '应渲染行标签');
});

test('heatmap: 每格带 title 提示（日/时/场次/胜率）', () => {
  const svg = heatmap({ cells: makeHeatmapCells() });
  assert.match(svg, /<title>周[日一二三四五六] \d+ 时 · \d+ 场 · 胜率 (—|\d+(\.\d+)?%)<\/title>/);
});

test('heatmap: 空数组 / 非数组 返回合法占位 SVG', () => {
  for (const payload of [undefined, [], null]) {
    const svg = heatmap({ cells: payload });
    assertValidSvg(svg, 'heatmap 空数据');
    assert.match(svg, /暂无数据/);
  }
});

test('heatmap: 全 0 / 非法单元格安全', () => {
  const zeros = makeHeatmapCells().map((cell) => ({ ...cell, games: 0, wins: 0, winrate: null }));
  assertValidSvg(heatmap({ cells: zeros }), 'heatmap 全 0');

  const dirty = [
    null,
    { day: 99, hour: 0, games: 1 },
    { day: 0, hour: -1, games: 1 },
    { day: 'x', hour: 'y', games: 1 },
    { day: 3, hour: 21, games: 12.7, wins: 7, winrate: 0.58 },
  ];
  const svg = heatmap({ cells: dirty });
  assertValidSvg(svg, 'heatmap 脏数据');
  assert.equal((svg.match(/class="heat-cell"/g) || []).length, 168, '缺格应补 0 而不是少画');
});

test('heatmap: 自定义行列标签与特殊字符转义', () => {
  const svg = heatmap({
    cells: [{ day: 0, hour: 0, games: 2, wins: 1, winrate: 0.5 }],
    rowLabels: Array.from({ length: 7 }, () => WEIRD_LABEL),
    colLabels: Array.from({ length: 24 }, (_, hour) => `${hour}&h`),
  });
  assertValidSvg(svg, 'heatmap 转义');
  assertEscaped(svg, 'heatmap 转义');
});

/* ---------------------------------------------------------------- */
/* donut                                                             */
/* ---------------------------------------------------------------- */

test('donut: 正常切片 + 中心文字', () => {
  const svg = donut({
    slices: [
      { label: '全英雄选择', value: 951 },
      { label: '快速模式', value: 809 },
      { label: '队长模式', value: 44, color: '#e5c15c' },
    ],
    size: 200,
    thickness: 28,
    centerValue: '1,814',
    centerLabel: '场',
  });
  assertValidSvg(svg, 'donut 正常');
  assert.equal((svg.match(/class="donut-slice"/g) || []).length, 3);
  assert.ok(svg.includes('1,814'));
  assert.ok(svg.includes('场'));
  assert.ok(svg.includes('chart-value'));
  assert.ok(svg.includes('chart-label'));
  assert.match(svg, /<title>全英雄选择 · 951（\d+\.\d%）<\/title>/);
});

test('donut: 空数组 / 全 0 / 非数组 返回合法占位 SVG', () => {
  for (const payload of [undefined, [], null, [{ label: '零', value: 0 }]]) {
    const svg = donut({ slices: payload });
    assertValidSvg(svg, 'donut 空数据');
    assert.match(svg, /暂无数据/);
  }
});

test('donut: 单切片 100% 不产生异常', () => {
  const svg = donut({ slices: [{ label: '唯一', value: 42 }], centerValue: '42', centerLabel: '局' });
  assertValidSvg(svg, 'donut 单切片');
  assert.equal((svg.match(/class="donut-slice"/g) || []).length, 1);
  assert.match(svg, /<title>唯一 · 42（100\.0%）<\/title>/);
});

test('donut: 标签与中心文字特殊字符转义', () => {
  const svg = donut({
    slices: [{ label: WEIRD_LABEL, value: 5 }],
    centerValue: WEIRD_LABEL,
    centerLabel: WEIRD_LABEL,
  });
  assertValidSvg(svg, 'donut 转义');
  assertEscaped(svg, 'donut 转义');
});

test('donut: 缺省参数调用安全', () => {
  assertValidSvg(donut(), 'donut 无参');
  assertValidSvg(donut({ slices: [{ value: 3 }] }), 'donut 无 label');
});

/* ---------------------------------------------------------------- */
/* 交叉检查                                                          */
/* ---------------------------------------------------------------- */

test('所有函数：无参调用均不抛错且返回合法 SVG', () => {
  const factories = [
    ['winrateRing', () => winrateRing()],
    ['barChart', () => barChart()],
    ['monthlyActivity', () => monthlyActivity()],
    ['heatmap', () => heatmap()],
    ['donut', () => donut()],
  ];
  for (const [name, run] of factories) {
    assertValidSvg(run(), `${name} 无参`);
  }
});

test('所有函数：输出中不包含脚本/事件属性等不安全内容', () => {
  const source = [
    winrateRing({ winrate: 0.5, wins: 5, losses: 5 }),
    barChart({ items: [{ label: `"><script>alert(1)</script>`, value: 1 }], horizontal: true }),
    monthlyActivity({ items: [{ key: `<img onerror=1>`, games: 1, wins: 1, winrate: 1 }] }),
    heatmap({ cells: [{ day: 0, hour: 0, games: 1, wins: 1, winrate: 1 }], rowLabels: ['<b>', '一', '二', '三', '四', '五', '六'] }),
    donut({ slices: [{ label: `<svg onload=1>`, value: 1 }], centerValue: '<x>' }),
  ].join('');
  assert.ok(!/<script/i.test(source), '不得输出 script 标签');
  assert.ok(!/<[^>]*\sonerror=/i.test(source), '不得输出未转义的 onerror 属性');
});
