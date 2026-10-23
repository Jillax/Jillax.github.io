/**
 * Dota 2 数据战报 · SVG 图表库（纯函数 ESM）
 *
 * 契约：tmp/contracts/charts-api.md
 * - 只接收数据、只返回 SVG 字符串；不触碰 DOM / 网络 / 定时器，无第三方依赖。
 * - 浏览器（dota.js）与 node:test 共用。
 * - 所有文本 XML 转义；空数据、全 0、null 一律安全，输出中不出现 NaN / undefined / Infinity。
 */

const COLOR = Object.freeze({
  radiant: '#5ee08a',
  dire: '#ff6b6b',
  gold: '#e5c15c',
  blue: '#5aa9ff',
  purple: '#a78bfa',
  cyan: '#22d3ee',
  muted: '#8b93a7',
  grid: '#232a38',
  line: '#1a2130',
  panel: '#10141d',
  emptyCell: '#0e131c',
});

const PALETTE = [COLOR.blue, COLOR.radiant, COLOR.gold, COLOR.purple, COLOR.cyan, COLOR.dire];
const SVG_NS = 'http://www.w3.org/2000/svg';
const EMPTY_TEXT = '暂无数据';
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

/** XML 文本/属性转义：& < > " ' */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** 可空数值：null / undefined / '' / NaN → null */
function optNum(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 非负数值：非法值 → 0 */
function nonNeg(value) {
  const n = optNum(value);
  return n != null && n > 0 ? n : 0;
}

/** 限制在 [min, max] 的数值；非法值取 fallback */
function clampNum(value, min, max, fallback) {
  const n = optNum(value);
  if (n == null) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 归一到 0..1 */
function clamp01(value) {
  const n = optNum(value);
  if (n == null) return 0;
  return Math.min(1, Math.max(0, n));
}

/** 坐标取两位小数，避免超长浮点串 */
function r2(value) {
  const n = optNum(value);
  return n == null ? 0 : Math.round(n * 100) / 100;
}

/** 千分位整数（不依赖 Intl，输出稳定） */
function intFmt(value) {
  const n = Math.round(nonNeg(value));
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 0..1 → 百分比文本；null/非法 → 破折号 */
function pctText(value, digits = 1) {
  const n = optNum(value);
  if (n == null) return '—';
  return (clamp01(n) * 100).toFixed(digits) + '%';
}

/** 刻度用紧凑数字：>= 1 亿用「亿」，>= 1 万用「万」 */
function compactNum(value) {
  const n = nonNeg(value);
  const trim = (text) => text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  if (n >= 1e8) return trim((n / 1e8).toFixed(2)) + '亿';
  if (n >= 1e4) return trim((n / 1e4).toFixed(1)) + '万';
  return intFmt(n);
}

/** 按 Unicode 字符截断（中文一个字符算一个），尾部补省略号 */
function truncate(value, max) {
  const chars = Array.from(String(value == null ? '' : value));
  const limit = Math.max(2, Math.round(max));
  if (chars.length <= limit) return chars.join('');
  return chars.slice(0, limit - 1).join('') + '…';
}

/** 安全调用外部 valueFormat，输出永不为 null/undefined/NaN */
function formatValue(formatter, value) {
  let out;
  try {
    out = typeof formatter === 'function' ? formatter(value) : value;
  } catch {
    out = value;
  }
  if (out == null) return '';
  const text = String(out);
  return text === 'NaN' || text === 'undefined' || text === 'Infinity' ? '' : text;
}

/** 颜色安全兜底 */
function safeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

/* ------------------------------------------------------------------ */
/* SVG 片段工具                                                        */
/* ------------------------------------------------------------------ */

function svgOpen(kind, width, height, title) {
  return `<svg class="chart chart-${kind}" xmlns="${SVG_NS}" viewBox="0 0 ${r2(width)} ${r2(height)}" width="100%" preserveAspectRatio="xMidYMid meet" role="img"><title>${esc(title)}</title>`;
}

function svgLine(x1, y1, x2, y2, className, extra = '') {
  return `<line class="${className}" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"${extra} />`;
}

function svgText(content, options = {}) {
  const {
    x = 0,
    y = 0,
    anchor = 'middle',
    baseline = null,
    className = '',
    transform = null,
    style = null,
  } = options;
  const attrs = [
    `x="${r2(x)}"`,
    `y="${r2(y)}"`,
    anchor ? `text-anchor="${anchor}"` : '',
    baseline ? `dominant-baseline="${baseline}"` : '',
    transform ? `transform="${transform}"` : '',
    className ? `class="${className}"` : '',
    style ? `style="${style}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<text ${attrs}>${esc(content)}</text>`;
}

/** 空数据占位图：合法 SVG + 「暂无数据」 */
function emptyChart(kind, width = 320, height = 160, message = EMPTY_TEXT) {
  const w = clampNum(width, 120, 4000, 320);
  const h = clampNum(height, 80, 4000, 160);
  return (
    `<svg class="chart chart-${kind} chart-empty" xmlns="${SVG_NS}" viewBox="0 0 ${r2(w)} ${r2(h)}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">` +
    `<title>${esc(message)}</title>` +
    svgText(message, {
      x: w / 2,
      y: h / 2,
      baseline: 'central',
      className: 'chart-empty-text',
    }) +
    '</svg>'
  );
}

/* ------------------------------------------------------------------ */
/* 1) 胜率圆环                                                          */
/* ------------------------------------------------------------------ */

export function winrateRing({ winrate, wins, losses, size = 190, thickness = 16 } = {}) {
  const s = clampNum(size, 96, 640, 190);
  const t = clampNum(thickness, 4, Math.max(6, s / 4), 16);
  const winsN = Math.round(nonNeg(wins));
  const lossesN = Math.round(nonNeg(losses));
  const games = winsN + lossesN;

  let rate = optNum(winrate);
  if (rate == null && games > 0) rate = winsN / games;
  const shownRate = rate == null ? null : clamp01(rate);

  const c = s / 2;
  const pad = Math.max(4, s * 0.045);
  const radius = Math.max(8, (s - t) / 2 - pad);
  const circumference = 2 * Math.PI * radius;
  const arcLength = shownRate == null ? 0 : circumference * shownRate;

  const percent = shownRate == null ? '—' : pctText(shownRate);
  const sub = games > 0 ? `${intFmt(winsN)} 胜 / ${intFmt(lossesN)} 负` : '暂无对局';
  const title = `胜率 ${percent} · ${intFmt(winsN)} 胜 / ${intFmt(lossesN)} 负`;

  const parts = [svgOpen('ring', s, s, title)];

  // 外圈刻度：终端/仪表盘质感，纯装饰
  const ticks = [];
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const outer = radius + t / 2 + 3;
    const inner = outer + (i % 6 === 0 ? 5 : 2.5);
    ticks.push(
      svgLine(
        c + Math.cos(angle) * outer,
        c + Math.sin(angle) * outer,
        c + Math.cos(angle) * inner,
        c + Math.sin(angle) * inner,
        'ring-tick'
      )
    );
  }
  parts.push(`<g class="ring-ticks" aria-hidden="true">${ticks.join('')}</g>`);

  parts.push(
    `<circle class="ring-track" cx="${r2(c)}" cy="${r2(c)}" r="${r2(radius)}" fill="none" stroke="${COLOR.grid}" stroke-width="${r2(t)}" />`
  );
  if (arcLength > 0.5) {
    parts.push(
      `<circle class="ring-arc" cx="${r2(c)}" cy="${r2(c)}" r="${r2(radius)}" fill="none" stroke="${COLOR.radiant}" ` +
        `stroke-width="${r2(t)}" stroke-linecap="round" stroke-dasharray="${r2(arcLength)} ${r2(circumference)}" ` +
        `transform="rotate(-90 ${r2(c)} ${r2(c)})" />`
    );
  }

  parts.push(
    svgText(percent, {
      x: c,
      y: c - s * 0.02,
      baseline: 'central',
      className: 'chart-value ring-value',
      style: `font-size:${Math.round(s * 0.235)}px`,
    })
  );
  parts.push(
    svgText(sub, {
      x: c,
      y: c + s * 0.165,
      baseline: 'central',
      className: 'chart-label ring-sub',
      style: `font-size:${Math.max(9, Math.round(s * 0.068))}px`,
    })
  );
  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* 2) 通用柱状图（垂直 / 水平）                                          */
/* ------------------------------------------------------------------ */

export function barChart({
  items,
  width = 640,
  height = 300,
  horizontal = false,
  maxValue,
  valueFormat = (v) => String(v),
  showValues = true,
  color = COLOR.blue,
  labelWidth = 96,
} = {}) {
  const w = clampNum(width, 160, 4000, 640);
  const h = clampNum(height, 60, 4000, 300);
  const rows = (Array.isArray(items) ? items : []).map((item) => ({
    label: item && item.label != null ? String(item.label) : '',
    value: nonNeg(item && item.value),
    hint: item && item.hint != null ? String(item.hint) : '',
    color: safeColor(item && item.color, safeColor(color, COLOR.blue)),
  }));

  if (rows.length === 0) return emptyChart('bar', w, Math.min(h, 240));

  const explicitMax = optNum(maxValue);
  const max = explicitMax != null && explicitMax > 0 ? explicitMax : Math.max(1, ...rows.map((row) => row.value));
  const summary = rows.slice(0, 4).map((row) => row.label).filter(Boolean).join('、');
  const title = `柱状图：${summary}${rows.length > 4 ? ' 等' : ''} · 共 ${rows.length} 项`;
  const parts = [svgOpen('bar', w, h, title)];

  if (horizontal) {
    const padTop = 12;
    const padBottom = 28;
    const padLeft = clampNum(labelWidth, 40, 340, 96);
    const padRight = showValues ? 68 : 20;
    const plotW = Math.max(24, w - padLeft - padRight);
    const plotH = Math.max(24, h - padTop - padBottom);
    const slot = plotH / rows.length;
    const barH = Math.max(4, Math.min(30, slot * 0.6));
    const labelChars = Math.max(4, Math.floor((padLeft - 12) / 11));

    const grid = [];
    const ticks = [];
    const tickSteps = 4;
    for (let i = 0; i <= tickSteps; i += 1) {
      const value = (max * i) / tickSteps;
      const x = padLeft + (plotW * i) / tickSteps;
      grid.push(
        svgLine(x, padTop, x, padTop + plotH, 'chart-grid', ` stroke="${COLOR.line}" stroke-width="1" stroke-dasharray="2 4"`)
      );
      ticks.push(
        svgText(compactNum(value), {
          x,
          y: padTop + plotH + 17,
          className: 'chart-tick',
        })
      );
    }
    parts.push(`<g class="chart-grid-lines" aria-hidden="true">${grid.join('')}</g>`);
    parts.push(svgLine(padLeft, padTop, padLeft, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));
    parts.push(svgLine(padLeft, padTop + plotH, padLeft + plotW, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));

    rows.forEach((row, index) => {
      const centerY = padTop + slot * (index + 0.5);
      const barW = (row.value / max) * plotW;
      const valueText = formatValue(valueFormat, row.value);
      const titleText = [row.label, row.hint, valueText].filter(Boolean).join(' · ');
      parts.push(
        `<rect class="chart-bar" x="${r2(padLeft)}" y="${r2(centerY - barH / 2)}" width="${r2(Math.max(0, barW))}" height="${r2(barH)}" rx="2" fill="${esc(row.color)}"><title>${esc(titleText)}</title></rect>`
      );
      if (row.label) {
        parts.push(
          svgText(truncate(row.label, labelChars), {
            x: padLeft - 9,
            y: centerY,
            anchor: 'end',
            baseline: 'central',
            className: 'chart-label',
          })
        );
      }
      if (showValues) {
        const valueX = padLeft + Math.max(0, barW) + 8;
        const estimated = valueText.length * 6.6;
        const overflow = valueX + estimated > w - 6;
        parts.push(
          svgText(valueText, {
            x: overflow ? Math.max(padLeft + 4, w - 8) : valueX,
            y: centerY,
            anchor: overflow ? 'end' : 'start',
            baseline: 'central',
            className: 'chart-value',
          })
        );
      }
    });
    parts.push(`<g class="chart-ticks">${ticks.join('')}</g>`);
  } else {
    const padTop = 30;
    const padBottom = 46;
    const padLeft = 48;
    const padRight = showValues ? 18 : 10;
    const plotW = Math.max(24, w - padLeft - padRight);
    const plotH = Math.max(24, h - padTop - padBottom);
    const slot = plotW / rows.length;
    const barW = Math.max(4, Math.min(56, slot * 0.62));
    const maxLabel = rows.reduce((longest, row) => Math.max(longest, Array.from(row.label).length), 0);
    const rotateLabels = rows.length > 7 || maxLabel > 5;
    const leftTicks = [];

    const grid = [];
    const tickSteps = 4;
    for (let i = 0; i <= tickSteps; i += 1) {
      const value = (max * i) / tickSteps;
      const y = padTop + plotH - (plotH * i) / tickSteps;
      grid.push(
        svgLine(padLeft, y, padLeft + plotW, y, 'chart-grid', ` stroke="${COLOR.line}" stroke-width="1" stroke-dasharray="2 4"`)
      );
      leftTicks.push(
        svgText(compactNum(value), {
          x: padLeft - 9,
          y,
          anchor: 'end',
          baseline: 'central',
          className: 'chart-tick',
        })
      );
    }
    parts.push(`<g class="chart-grid-lines" aria-hidden="true">${grid.join('')}</g>`);
    parts.push(`<g class="chart-ticks">${leftTicks.join('')}</g>`);
    parts.push(svgLine(padLeft, padTop, padLeft, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));
    parts.push(svgLine(padLeft, padTop + plotH, padLeft + plotW, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));

    rows.forEach((row, index) => {
      const centerX = padLeft + slot * (index + 0.5);
      const barH = (row.value / max) * plotH;
      const x = centerX - barW / 2;
      const y = padTop + plotH - barH;
      const valueText = formatValue(valueFormat, row.value);
      const titleText = [row.label, row.hint, valueText].filter(Boolean).join(' · ');
      parts.push(
        `<rect class="chart-bar" x="${r2(x)}" y="${r2(y)}" width="${r2(barW)}" height="${r2(Math.max(0, barH))}" rx="2" fill="${esc(row.color)}"><title>${esc(titleText)}</title></rect>`
      );
      if (showValues) {
        parts.push(
          svgText(valueText, {
            x: centerX,
            y: Math.max(padTop + 10, y - 7),
            className: 'chart-value',
          })
        );
      }
      if (!row.label) return;
      const labelChars = rotateLabels ? 7 : Math.max(5, Math.floor(slot / 11));
      const label = truncate(row.label, labelChars);
      if (rotateLabels) {
        parts.push(
          svgText(label, {
            x: centerX,
            y: h - padBottom + 16,
            anchor: 'end',
            className: 'chart-label',
            transform: `rotate(-32 ${r2(centerX)} ${r2(h - padBottom + 16)})`,
          })
        );
      } else {
        parts.push(svgText(label, { x: centerX, y: h - padBottom + 20, className: 'chart-label' }));
      }
    });
  }

  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* 3) 逐月战况：柱 = 场次，折线 = 胜率                                    */
/* ------------------------------------------------------------------ */

export function monthlyActivity({ items, width = 960, height = 280 } = {}) {
  const w = clampNum(width, 220, 4000, 960);
  const h = clampNum(height, 100, 4000, 280);
  const rows = (Array.isArray(items) ? items : []).map((item) => ({
    key: item && item.key != null ? String(item.key) : '',
    games: Math.round(nonNeg(item && item.games)),
    wins: Math.round(nonNeg(item && item.wins)),
    winrate: optNum(item && item.winrate),
  }));

  if (rows.length === 0) return emptyChart('monthly', w, h);

  const padLeft = 48;
  const padRight = 52;
  const padTop = 30;
  const padBottom = 38;
  const plotW = Math.max(40, w - padLeft - padRight);
  const plotH = Math.max(40, h - padTop - padBottom);
  const slot = plotW / rows.length;
  const barW = Math.max(1.5, Math.min(28, slot * 0.6));
  const maxGames = Math.max(1, ...rows.map((row) => row.games));
  const totalGames = rows.reduce((sum, row) => sum + row.games, 0);

  const titleText = `逐月战况 · ${rows[0].key} 至 ${rows[rows.length - 1].key} · 共 ${intFmt(totalGames)} 场`;
  const parts = [svgOpen('monthly', w, h, titleText)];

  // 左侧轴（场次）+ 右侧轴（胜率）
  const grid = [];
  const leftTicks = [];
  const rightTicks = [];
  const tickSteps = 4;
  for (let i = 0; i <= tickSteps; i += 1) {
    const y = padTop + plotH - (plotH * i) / tickSteps;
    grid.push(
      svgLine(padLeft, y, padLeft + plotW, y, 'chart-grid', ` stroke="${COLOR.line}" stroke-width="1" stroke-dasharray="2 4"`)
    );
    leftTicks.push(
      svgText(compactNum((maxGames * i) / tickSteps), {
        x: padLeft - 9,
        y,
        anchor: 'end',
        baseline: 'central',
        className: 'chart-tick',
      })
    );
    rightTicks.push(
      svgText(`${Math.round((i / tickSteps) * 100)}%`, {
        x: padLeft + plotW + 9,
        y,
        anchor: 'start',
        baseline: 'central',
        className: 'chart-tick',
      })
    );
  }
  parts.push(`<g class="chart-grid-lines" aria-hidden="true">${grid.join('')}</g>`);
  parts.push(`<g class="chart-ticks">${leftTicks.join('')}${rightTicks.join('')}</g>`);
  parts.push(svgLine(padLeft, padTop, padLeft, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));
  parts.push(svgLine(padLeft, padTop + plotH, padLeft + plotW, padTop + plotH, 'chart-axis', ` stroke="${COLOR.grid}"`));

  // 柱：场次
  rows.forEach((row, index) => {
    const centerX = padLeft + slot * (index + 0.5);
    const barH = (row.games / maxGames) * plotH;
    const x = centerX - barW / 2;
    const y = padTop + plotH - barH;
    const winrateText = row.winrate == null ? '无胜率' : `胜率 ${pctText(row.winrate)}`;
    const title = `${row.key} · ${intFmt(row.games)} 场 · ${winrateText}`;
    parts.push(
      `<rect class="chart-bar" x="${r2(x)}" y="${r2(y)}" width="${r2(barW)}" height="${r2(Math.max(0, barH))}" rx="1.5" fill="${COLOR.blue}" fill-opacity="0.55"><title>${esc(title)}</title></rect>`
    );
  });

  // 折线：胜率；null 处断线（跳过点，不画假数据）
  const segments = [];
  let current = [];
  rows.forEach((row, index) => {
    if (row.winrate == null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({
      x: padLeft + slot * (index + 0.5),
      y: padTop + plotH * (1 - clamp01(row.winrate)),
      row,
    });
  });
  if (current.length) segments.push(current);

  const points = [];
  segments.forEach((segment) => {
    if (segment.length > 1) {
      const coords = segment.map((point) => `${r2(point.x)},${r2(point.y)}`).join(' ');
      points.push(`<polyline class="chart-line" points="${coords}" fill="none" stroke="${COLOR.gold}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`);
    }
    segment.forEach((point) => {
      const tip = `${point.row.key} · 胜率 ${pctText(point.row.winrate)} · ${intFmt(point.row.wins)} 胜 / ${intFmt(point.row.games)} 场`;
      points.push(
        `<circle class="chart-dot" cx="${r2(point.x)}" cy="${r2(point.y)}" r="2.4" fill="${COLOR.gold}" stroke="${COLOR.panel}" stroke-width="1.2"><title>${esc(tip)}</title></circle>`
      );
    });
  });
  parts.push(points.join(''));

  // 月份标签：按密度抽稀
  const step = Math.max(1, Math.ceil(rows.length / 14));
  rows.forEach((row, index) => {
    if (index % step !== 0 && index !== rows.length - 1) return;
    parts.push(
      svgText(truncate(row.key, 8), {
        x: padLeft + slot * (index + 0.5),
        y: h - padBottom + 20,
        className: 'chart-label',
      })
    );
  });

  parts.push(svgText('场次', { x: padLeft - 9, y: padTop - 11, anchor: 'end', className: 'chart-axis-title' }));
  parts.push(svgText('胜率', { x: padLeft + plotW + 9, y: padTop - 11, anchor: 'start', className: 'chart-axis-title' }));
  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* 4) 作息热力图：7 行（日）× 24 列（时）                                */
/* ------------------------------------------------------------------ */

export function heatmap({
  cells,
  width = 960,
  height = 300,
  rowLabels = WEEKDAYS,
  colLabels = Array.from({ length: 24 }, (_, hour) => String(hour)),
} = {}) {
  const w = clampNum(width, 240, 4000, 960);
  const h = clampNum(height, 140, 4000, 300);
  const rawCells = Array.isArray(cells) ? cells : [];
  if (rawCells.length === 0) return emptyChart('heatmap', w, h);

  const rowLabelText = Array.isArray(rowLabels) && rowLabels.length >= 7
    ? rowLabels.slice(0, 7).map((label) => String(label))
    : WEEKDAYS.slice();
  const colLabelText = Array.isArray(colLabels) && colLabels.length >= 24
    ? colLabels.slice(0, 24).map((label) => String(label))
    : Array.from({ length: 24 }, (_, hour) => String(hour));

  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ games: 0, wins: 0, winrate: null })));
  rawCells.forEach((cell) => {
    if (!cell) return;
    const day = optNum(cell.day);
    const hour = optNum(cell.hour);
    if (day == null || hour == null) return;
    const d = Math.round(day);
    const hr = Math.round(hour);
    if (d < 0 || d > 6 || hr < 0 || hr > 23) return;
    const games = Math.round(nonNeg(cell.games));
    const wins = Math.min(games, Math.round(nonNeg(cell.wins)));
    grid[d][hr] = {
      games,
      wins,
      winrate: optNum(cell.winrate) == null ? (games > 0 ? wins / games : null) : clamp01(cell.winrate),
    };
  });

  const maxGames = Math.max(1, ...grid.flat().map((cell) => cell.games));
  const totalGames = grid.flat().reduce((sum, cell) => sum + cell.games, 0);

  const padLeft = 42;
  const padRight = 12;
  const padTop = 24;
  const padBottom = 24;
  const plotW = Math.max(60, w - padLeft - padRight);
  const plotH = Math.max(60, h - padTop - padBottom);
  const cellW = plotW / 24;
  const cellH = plotH / 7;
  const gap = Math.min(2, Math.max(1, cellW * 0.08));
  const rectW = Math.max(1, cellW - gap);
  const rectH = Math.max(1, cellH - gap);
  const radius = r2(Math.min(2.5, Math.min(rectW, rectH) * 0.18));

  const titleText = `作息热力图 · 7 × 24 · 共 ${intFmt(totalGames)} 场`;
  const parts = [svgOpen('heatmap', w, h, titleText)];
  const rects = [];

  grid.forEach((row, day) => {
    row.forEach((cell, hour) => {
      const x = padLeft + hour * cellW + gap / 2;
      const y = padTop + day * cellH + gap / 2;
      const fill = cell.games > 0 ? COLOR.radiant : COLOR.emptyCell;
      const opacity = cell.games > 0 ? r2(0.16 + 0.84 * Math.pow(cell.games / maxGames, 0.62)) : 1;
      const tip = `${rowLabelText[day]} ${colLabelText[hour]} 时 · ${intFmt(cell.games)} 场 · 胜率 ${pctText(cell.winrate)}`;
      rects.push(
        `<rect class="heat-cell" x="${r2(x)}" y="${r2(y)}" width="${r2(rectW)}" height="${r2(rectH)}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}"><title>${esc(tip)}</title></rect>`
      );
    });
    parts.push(
      svgText(rowLabelText[day], {
        x: padLeft - 9,
        y: padTop + day * cellH + cellH / 2,
        anchor: 'end',
        baseline: 'central',
        className: 'chart-label heat-row-label',
      })
    );
  });
  parts.push(rects.join(''));

  const labelStep = 2;
  const colTicks = [];
  for (let hour = 0; hour < 24; hour += labelStep) {
    colTicks.push(
      svgText(colLabelText[hour], {
        x: padLeft + hour * cellW + cellW / 2,
        y: h - padBottom + 16,
        className: 'chart-tick heat-col-label',
      })
    );
  }
  parts.push(`<g class="heat-col-labels">${colTicks.join('')}</g>`);
  parts.push(svgText('时', { x: w - padRight, y: h - padBottom + 16, anchor: 'end', className: 'chart-tick heat-col-label' }));
  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* 5) 环形图（模式 / 匹配类型分布）                                      */
