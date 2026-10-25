/* ============================================
   Jillax.github.io — Global Market Map
   Lazy-loads jsvectormap + daily snapshot
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = 'data/global-markets.json';
    var state = {
        loaded: false,
        loading: false,
        data: null,
        map: null,
        selectedId: null,
        mapLibPromise: null
    };

    var els = {};

    function byId(id) { return document.getElementById(id); }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function fmtNum(n) {
        return Number(n).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function pctText(n) {
        var v = Number(n);
        var sign = v > 0 ? '+' : '';
        return sign + v.toFixed(2) + '%';
    }

    function pctClass(n) {
        if (Number(n) > 0) return 'up';
        if (Number(n) < 0) return 'down';
        return 'flat';
    }

    function pctColor(n) {
        if (Number(n) > 0) return '#4ade80';
        if (Number(n) < 0) return '#ff6b8a';
        return '#9b59ff';
    }

    function utcTime(iso) {
        if (!iso) return '时间未知';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '时间未知';
        return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    }

    function loadScript(src, left) {
        left = left || 2;
        return new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = function() { resolve(); };
            script.onerror = function() {
                script.remove();
                if (left <= 1) {
                    reject(new Error('脚本加载失败：' + src));
                    return;
                }
                window.setTimeout(function() {
                    loadScript(src, left - 1).then(resolve, reject);
                }, 700);
            };
            document.head.appendChild(script);
        });
    }

    function loadMapLib() {
        if (window.jsVectorMap) return Promise.resolve();
        if (!state.mapLibPromise) {
            state.mapLibPromise = loadScript('js/vendor/jsvectormap.min.js')
                .then(function() { return loadScript('js/vendor/jsvectormap-world.js'); });
            state.mapLibPromise.catch(function() { state.mapLibPromise = null; });
        }
        return state.mapLibPromise;
    }

    function setNote(data) {
        if (!els.note) return;
        var link = data.sourceUrl
            ? '<a href="' + esc(data.sourceUrl) + '" target="_blank" rel="noopener">' + esc(data.source) + '</a>'
            : esc(data.source || '公开行情');
        els.note.innerHTML =
            '快照生成于 ' + esc(data.updated) + '；各指数为最近一个交易时段收盘，asOf 不同。' +
            '来源：' + link + '。抓取失败的指数沿用上一份快照。';
    }

    function sortedMarkets() {
        return state.data.markets.slice().sort(function(a, b) {
            if (b.changePct !== a.changePct) return b.changePct - a.changePct;
            return a.name.localeCompare(b.name, 'zh-CN');
        });
    }

    function renderSummary(data) {
        var markets = data.markets;
        var up = markets.filter(function(m) { return m.changePct > 0; }).length;
        var down = markets.filter(function(m) { return m.changePct < 0; }).length;
        var flat = markets.length - up - down;
        var avg = markets.reduce(function(sum, m) { return sum + m.changePct; }, 0) / markets.length;
        var sorted = sortedMarkets();
        var leader = sorted[0];
        var laggard = sorted[sorted.length - 1];

        var html = '' +
            '<div class="gm-summary-item">' +
                '<span class="gm-summary-k">上涨 / 下跌</span>' +
                '<span class="gm-summary-v"><b class="up">' + up + '</b> / <b class="down">' + down + '</b>' +
                    (flat ? ' / <b class="flat">' + flat + '</b>' : '') + '</span>' +
                '<span class="gm-summary-sub">平均 ' + pctText(avg) + '</span>' +
            '</div>' +
            '<div class="gm-summary-item">' +
                '<span class="gm-summary-k">领涨</span>' +
                '<span class="gm-summary-v">' + esc(leader.name) + '</span>' +
                '<span class="gm-summary-sub ' + pctClass(leader.changePct) + '">' + pctText(leader.changePct) + ' · ' + esc(leader.city) + '</span>' +
            '</div>' +
            '<div class="gm-summary-item">' +
                '<span class="gm-summary-k">领跌</span>' +
                '<span class="gm-summary-v">' + esc(laggard.name) + '</span>' +
                '<span class="gm-summary-sub ' + pctClass(laggard.changePct) + '">' + pctText(laggard.changePct) + ' · ' + esc(laggard.city) + '</span>' +
            '</div>' +
            '<div class="gm-summary-item">' +
                '<span class="gm-summary-k">快照</span>' +
                '<span class="gm-summary-v">' + esc(String(data.asOf || data.updated).slice(0, 10)) + '</span>' +
                '<span class="gm-summary-sub">' + markets.length + ' 个指数 · ' + new Set(markets.map(function(m) { return m.cityId; })).size + ' 个金融中心</span>' +
            '</div>';

        els.summary.innerHTML = html;

        var meta = byId('tabMetaGlobal');
        if (meta) {
            meta.textContent = markets.length + ' 指数 · 涨 ' + up + ' 跌 ' + down;
        }
    }

    function rowHTML(m, rank, maxAbs) {
        var width = maxAbs > 0 ? Math.max(4, Math.abs(m.changePct) / maxAbs * 100) : 0;
        var color = pctColor(m.changePct);
        return '<button type="button" class="gm-row" data-id="' + esc(m.id) + '"' +
            ' style="--bar:' + width.toFixed(1) + '%;--bar-color:' + color + '">' +
            '<span class="gm-rank">' + String(rank).padStart(2, '0') + '</span>' +
            '<span class="gm-name">' +
                '<span class="gm-name-cn">' + esc(m.name) + '</span>' +
                '<span class="gm-name-place">' + esc(m.city) + ' · ' + esc(m.country) + '</span>' +
            '</span>' +
            '<span class="gm-close">' + fmtNum(m.close) + '</span>' +
            '<span class="gm-pct ' + pctClass(m.changePct) + '">' + pctText(m.changePct) + '</span>' +
        '</button>';
    }

    function renderList(data) {
        var sorted = sortedMarkets();
        var maxAbs = sorted.reduce(function(max, m) {
            return Math.max(max, Math.abs(m.changePct));
        }, 0);
        els.list.innerHTML = sorted.map(function(m, i) {
            return rowHTML(m, i + 1, maxAbs);
        }).join('');

        els.list.querySelectorAll('.gm-row').forEach(function(row) {
            row.addEventListener('click', function() {
                selectMarket(row.getAttribute('data-id'), { scrollList: false });
            });
        });
    }

    function findMarket(id) {
        return state.data.markets.filter(function(m) { return m.id === id; })[0] || null;
    }

    function renderDetail(market) {
        if (!els.detail) return;
        if (!market) {
            els.detail.innerHTML = '<span class="gm-detail-empty">点击地图节点或右侧榜单，读取单个指数详情。</span>';
            return;
        }
        els.detail.innerHTML = '' +
            '<div class="gm-detail-head">' +
                '<span class="gm-detail-name">' + esc(market.name) + '</span>' +
                '<span class="gm-detail-place">' + esc(market.city) + ' · ' + esc(market.country) + ' · ' + esc(market.region) + '</span>' +
            '</div>' +
            '<div class="gm-detail-quote">' +
                '<span>' + fmtNum(market.close) + '</span>' +
                '<span class="gm-detail-change ' + pctClass(market.changePct) + '">' +
                    (market.change > 0 ? '+' : '') + fmtNum(market.change) + ' · ' + pctText(market.changePct) +
                '</span>' +
            '</div>' +
            '<div class="gm-detail-time">数据时间 ' + esc(utcTime(market.asOf)) + ' · ' + esc(state.data.source || '公开行情') + '</div>';
    }

    function highlightMarker(market) {
        if (!state.map || !els.map || !market) return;
        var markers = state.map._markers || {};
        Object.keys(markers).forEach(function(key) {
            var element = markers[key] && markers[key].element;
            if (!element || typeof element.select !== 'function') return;
            var on = Number(key) === market.markerIndex;
            if (!!element.isSelected !== on) element.select(on);
        });
        var circles = els.map.querySelectorAll('#jvm-markers-group circle[data-index]');
        Array.prototype.forEach.call(circles, function(circle) {
            circle.classList.toggle('is-active',
                Number(circle.getAttribute('data-index')) === market.markerIndex);
        });
    }

    function selectMarket(id, options) {
        options = options || {};
        var market = findMarket(id);
        if (!market) return;
        state.selectedId = id;

        if (els.list) {
            els.list.querySelectorAll('.gm-row').forEach(function(row) {
                var on = row.getAttribute('data-id') === id;
                row.classList.toggle('is-active', on);
                if (on && options.scrollList) {
                    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        }
        renderDetail(market);
        highlightMarker(market);
    }

    function mapTooltipHTML(market) {
        return '<div class="gm-tip-name">' + esc(market.name) + '</div>' +
            '<div class="gm-tip-row"><span>' + fmtNum(market.close) + '</span>' +
                '<span class="' + pctClass(market.changePct) + '">' + pctText(market.changePct) + '</span></div>' +
            '<div class="gm-tip-city">' + esc(market.city) + ' · ' + esc(market.country) + '</div>';
    }

    function spreadMarkers(markets) {
        var groups = {};
        markets.forEach(function(m) {
            var key = Number(m.lat).toFixed(3) + ',' + Number(m.lng).toFixed(3);
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        });
        Object.keys(groups).forEach(function(key) {
            var group = groups[key];
            group.forEach(function(m, i) {
                if (group.length === 1) {
                    m.mapLat = m.lat;
                    m.mapLng = m.lng;
                    return;
                }
                var angle = (Math.PI * 2 * i) / group.length - Math.PI / 2;
                var radius = 0.55;
                m.mapLat = m.lat + Math.sin(angle) * radius;
                m.mapLng = m.lng + Math.cos(angle) * radius * 1.25;
            });
        });
    }

    function createMap() {
        var mapEl = els.map;
        if (!mapEl) return;
        if (!mapEl.offsetWidth || !mapEl.offsetHeight) {
            window.setTimeout(createMap, 150);
            return;
        }
        var markets = state.data.markets;
        spreadMarkers(markets);

        mapEl.querySelectorAll('.gm-map-loading').forEach(function(node) { node.remove(); });
        if (state.map) return;

        state.map = new window.jsVectorMap({
            selector: '#gmMap',
            map: 'world',
            backgroundColor: 'transparent',
            zoomButtons: false,
            zoomOnScroll: false,
            zoomMax: 3,
            draggable: true,
            bindTouchEvents: true,
            showTooltip: true,
            regionStyle: {
                initial: {
                    fill: '#171129',
                    fillOpacity: 1,
                    stroke: '#4b3a70',
                    strokeWidth: 0.45,
                    strokeOpacity: 0.55
                },
                hover: {
                    fill: '#241a44',
                    fillOpacity: 1,
                    cursor: 'grab'
                }
            },
            markerStyle: {
                initial: {
                    r: 5,
                    fill: '#9b59ff',
                    fillOpacity: 1,
                    stroke: '#9b59ff',
                    strokeWidth: 5,
                    strokeOpacity: 0.18
                },
                hover: {
                    fill: '#d4c8ef',
                    stroke: '#00e5ff',
                    strokeWidth: 6,
                    strokeOpacity: 0.35,
                    cursor: 'pointer'
                },
                selected: {
                    stroke: '#00e5ff',
                    strokeWidth: 8,
                    strokeOpacity: 0.5
                },
                selectedHover: {
                    fill: '#d4c8ef',
                    stroke: '#00e5ff',
                    strokeWidth: 9,
                    strokeOpacity: 0.6
                }
            },
            markers: markets.map(function(m) {
                var color = pctColor(m.changePct);
                var radius = Math.min(8.5, 4.2 + Math.abs(m.changePct) * 1.7);
                return {
                    name: m.name,
                    coords: [m.mapLat, m.mapLng],
                    style: {
                        initial: {
                            r: radius,
                            fill: color,
                            stroke: color,
                            strokeWidth: 5,
                            strokeOpacity: 0.18
                        },
                        selected: {
                            stroke: '#00e5ff',
                            strokeWidth: 8,
                            strokeOpacity: 0.5
                        },
                        selectedHover: {
                            fill: '#d4c8ef',
                            stroke: '#00e5ff',
                            strokeWidth: 9,
                            strokeOpacity: 0.6
                        }
                    }
                };
            }),
            onMarkerTooltipShow: function(event, tooltip, index) {
                var market = markets[index];
                if (market) tooltip.text(mapTooltipHTML(market), true);
            },
            onMarkerClick: function(event, index) {
                var market = markets[index];
                if (market) selectMarket(market.id, { scrollList: true });
            }
        });

        var leader = sortedMarkets()[0];
        if (leader) selectMarket(leader.id);
    }

    function ensureLoaded() {
        if (state.loaded || state.loading) return;
        state.loading = true;

        els.summary = byId('gmSummary');
        els.list = byId('gmList');
        els.map = byId('gmMap');
        els.detail = byId('gmDetail');
        els.note = byId('gmNote');

        if (els.map) {
            els.map.innerHTML = '<div class="gm-map-loading">正在载入地图与节点…</div>';
        }

        window.PortfolioWorkspace.fetchJSON(DATA_URL)
            .then(function(data) {
                state.data = data;
                state.loaded = true;
                data.markets.forEach(function(m, i) { m.markerIndex = i; });

                renderSummary(data);
                renderList(data);
                setNote(data);

                loadMapLib()
                    .then(function() {
                        requestAnimationFrame(createMap);
                    })
                    .catch(function() {
                        if (els.map) {
                            els.map.innerHTML = '<div class="gm-map-loading">地图库加载失败，右侧榜单仍可查看。</div>';
                        }
                    });
            })
            .catch(function() {
                if (els.summary) {
                    els.summary.innerHTML =
                        '<div class="gm-summary-item" style="grid-column:1/-1">' +
                            '<span class="gm-summary-k">SIGNAL LOST</span>' +
                            '<span class="gm-summary-v down">全球行情读取失败</span>' +
                            '<span class="gm-summary-sub">页面其余面板不受影响，请稍后刷新。</span>' +
                        '</div>';
                }
                if (els.list) els.list.innerHTML = '<div class="gm-loading">暂无数据。</div>';
                if (els.map) els.map.innerHTML = '<div class="gm-map-loading">地图不可用。</div>';
            })
            .finally(function() {
                state.loading = false;
            });
    }

    function resizeMap() {
        if (!state.map || !els.map || typeof state.map.updateSize !== 'function') return;
        if (!els.map.offsetWidth || !els.map.offsetHeight) return;
        try { state.map.updateSize(); } catch (e) { /* ignore */ }
    }

    function init() {
        document.addEventListener('portfolio:tabchange', function(e) {
            if (!e.detail || e.detail.id !== 'global') return;
            ensureLoaded();
            if (state.map) window.setTimeout(resizeMap, 60);
        });
        document.addEventListener('portfolio:focuschange', function() {
            window.setTimeout(resizeMap, 380);
        });
        window.addEventListener('resize', function() {
            window.setTimeout(resizeMap, 160);
        });

        if (window.PortfolioWorkspace && window.PortfolioWorkspace.getActive() === 'global') {
            ensureLoaded();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
