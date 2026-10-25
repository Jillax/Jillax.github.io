/* ============================================
   Jillax.github.io — Portfolio Dashboard
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    var chartRefs = { allocation: null, projection: null };
    var portfolioData = null;
    var lastProjectionTotals = null;
    var holdingsChartsDrawn = false;
    var chartsDeferred = false;

    function isHoldingsActive() {
        if (window.PortfolioWorkspace) {
            return window.PortfolioWorkspace.getActive() === 'holdings';
        }
        var panel = document.getElementById('panel-holdings');
        return !panel || !panel.hidden;
    }

    function resizeCharts() {
        [chartRefs.allocation, chartRefs.projection].forEach(function(chart) {
            if (chart) chart.resize();
        });
    }

    document.addEventListener('portfolio:tabchange', function(e) {
        if (!e.detail || e.detail.id !== 'holdings') return;
        if (portfolioData && chartsDeferred) {
            drawHoldingsCharts(portfolioData);
            chartsDeferred = false;
        } else {
            window.setTimeout(resizeCharts, 60);
        }
    });

    document.addEventListener('portfolio:focuschange', function() {
        window.setTimeout(resizeCharts, 380);
    });

    window.PortfolioWorkspace.fetchJSON('data/portfolio.json')
        .then(function(data) {
            portfolioData = data;
            renderStats(data);
            renderPctBars(data);
            renderTable(data);
            renderProjectionTable(data);
            if (document.getElementById('lineChart')) renderLineChart(data);

            if (isHoldingsActive()) {
                drawHoldingsCharts(data);
            } else {
                chartsDeferred = true;
            }

            var updateDateEl = document.getElementById('updateDate');
            if (updateDateEl) updateDateEl.textContent = data.updated;
            document.getElementById('updateNote').textContent = '更新于 ' + data.updated;

            var total = totalAssets(data);
            var itemCount = countItems(data);
            var holdingsMeta = document.getElementById('tabMetaHoldings');
            if (holdingsMeta) {
                holdingsMeta.textContent = itemCount + ' 项 · ' + (total / 10000).toFixed(2) + ' 万';
            }

            if (window.PortfolioWorkspace) window.PortfolioWorkspace.setStatus('SYNC OK');
            loadLookThrough(data);
        })
        .catch(function() {
            document.getElementById('totalValue').textContent = '加载失败';
            if (window.PortfolioWorkspace) {
                window.PortfolioWorkspace.setStatus('DATA ERR', true);
            }
        });

    function drawHoldingsCharts(data) {
        if (holdingsChartsDrawn) {
            resizeCharts();
            return;
        }
        holdingsChartsDrawn = true;
        renderChart(data);
        drawProjectionChart(lastProjectionTotals);
    }

    function loadLookThrough(portfolio) {
        var body = document.getElementById('lookthroughBody');
        if (!body) return;
        window.PortfolioWorkspace.fetchJSON('data/index-lookthrough.json')
            .then(function(weights) {
                var result = window.LookThrough.aggregateLookthrough(portfolio, weights);
                renderLookThrough(result);
                var meta = document.getElementById('tabMetaLookthrough');
                if (meta && result.rows.length) {
                    meta.textContent = '最大 ' + result.rows[0].tickers.split(' / ')[0] +
                        ' ' + (result.rows[0].share * 100).toFixed(1) + '%';
                }
            })
            .catch(function() {
                document.getElementById('ltLead').textContent = '穿透数据加载失败。';
                var meta = document.getElementById('tabMetaLookthrough');
                if (meta) meta.textContent = '数据读取失败';
            });
    }

    function renderLookThrough(result) {
        var fmtPct = function(v) { return (v * 100).toFixed(1) + '%'; };
        var fmtWeight = function(v) { return v.toFixed(2) + '%'; };
        var miss = '<span class="lt-weight-miss">—</span>';
        var largest = result.rows[0];
        var top10Share = result.usEquity > 0 ? result.top10Value / result.usEquity : 0;

        document.getElementById('ltLead').innerHTML =
            '最大单一敞口 <strong>' + largest.name + '</strong> ' + fmt(largest.value) +
            '，占总资产 ' + fmtPct(largest.share) +
            '；前十大个股合计 ' + fmt(result.top10Value) +
            '，占美股权益 ' + fmtPct(top10Share) +
            '。标普与纳指重叠的 ' + result.overlapCount + ' 只已合并计算。';

        var html = '';
        result.rows.forEach(function(row) {
            html += '<tr>' +
                '<td>' + row.name + '<span class="lt-ticker">' + row.tickers + '</span></td>' +
                '<td class="num">' + (row.weights.sp500 ? fmtWeight(row.weights.sp500) : miss) + '</td>' +
                '<td class="num">' + (row.weights.ndx ? fmtWeight(row.weights.ndx) : miss) + '</td>' +
                '<td class="num">' + fmt(row.value) + '</td>' +
                '<td class="num">' + fmtPct(row.share) + '</td></tr>';
        });
        result.residuals.forEach(function(res) {
            html += '<tr class="lt-residual">' +
                '<td>' + res.name + '</td>' +
                '<td class="num">' + (res.key === 'sp500' ? '余 ' + fmtWeight(res.residualWeight) : miss) + '</td>' +
                '<td class="num">' + (res.key === 'ndx' ? '余 ' + fmtWeight(res.residualWeight) : miss) + '</td>' +
                '<td class="num">' + fmt(res.value) + '</td>' +
                '<td class="num">' + fmtPct(res.share) + '</td></tr>';
        });

        var equityShare = result.totalAssets > 0 ? result.usEquity / result.totalAssets : 0;
        html += '<tr class="total-row">' +
            '<td>美股指数基金合计</td>' +
            '<td class="num">' + miss + '</td>' +
            '<td class="num">' + miss + '</td>' +
            '<td class="num">' + fmt(result.usEquity) + '</td>' +
            '<td class="num">' + fmtPct(equityShare) + '</td></tr>';

        document.getElementById('lookthroughBody').innerHTML = html;

        var sources = result.indices.map(function(index) {
            return index.source + ' ' + index.asOf;
        }).join(' · ');
        document.getElementById('ltNote').innerHTML =
            '权重：' + sources + '（来源：<a href="' + result.indices[0].sourceUrl +
            '" target="_blank" rel="noopener">stockanalysis.com</a>）。' +
            '按 100% 复制指数穿透，未扣除基金现金仓位、费用与跟踪误差；' +
            '标普与纳指重叠的个股按两只基金分别计算后相加；金额为人民币口径，未做汇率拆分。';
    }

    function calcItem(item) {
        if (item.subItems) {
            var totalValue = 0;
            item.subItems.forEach(function(s) {
                totalValue += s.value;
            });
            return totalValue;
        }
        return item.value || 0;
    }

    function totalAssets(data) {
        var total = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                total += calcItem(item);
            });
        });
        return total;
    }

    function countItems(data) {
        var count = 0;
        data.categories.forEach(function(cat) {
            count += cat.items.length;
        });
        return count;
    }

    function fmt(n) { return '¥' + Math.round(n).toLocaleString(); }

    function animateNumber(el, endVal, prefix, decimals) {
        prefix = prefix || '';
        decimals = decimals || 0;
        var duration = 1200;
        var startTime = null;
        function step(ts) {
            if (!startTime) startTime = ts;
            var p = Math.min((ts - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            var v = endVal * eased;
            el.textContent = prefix + (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString());
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = prefix + (decimals > 0 ? endVal.toFixed(decimals) : Math.round(endVal).toLocaleString());
        }
        requestAnimationFrame(step);
    }

    function renderStats(data) {
        var totalValue = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                totalValue += calcItem(item);
            });
        });
        animateNumber(document.getElementById('totalValue'), totalValue, '¥');
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

        var textColor = 'rgba(212, 200, 239, 0.5)';
        var gridColor = 'rgba(155, 89, 255, 0.06)';

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
                    pointBorderColor: '#0d0a1a',
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
                labels.push(item.name);
                values.push(calcItem(item));
                colors.push(item.color || cat.color);
            });
        });

        var ctx = document.getElementById('allocationChart').getContext('2d');
        chartRefs.allocation = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    spacing: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d4c8ef',
                            font: { family: 'Noto Sans SC', size: 10 },
                            padding: 12,
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
                                return fmt(ctx.parsed) + ' (' + pct + '%)';
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
                cv += calcItem(item);
            });
            totalValue += cv;
            return { name: cat.name, value: cv, color: cat.color };
        });

        var rows = document.querySelectorAll('#pctBars .pct-row');
        rows.forEach(function(row, i) {
            var cat = cats[i] || { name: '', value: 0, color: 'var(--amber)' };
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
            var catValue = 0;
            cat.items.forEach(function(item) {
                catValue += calcItem(item);
            });

            html += '<tr class="cat-row">' +
                '<td style="color:' + cat.color + ';font-family:var(--font-display);letter-spacing:1px">' + cat.name + '</td>' +
                '<td>' + fmt(catValue) + '</td></tr>';

            cat.items.forEach(function(item) {
                var v = calcItem(item);
                var hasSub = item.subItems && item.subItems.length > 0;
                var rowId = 'item-' + idx;

                html += '<tr class="item-row" id="' + rowId + '" data-idx="' + idx + '">' +
                    '<td><span class="arrow">' + (hasSub ? '▶' : '') + '</span>' + item.name + '</td>' +
                    '<td>' + fmt(v) + '</td></tr>';

                if (hasSub) {
                    item.subItems.forEach(function(sub) {
                        html += '<tr class="sub-row" data-parent="' + idx + '">' +
                            '<td style="padding-left:40px">' + sub.name + '</td>' +
                            '<td>' + fmt(sub.value) + '</td></tr>';
                    });
                }
                idx++;
            });
        });

        var tv = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                tv += calcItem(item);
            });
        });
        html += '<tr class="total-row">' +
            '<td>合计</td>' +
            '<td>' + fmt(tv) + '</td></tr>';

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

    function renderProjectionTable(data) {
        var returnRates = {
            '定期存款': 0.0125,
            '货币基金': 0.015,
            '债券': 0.028,
            '标普500': 0.10,
            '纳斯达克100': 0.12,
            '恒生科技': 0.06
        };

        var items = [];
        var totalCurrent = 0;
        data.categories.forEach(function(cat) {
            cat.items.forEach(function(item) {
                var v = calcItem(item);
                var rate = returnRates[item.name] || 0;
                items.push({ name: item.name, value: v, rate: rate, color: item.color || cat.color });
                totalCurrent += v;
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
        lastProjectionTotals = projTotals;

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
    }

    function drawProjectionChart(projTotals) {
        if (!projTotals) return;
        var canvas = document.getElementById('projectionChart');
        if (!canvas) return;
        if (chartRefs.projection) {
            chartRefs.projection.resize();
            return;
        }
        var ctx = canvas.getContext('2d');
        var parent = canvas.parentElement;
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;

        var labelColor = 'rgba(212, 200, 239, 0.5)';
        var gridColor = 'rgba(155, 89, 255, 0.06)';

        chartRefs.projection = new Chart(ctx, {
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
                    pointBorderColor: '#0d0a1a',
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