/* ------------------------------------------------------------------ */

export function donut({ slices, size = 220, thickness = 30, centerValue = '', centerLabel = '' } = {}) {
  const s = clampNum(size, 80, 640, 220);
  const t = clampNum(thickness, 5, s / 2 - 6, 30);
  const rows = (Array.isArray(slices) ? slices : [])
    .map((slice, index) => ({
      label: slice && slice.label != null ? String(slice.label) : '',
      value: nonNeg(slice && slice.value),
      color: safeColor(slice && slice.color, PALETTE[index % PALETTE.length]),
    }))
    .filter((slice) => slice.value > 0);

  if (rows.length === 0) return emptyChart('donut', s, s);

  const total = rows.reduce((sum, slice) => sum + slice.value, 0);
  const c = s / 2;
  const pad = Math.max(2, s * 0.03);
  const radius = Math.max(8, (s - t) / 2 - pad);
  const circumference = 2 * Math.PI * radius;

  const centerText = String(centerValue == null ? '' : centerValue);
  const labelText = String(centerLabel == null ? '' : centerLabel);
  const titleText = `环形图：${rows.map((slice) => slice.label).slice(0, 4).join('、')} · 合计 ${intFmt(total)}`;

  const parts = [svgOpen('donut', s, s, titleText)];
  let offset = 0;
  const arcs = [];
  rows.forEach((slice) => {
    const length = (slice.value / total) * circumference;
    const tip = `${slice.label} · ${intFmt(slice.value)}（${pctText(slice.value / total)}）`;
    arcs.push(
      `<circle class="donut-slice" cx="${r2(c)}" cy="${r2(c)}" r="${r2(radius)}" fill="none" stroke="${esc(slice.color)}" ` +
        `stroke-width="${r2(t)}" stroke-dasharray="${r2(length)} ${r2(Math.max(0, circumference - length))}" ` +
        `stroke-dashoffset="${r2(-offset)}" transform="rotate(-90 ${r2(c)} ${r2(c)})"><title>${esc(tip)}</title></circle>`
    );
    offset += length;
  });
  parts.push(arcs.join(''));

  if (centerText) {
    parts.push(
      svgText(centerText, {
        x: c,
        y: labelText ? c - s * 0.045 : c,
        baseline: 'central',
        className: 'chart-value donut-value',
        style: `font-size:${Math.round(s * 0.19)}px`,
      })
    );
  }
  if (labelText) {
    parts.push(
      svgText(labelText, {
        x: c,
        y: c + s * 0.145,
        baseline: 'central',
        className: 'chart-label donut-label',
        style: `font-size:${Math.max(9, Math.round(s * 0.07))}px`,
      })
    );
  }
  parts.push('</svg>');
  return parts.join('');
}
