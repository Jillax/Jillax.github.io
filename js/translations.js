/* ============================================
   Jillax.github.io — Translations Page SPA
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    var list = document.getElementById('transList');
    var empty = document.getElementById('emptyState');
    var searchInput = document.getElementById('searchInput');
    var resultCount = document.getElementById('resultCount');

    var allItems = [];
    var currentTag = 'all';
    var currentSort = 'date';
    var searchQuery = '';
    var biliStatsCache = {};

    var statusCls = { '已完成': 'done', '译制中': 'ongoing' };

    function fmtNum(n) {
        if (!n && n !== 0) return '—';
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        return String(n);
    }

    function fmtPlay(n) {
        if (!n && n !== 0) return '';
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        return n + '';
    }

    async function fetchBiliStats(bvid) {
        if (biliStatsCache[bvid] !== undefined) return biliStatsCache[bvid];
        try {
            var res = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid);
            if (!res.ok) throw new Error('API error');
            var json = await res.json();
            if (json.code !== 0 || !json.data) throw new Error('API response error');
            var stat = json.data.stat;
            var result = {
                play: stat.view || 0,
                likes: stat.like || 0,
                favs: stat.favorite || 0,
                danmaku: stat.danmaku || 0
            };
            biliStatsCache[bvid] = result;
            return result;
        } catch (e) {
            biliStatsCache[bvid] = null;
            return null;
        }
    }

    async function enrichItems(items) {
        var enriched = {};
        var promises = [];

        items.forEach(function(item) {
            if (item.bvid && item.bvid.trim()) {
                var p = fetchBiliStats(item.bvid).then(function(stats) {
                    if (stats) enriched[item.bvid] = stats;
                });
                promises.push(p);
            }
        });

        if (promises.length > 0) {
            await Promise.all(promises);
        }
        return enriched;
    }

    function getItemStats(item, enriched) {
        var fromApi = item.bvid && enriched[item.bvid];
        if (fromApi) return enriched[item.bvid];
        return {
            play: item.play || 0,
            likes: item.likes || 0,
            favs: item.favs || 0,
            danmaku: item.danmaku || 0
        };
    }

    function animateNum(el, endVal) {
        var duration = 1000;
        var startTime = null;
        function step(ts) {
            if (!startTime) startTime = ts;
            var p = Math.min((ts - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(endVal * eased);
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = fmtNum(endVal);
        }
        requestAnimationFrame(step);
    }

    function renderStats(items) {
        var total = items.length;
        var published = items.filter(function(i) { return i.status === '已完成'; }).length;
        var totalPlays = items.filter(function(i) { return i.status === '已完成'; }).reduce(function(s, i) { return s + (i.play || 0); }, 0);
        var avgPlay = published > 0 ? Math.round(totalPlays / published) : 0;

        animateNum(document.getElementById('statTotal'), total);
        animateNum(document.getElementById('statPlays'), totalPlays);
        animateNum(document.getElementById('statAvg'), avgPlay);
        animateNum(document.getElementById('statPublished'), published);
    }

    function renderTags(items) {
        var tagCounts = {};
        items.forEach(function(item) {
            (item.tags || []).forEach(function(t) {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        });

        var tagBar = document.getElementById('tagBar');
        tagBar.querySelectorAll('.filter-tab.tag:not([data-tag="all"])').forEach(function(el) { el.remove(); });

        var allTagBtn = tagBar.querySelector('.filter-tab.tag[data-tag="all"]');
        if (allTagBtn) {
            var newBtn = allTagBtn.cloneNode(true);
            allTagBtn.parentNode.replaceChild(newBtn, allTagBtn);
            if (currentTag === 'all') {
                newBtn.classList.add('active');
            } else {
                newBtn.classList.remove('active');
            }
            newBtn.addEventListener('click', function() {
                document.querySelectorAll('#tagBar .filter-tab.tag').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                currentTag = 'all';
                applyFilters();
            });
        }

        var sortedTags = Object.keys(tagCounts).sort(function(a, b) { return tagCounts[b] - tagCounts[a]; });
        sortedTags.forEach(function(tag) {
            var btn = document.createElement('button');
            btn.className = 'filter-tab tag' + (currentTag === tag ? ' active' : '');
            btn.dataset.tag = tag;
            btn.textContent = '# ' + tag + ' ' + tagCounts[tag];
            btn.addEventListener('click', function() {
                document.querySelectorAll('#tagBar .filter-tab.tag').forEach(function(t) { t.classList.remove('active'); });
                this.classList.add('active');
                currentTag = this.dataset.tag;
                applyFilters();
            });
            tagBar.appendChild(btn);
        });
    }

    function getFilteredItems() {
        var items = allItems.slice();

        if (currentTag !== 'all') {
            items = items.filter(function(i) { return i.tags && i.tags.includes(currentTag); });
        }

        if (searchQuery.trim()) {
            var q = searchQuery.trim().toLowerCase();
            items = items.filter(function(i) {
                return (i.title && i.title.toLowerCase().includes(q)) ||
                    (i.description && i.description.toLowerCase().includes(q)) ||
                    (i.originalTitle && i.originalTitle.toLowerCase().includes(q));
            });
        }

        if (currentSort === 'plays') {
            items.sort(function(a, b) { return (b.play || 0) - (a.play || 0); });
        } else {
            items.sort(function(a, b) {
                if (a.date && b.date) return b.date.localeCompare(a.date);
                if (a.date) return -1;
                if (b.date) return 1;
                return 0;
            });
        }

        return items;
    }

    function renderItems(items, enriched) {
        if (items.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
            resultCount.textContent = '';
            return;
        }
        empty.style.display = 'none';
        resultCount.textContent = '共 ' + items.length + ' 个作品';

        list.innerHTML = items.map(function(item) {
            var sClass = statusCls[item.status] || '';
            var hasBili = item.bvid && item.bvid.trim();
            var hasCover = item.cover && item.cover.trim();
            var initial = item.title ? item.title.charAt(0) : '?';
            var stats = getItemStats(item, enriched);
            var dateStr = item.date ? item.date.substring(0, 7) : '';

            return '<div class="trans-card">' +
                '<div class="trans-cover">' +
                (hasCover
                    ? '<img src="' + item.cover + '" alt="' + item.title.replace(/"/g, '&quot;') + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML=\'<span class=placeholder>' + initial + '</span>\'">'
                    : '<span class="placeholder">' + initial + '</span>'
                ) +
                '</div>' +
                '<div class="trans-body">' +
                '<div class="trans-title">' + item.title + '</div>' +
                '<div class="trans-meta">' +
                '<span class="trans-status ' + sClass + '">' + item.status + '</span>' +
                (stats.play > 0 ? '<span class="trans-source">' + fmtPlay(stats.play) + ' 播放</span>' : '') +
                (dateStr ? '<span class="trans-date">' + dateStr + '</span>' : '') +
                '</div>' +
                (item.tags && item.tags.length > 0 ?
                    '<div class="trans-tags">' + item.tags.map(function(t) { return '<span class="trans-tag">#' + t + '</span>'; }).join('') + '</div>'
                    : '') +
                (stats.likes > 0 || stats.favs > 0 || stats.danmaku > 0 ?
                    '<div class="trans-stats">' +
                    (stats.likes > 0 ? '<span class="trans-stat">👍 <span class="num">' + fmtNum(stats.likes) + '</span></span>' : '') +
                    (stats.favs > 0 ? '<span class="trans-stat">⭐ <span class="num">' + fmtNum(stats.favs) + '</span></span>' : '') +
                    (stats.danmaku > 0 ? '<span class="trans-stat">💬 <span class="num">' + fmtNum(stats.danmaku) + '</span></span>' : '') +
                    '</div>'
                    : '') +
                (item.description ? '<div class="trans-desc">' + item.description + '</div>' : '') +
                '<div class="trans-links">' +
                (hasBili ? '<a href="https://www.bilibili.com/video/' + item.bvid + '" target="_blank" class="trans-link">▶ 在B站观看</a>' : '') +
                '</div>' +
                '</div></div>';
        }).join('');
    }

    function applyFilters() {
        var filtered = getFilteredItems();
        renderItems(filtered, biliStatsCache);
    }

    // Init
    fetch('data/translations.json')
        .then(function(r) { return r.json(); })
        .then(async function(data) {
            allItems = data.items || data;

            renderStats(allItems);
            renderTags(allItems);

            var enriched = await enrichItems(allItems);
            biliStatsCache = enriched;

            renderItems(getFilteredItems(), enriched);
        })
        .catch(function() {
            list.innerHTML = '<div class="empty-state">加载失败</div>';
        });

    // Events
    document.querySelectorAll('.sort-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentSort = this.dataset.sort;
            applyFilters();
        });
    });

    var searchTimer;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        var self = this;
        searchTimer = setTimeout(function() {
            searchQuery = self.value;
            applyFilters();
        }, 250);
    });
});
