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

        var labels = data.history.map(function(h) {
            var d = new Date(h.date);
            return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        });
        var values = data.history.map(function(h) { return h.value; });

        var gradient = ctx.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(155, 89, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(155, 89, 255, 0.01)');

        var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        var textColor = isDark ? 'rgba(212, 200, 239, 0.5)' : 'rgba(168, 150, 204, 0.5)';
        var gridColor = isDark ? 'rgba(155, 89, 255, 0.06)' : 'rgba(155, 89, 255, 0.1)';

        var isSingle = data.history.length === 1;

        new Chart(ctx, {
            type: isSingle ? 'scatter' : 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: isSingle
                        ? values.map(function(v, i) { return { x: i, y: v }; })
                        : values,
                    borderColor: '#9b59ff',
                    backgroundColor: gradient,
                    borderWidth: isSingle ? 0 : 1.5,
                    pointBackgroundColor: '#9b59ff',
                    pointBorderColor: isDark ? '#0d0a1a' : '#1a1530',
                    pointBorderWidth: 1.5,
                    pointRadius: isSingle ? 8 : 3,
                    pointHoverRadius: isSingle ? 10 : 5,
                    fill: !isSingle,
                    tension: 0.3,
                    showLine: !isSingle
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(13, 10, 26, 0.95)',
                        titleFont: { family: 'Noto Sans SC, sans-serif', size: 12 },
                        bodyFont: { family: 'Rajdhani, sans-serif', size: 13, weight: '600' },
                        padding: 12,
                        cornerRadius: 2,
                        borderColor: 'rgba(155, 89, 255, 0.3)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: function(items) {
                                return data.history[items[0].dataIndex].date;
                            },
                            label: function(ctx) {
                                return fmt(ctx.parsed.y !== undefined ? ctx.parsed.y : 0);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { family: 'Share Tech Mono, monospace', size: 10 },
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: {
                            color: textColor,
                            font: { family: 'Share Tech Mono, monospace', size: 10 },
                            callback: function(v) { return '¥' + Math.round(v).toLocaleString(); }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
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
                colors.push(cat.color);
            });
        });

        var ctx = document.getElementById('allocationChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    spacing: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d4c8ef',
                            font: { family: 'Noto Sans SC', size: 11 },
                            padding: 14,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(13, 10, 26, 0.95)',
                        titleFont: { family: 'Noto Sans SC', size: 13 },
                        bodyFont: { family: 'Rajdhani', size: 12 },
                        padding: 14,
                        cornerRadius: 2,
                        borderColor: 'rgba(155, 89, 255, 0.3)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(ctx) {
                                var total = values.reduce(function(a, b) { return a + b; }, 0);
                                var pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return fmt(ctx.parsed) + '  (' + pct + '%)';
                            }
                        }
                    }
                }
            }
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
                '<td style="color:' + cat.color + '">' + cat.name + '</td>' +
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
                items.push({ name: item.name, value: c.value, rate: rate, color: cat.color });
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

        var labelColor = isDark ? 'rgba(212, 200, 239, 0.5)' : 'rgba(168, 150, 204, 0.5)';
        var gridColor = isDark ? 'rgba(155, 89, 255, 0.06)' : 'rgba(155, 89, 255, 0.1)';

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['现在', '1年', '2年', '3年', '4年', '5年'],
                datasets: [{
                    data: projTotals,
                    borderColor: '#ff4da6',
                    backgroundColor: function(context) {
                        var chart = context.chart;
                        var c = chart.ctx;
                        var ca = chart.chartArea;
                        if (!ca) return null;
                        var g = c.createLinearGradient(0, ca.top, 0, ca.bottom);
                        g.addColorStop(0, 'rgba(255, 77, 166, 0.2)');
                        g.addColorStop(1, 'rgba(255, 77, 166, 0.01)');
                        return g;
                    },
                    borderWidth: 1.5,
                    pointBackgroundColor: '#ff4da6',
                    pointBorderColor: isDark ? '#0d0a1a' : '#1a1530',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(13, 10, 26, 0.95)',
                        titleFont: { family: 'Noto Sans SC, sans-serif', size: 12 },
                        bodyFont: { family: 'Rajdhani, sans-serif', size: 13, weight: '600' },
                        padding: 12,
                        cornerRadius: 2,
                        borderColor: 'rgba(255, 77, 166, 0.3)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: function(ctx) { return fmt(ctx.parsed.y); }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: labelColor, font: { family: 'Share Tech Mono, monospace', size: 10 } }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: {
                            color: labelColor,
                            font: { family: 'Share Tech Mono, monospace', size: 10 },
                            callback: function(v) { return '¥' + Math.round(v).toLocaleString(); }
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }
});
