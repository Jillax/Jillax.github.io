/* ============================================
   Jillax.github.io — Portfolio Dashboard
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    fetch('data/portfolio.json')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            renderStats(data);
            renderLineChart(data);
            renderChart(data);
            renderPctBars(data);
            renderTable(data);
            renderProjection(data);
            renderHoldDays(data);
            var updateDateEl = document.getElementById('updateDate');
            if (updateDateEl) updateDateEl.textContent = data.updated;
            document.getElementById('updateNote').textContent = '更新于 ' + data.updated;
        })
        .catch(function() {
            document.getElementById('totalValue').textContent = '加载失败';
        });

    function calcItem(item) {
        if (item.subItems) {
            var totalValue = 0, totalCost = 0;
            item.subItems.forEach(function(s) {
                totalValue += s.value;
                totalCost += s.cost;
            });
            return { value: totalValue, cost: totalCost };
        }
        return { value: item.value || 0, cost: item.cost || 0 };
    }

    function fmt(n) { return '¥' + Math.round(n).toLocaleString(); }
    function fmtGain(n) { return (n >= 0 ? '+' : '') + '¥' + Math.round(Math.abs(n)).toLocaleString(); }

    function renderHoldDays(data) {
        if (!data.history || data.history.length === 0) return;
        var firstDate = new Date(data.history[0].date);
        var now = new Date();
        var days = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24)) + 365;
        var el = document.getElementById('holdDays');
        if (el) el.textContent = days + ' 天';
    }

    function renderStats(data) {
        var totalValue = 0, totalCost = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                totalValue += c.value;
                totalCost += c.cost;
            });
        });
        var gain = totalValue - totalCost;
        var pct = totalCost > 0 ? ((gain / totalCost) * 100).toFixed(2) : '0.00';
        var isPos = gain >= 0;

        document.getElementById('totalValue').textContent = fmt(totalValue);
        var totalCostEl = document.getElementById('totalCost');
        if (totalCostEl) totalCostEl.textContent = fmt(totalCost);

        var gainEl = document.getElementById('totalGain');
        gainEl.className = 'pf-hero-stat-value ' + (isPos ? 'green' : 'red');
        gainEl.textContent = fmtGain(gain);
        document.getElementById('gainPct').textContent = (isPos ? '+' : '') + pct + '%';
    }

    function renderLineChart(data) {
        var canvas = document.getElementById('lineChart');
        var empty = document.getElementById('lineChartEmpty');

        if (!data.history || data.history.length === 0) {
            canvas.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = '暂无历史数据，下次更新组合时自动记录';
            return;
        }

        canvas.style.display = '';
        empty.style.display = 'none';

        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
        var W = canvas.width, H = canvas.height;

        var values = data.history.map(function(h) { return h.value; });
        var isSingle = values.length === 1;
        var pad = { top: 30, right: 30, bottom: 40, left: 70 };
        var chartW = W - pad.left - pad.right;
        var chartH = H - pad.top - pad.bottom;

        var minV = Math.min.apply(null, values) * 0.95;
        var maxV = Math.max.apply(null, values) * 1.05;
        if (isSingle) { minV = values[0] * 0.9; maxV = values[0] * 1.1; }
        var range = maxV - minV || 1;

        function getX(i) { return pad.left + (isSingle ? chartW / 2 : (i / (values.length - 1)) * chartW); }
        function getY(v) { return pad.top + chartH - ((v - minV) / range) * chartH; }

        // Grid
        ctx.strokeStyle = 'rgba(155, 89, 255, 0.08)';
        ctx.lineWidth = 1;
        for (var gi = 0; gi <= 4; gi++) {
            var gy = pad.top + chartH * gi / 4;
            ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
            ctx.fillStyle = '#6b5a8a';
            ctx.font = '10px "Share Tech Mono"';
            ctx.textAlign = 'right';
            ctx.fillText('¥' + Math.round(maxV - range * gi / 4).toLocaleString(), pad.left - 8, gy + 3);
        }

        // Gradient fill
        var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
        grad.addColorStop(0, 'rgba(155, 89, 255, 0.2)');
        grad.addColorStop(1, 'rgba(155, 89, 255, 0.01)');

        if (!isSingle) {
            ctx.beginPath();
            ctx.moveTo(getX(0), getY(values[0]));
            for (var li = 1; li < values.length; li++) {
                var prevX = getX(li - 1), prevY = getY(values[li - 1]);
                var curX = getX(li), curY = getY(values[li]);
                var cpx = (prevX + curX) / 2;
                ctx.bezierCurveTo(cpx, prevY, cpx, curY, curX, curY);
            }
            ctx.lineTo(getX(values.length - 1), pad.top + chartH);
            ctx.lineTo(getX(0), pad.top + chartH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Line
            ctx.beginPath();
            ctx.moveTo(getX(0), getY(values[0]));
            for (var li2 = 1; li2 < values.length; li2++) {
                var px2 = getX(li2 - 1), py2 = getY(values[li2 - 1]);
                var cx2 = getX(li2), cy2 = getY(values[li2]);
                var cpx2 = (px2 + cx2) / 2;
                ctx.bezierCurveTo(cpx2, py2, cpx2, cy2, cx2, cy2);
            }
            ctx.strokeStyle = '#9b59ff';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(155, 89, 255, 0.4)';
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Points
        for (var pi = 0; pi < values.length; pi++) {
            var px3 = getX(pi), py3 = getY(values[pi]);
            ctx.fillStyle = '#9b59ff';
            ctx.shadowColor = 'rgba(155, 89, 255, 0.5)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(px3, py3, isSingle ? 6 : 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0d0a1a';
            ctx.beginPath();
            ctx.arc(px3, py3, isSingle ? 3 : 1.5, 0, Math.PI * 2);
            ctx.fill();

            // X label
            if (!isSingle || pi === 0) {
                var d = new Date(data.history[pi].date);
                var lbl = (d.getMonth() + 1) + '/' + d.getDate();
                ctx.fillStyle = '#6b5a8a';
                ctx.font = '10px "Share Tech Mono"';
                ctx.textAlign = 'center';
                ctx.fillText(lbl, px3, pad.top + chartH + 20);
            }
        }

        // Last value label
        var lastV = values[values.length - 1];
        var lx = getX(values.length - 1), ly = getY(lastV);
        ctx.fillStyle = '#b47aff';
        ctx.font = '600 12px "Share Tech Mono"';
        ctx.textAlign = 'right';
        ctx.shadowColor = 'rgba(155, 89, 255, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText(fmt(lastV), lx, ly - 12);
        ctx.shadowBlur = 0;
    }

    function renderChart(data) {
        var labels = [];
        var values = [];
        var colors = [];
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                labels.push(item.name);
                values.push(c.value);
                colors.push(item.color || cat.color);
            });
        });

        var canvas = document.getElementById('allocationChart');
        var ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
        var W = canvas.width, H = canvas.height;
        var total = values.reduce(function(a, b) { return a + b; }, 0);
        var cx = W / 2, cy = H / 2 - 20;
        var R = Math.min(W, H) / 2 - 40;
        var innerR = R * 0.6;

        var startAngle = -Math.PI / 2;
        values.forEach(function(v, i) {
            var sliceAngle = (v / total) * Math.PI * 2;
            var endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.arc(cx, cy, R, startAngle, endAngle);
            ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[i];
            ctx.shadowColor = colors[i];
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Gap
            ctx.strokeStyle = '#0d0a1a';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle = endAngle;
        });

        // Center text
        ctx.fillStyle = '#d4c8ef';
        ctx.font = '600 14px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(fmt(total), cx, cy - 4);
        ctx.fillStyle = '#6b5a8a';
        ctx.font = '10px "Share Tech Mono"';
        ctx.fillText('TOTAL', cx, cy + 14);

        // Legend at bottom
        var legendY = cy + R + 24;
        var legendItemW = 100;
        var startX = cx - (labels.length * legendItemW) / 2;
        labels.forEach(function(label, i) {
            var lx = startX + i * legendItemW + legendItemW / 2;
            ctx.fillStyle = colors[i];
            ctx.beginPath();
            ctx.arc(lx - 20, legendY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#a896cc';
            ctx.font = '11px "Noto Sans SC"';
            ctx.textAlign = 'left';
            var shortLabel = label.length > 6 ? label.substring(0, 6) : label;
            ctx.fillText(shortLabel, lx - 14, legendY + 4);
        });
    }

    function renderPctBars(data) {
        var totalValue = 0;
        var cats = data.categories.map(function(cat) {
            var cv = 0;
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                cv += c.value;
            });
            totalValue += cv;
            return { name: cat.name, value: cv, color: cat.color };
        });

        var rows = document.querySelectorAll('#pctBars .pct-row');
        rows.forEach(function(row, i) {
            var cat = cats[i] || { name: '', value: 0, color: 'var(--gold)' };
            var pct = totalValue > 0 ? (cat.value / totalValue * 100) : 0;
            var pctStr = pct.toFixed(1);
            row.querySelector('.pct-name').textContent = cat.name;
            row.querySelector('.pct-value').textContent = pctStr + '%';
            var fill = row.querySelector('.pct-fill');
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    fill.style.width = pctStr + '%';
                });
            });
        });
    }

    function renderTable(data) {
        var tbody = document.getElementById('tableBody');
        var html = '';
        var idx = 0;

        data.categories.forEach(function(cat) {
            var catValue = 0, catCost = 0;
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                catValue += c.value;
                catCost += c.cost;
            });
            var catGain = catValue - catCost;
            var catCls = catGain >= 0 ? 'gain-pos' : 'gain-neg';
            var catRet = catCost > 0 ? ((catGain / catCost) * 100).toFixed(2) + '%' : '-';

            html += '<tr class="cat-row">' +
                '<td style="color:' + cat.color + ';font-family:var(--font-display);letter-spacing:1px">' + cat.name + '</td>' +
                '<td>' + fmt(catCost) + '</td>' +
                '<td>' + fmt(catValue) + '</td>' +
                '<td class="' + catCls + '">' + fmtGain(catGain) + '</td>' +
                '<td class="' + catCls + '">' + catRet + '</td></tr>';

            cat.items.forEach(function(item) {
                var c = calcItem(item);
                var gain = c.value - c.cost;
                var cls = gain >= 0 ? 'gain-pos' : 'gain-neg';
                var ret = c.cost > 0 ? ((gain / c.cost) * 100).toFixed(2) + '%' : '-';
                var hasSub = item.subItems && item.subItems.length > 0;
                var rowId = 'item-' + idx;

                html += '<tr class="item-row" id="' + rowId + '" data-idx="' + idx + '">' +
                    '<td><span class="arrow">' + (hasSub ? '▶' : '') + '</span>' + item.name + '</td>' +
                    '<td>' + fmt(c.cost) + '</td>' +
                    '<td>' + fmt(c.value) + '</td>' +
                    '<td class="' + cls + '">' + fmtGain(gain) + '</td>' +
                    '<td class="' + cls + '">' + ret + '</td></tr>';

                if (hasSub) {
                    item.subItems.forEach(function(sub) {
                        var sg = sub.value - sub.cost;
                        var sCls = sg >= 0 ? 'gain-pos' : 'gain-neg';
                        var sRet = sub.cost > 0 ? ((sg / sub.cost) * 100).toFixed(2) + '%' : '-';
                        html += '<tr class="sub-row" data-parent="' + idx + '">' +
                            '<td style="padding-left:40px">' + sub.name +
                            (sub.dca ? ' <span class="dca-badge">定投中</span>' : '') + '</td>' +
                            '<td>' + fmt(sub.cost) + '</td>' +
                            '<td>' + fmt(sub.value) + '</td>' +
                            '<td class="' + sCls + '">' + fmtGain(sg) + '</td>' +
                            '<td class="' + sCls + '">' + sRet + '</td></tr>';
                    });
                }
                idx++;
            });
        });

        var tv = 0, tc = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                tv += c.value;
                tc += c.cost;
            });
        });
        var tg = tv - tc;
        var tCls = tg >= 0 ? 'gain-pos' : 'gain-neg';
        var tRet = tc > 0 ? ((tg / tc) * 100).toFixed(2) + '%' : '-';
        html += '<tr class="total-row">' +
            '<td>合计</td>' +
            '<td>' + fmt(tc) + '</td>' +
            '<td>' + fmt(tv) + '</td>' +
            '<td class="' + tCls + '">' + fmtGain(tg) + '</td>' +
            '<td class="' + tCls + '">' + tRet + '</td></tr>';

        tbody.innerHTML = html;

        document.querySelectorAll('.item-row').forEach(function(row) {
            row.addEventListener('click', function() {
                var idx = this.dataset.idx;
                var subs = document.querySelectorAll('.sub-row[data-parent="' + idx + '"]');
                var isOpen = this.classList.toggle('expanded');
                subs.forEach(function(s) { s.classList.toggle('open', isOpen); });
            });
        });
    }

    function renderProjection(data) {
        var returnRates = {
            '定期存款': 0.0125,
            '短债': 0.028,
            '沪深300': 0.06,
            '标普500': 0.10,
            '纳斯达克100': 0.12,
            '恒生科技': 0.06,
            '恒生ETF': 0.04
        };

        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        var items = [];
        var totalCurrent = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                var c = calcItem(item);
                var rate = returnRates[item.name] || 0;
                items.push({ name: item.name, value: c.value, rate: rate, color: item.color || cat.color });
                totalCurrent += c.value;
            });
        });

        var projYears = [0, 1, 2, 3, 4, 5];
        var projTotals = projYears.map(function(year) {
            var sum = 0;
            items.forEach(function(item) {
                sum += item.value * Math.pow(1 + item.rate, year);
            });
            return sum;
        });

        var weightedSum = 0;
        items.forEach(function(item) {
            weightedSum += item.value * item.rate;
        });
        var blendedRate = totalCurrent > 0 ? (weightedSum / totalCurrent) : 0;

        var blendedEl = document.getElementById('projectionBlended');
        if (blendedEl) {
            blendedEl.innerHTML = '投资组合预计年化 <strong>' + (blendedRate * 100).toFixed(1) + '%</strong> · 加权平均，基于各类资产当前市值分配';
        }

        var tbody = document.getElementById('projectionTableBody');
        var html = '';
        items.forEach(function(item) {
            html += '<tr>' +
                '<td><span class="dot" style="background:' + item.color + '"></span>' + item.name + '</td>' +
                '<td class="num">' + fmt(item.value) + '</td>' +
                '<td class="num rate-cell">' + (item.rate * 100).toFixed(1) + '%</td>' +
                '<td class="num">' + fmt(item.value * Math.pow(1 + item.rate, 1)) + '</td>' +
                '<td class="num">' + fmt(item.value * Math.pow(1 + item.rate, 3)) + '</td>' +
                '<td class="num">' + fmt(item.value * Math.pow(1 + item.rate, 5)) + '</td></tr>';
        });
        html += '<tr class="projection-total">' +
            '<td>合计</td>' +
            '<td class="num">' + fmt(projTotals[0]) + '</td>' +
            '<td></td>' +
            '<td class="num">' + fmt(projTotals[1]) + '</td>' +
            '<td class="num">' + fmt(projTotals[3]) + '</td>' +
            '<td class="num">' + fmt(projTotals[5]) + '</td></tr>';
        tbody.innerHTML = html;

        var canvas = document.getElementById('projectionChart');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
        var W = canvas.width, H = canvas.height;
        var projLabels = ['现在', '1年', '2年', '3年', '4年', '5年'];
        var pad2 = { top: 20, right: 20, bottom: 30, left: 60 };
        var cw = W - pad2.left - pad2.right;
        var ch = H - pad2.top - pad2.bottom;
        var pMin = Math.min.apply(null, projTotals) * 0.95;
        var pMax = Math.max.apply(null, projTotals) * 1.05;
        var pRange = pMax - pMin || 1;

        function pX(i) { return pad2.left + (i / 5) * cw; }
        function pY(v) { return pad2.top + ch - ((v - pMin) / pRange) * ch; }

        // Grid
        ctx.strokeStyle = 'rgba(155, 89, 255, 0.08)';
        ctx.lineWidth = 1;
        for (var gi2 = 0; gi2 <= 4; gi2++) {
            var gy2 = pad2.top + ch * gi2 / 4;
            ctx.beginPath(); ctx.moveTo(pad2.left, gy2); ctx.lineTo(W - pad2.right, gy2); ctx.stroke();
            ctx.fillStyle = '#6b5a8a';
            ctx.font = '10px "Share Tech Mono"';
            ctx.textAlign = 'right';
            ctx.fillText('¥' + Math.round(pMax - pRange * gi2 / 4).toLocaleString(), pad2.left - 6, gy2 + 3);
        }

        // Gradient fill
        var grad2 = ctx.createLinearGradient(0, pad2.top, 0, pad2.top + ch);
        grad2.addColorStop(0, 'rgba(255, 77, 166, 0.15)');
        grad2.addColorStop(1, 'rgba(255, 77, 166, 0.01)');

        ctx.beginPath();
        ctx.moveTo(pX(0), pY(projTotals[0]));
        for (var pi2 = 1; pi2 < 6; pi2++) {
            var px4 = pX(pi2 - 1), py4 = pY(projTotals[pi2 - 1]);
            var cx4 = pX(pi2), cy4 = pY(projTotals[pi2]);
            var cpx4 = (px4 + cx4) / 2;
            ctx.bezierCurveTo(cpx4, py4, cpx4, cy4, cx4, cy4);
        }
        ctx.lineTo(pX(5), pad2.top + ch);
        ctx.lineTo(pX(0), pad2.top + ch);
        ctx.closePath();
        ctx.fillStyle = grad2;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(pX(0), pY(projTotals[0]));
        for (var pi3 = 1; pi3 < 6; pi3++) {
            var px5 = pX(pi3 - 1), py5 = pY(projTotals[pi3 - 1]);
            var cx5 = pX(pi3), cy5 = pY(projTotals[pi3]);
            var cpx5 = (px5 + cx5) / 2;
            ctx.bezierCurveTo(cpx5, py5, cpx5, cy5, cx5, cy5);
        }
        ctx.strokeStyle = '#ff4da6';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 77, 166, 0.4)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points + labels
        for (var pi4 = 0; pi4 < 6; pi4++) {
            var px6 = pX(pi4), py6 = pY(projTotals[pi4]);
            ctx.fillStyle = '#ff4da6';
            ctx.shadowColor = 'rgba(255, 77, 166, 0.5)';
            ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(px6, py6, 4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#0d0a1a';
            ctx.beginPath(); ctx.arc(px6, py6, 2, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#6b5a8a';
            ctx.font = '10px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(projLabels[pi4], px6, pad2.top + ch + 18);
        }

        // End value label
        ctx.fillStyle = '#ff4da6';
        ctx.font = '600 12px "Share Tech Mono"';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(255, 77, 166, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText(fmt(projTotals[5]), pX(5) + 8, pY(projTotals[5]) - 4);
        ctx.shadowBlur = 0;
    }
});
