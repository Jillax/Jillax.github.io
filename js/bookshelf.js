/* ============================================
   Jillax.github.io — Bookshelf Page SPA
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    var grid = document.getElementById('itemsGrid');
    var empty = document.getElementById('emptyState');
    var catTabs = document.querySelectorAll('.cat-tab');
    var updateTime = document.getElementById('updateTime');
    var statCards = document.getElementById('statCards');
    var ratingBars = document.getElementById('ratingBars');
    var filterTabs = document.querySelectorAll('.filter-tab');
    var filterCount = document.getElementById('filterCount');
    var cumulativeChartInstance = null;

    var allData = { books: [], movies: [], music: [], games: [] };
    var currentCat = 'books';
    var ratingFilter = 0;

    var statusLabels = {
        books: { collect: '读过', wish: '想读', do: '在读' },
        movies: { collect: '看过', wish: '想看', do: '在看' },
        music: { collect: '听过', wish: '想听', do: '在听' },
        games: { collect: '玩过', wish: '想玩', do: '在玩' }
    };

    function renderStars(rating) {
        if (!rating || rating === 0) return '';
        var stars = '';
        for (var i = 0; i < rating; i++) stars += '★';
        for (var j = rating; j < 5; j++) stars += '☆';
        return stars;
    }

    function getStatusText(cat, status) {
        var labels = statusLabels[cat] || statusLabels.books;
        return labels[status] || status;
    }

    function getCover(item) {
        // Prefer local cover if available
        if (item._localCover) return item._localCover;
        var url = item.cover;
        if (!url) return '';
        // Fall back to weserv proxy for douban images
        if (url.includes('doubanio.com') || url.includes('douban.com')) {
            return 'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&w=120&h=170&fit=cover';
        }
        return url;
    }

    function getCatLabel() {
        var map = { books: '本', movies: '部', music: '张', games: '款' };
        return map[currentCat] || '项';
    }

    function renderStats(cat) {
        var items = allData[cat] || [];
        var total = items.length;
        var rated = items.filter(function(i) { return i.rating > 0; });
        var avg = rated.length > 0
            ? (rated.reduce(function(s, i) { return s + i.rating; }, 0) / rated.length).toFixed(1)
            : '—';

        var thisYear = new Date().getFullYear();
        var thisYearCollect = items.filter(function(i) {
            return i.date && i.date.startsWith(String(thisYear)) && i.status === 'collect';
        });
        var thisYearCount = thisYearCollect.length;

        var lastYear = thisYear - 1;
        var lastYearCollect = items.filter(function(i) {
            return i.date && i.date.startsWith(String(lastYear)) && i.status === 'collect';
        });
        var lastYearCount = lastYearCollect.length;

        var unitMap = { books: '本', movies: '部', music: '张', games: '款' };
        var unit = unitMap[currentCat] || '项';

        statCards.innerHTML =
            '<div class="stat-card"><div class="num">' + total + '</div><div class="label">累计 ' + unit + '</div></div>' +
            '<div class="stat-card"><div class="num">' + avg + '</div><div class="label">平均评分</div></div>' +
            '<div class="stat-card"><div class="num">' + thisYearCount + '</div><div class="label">' + thisYear + ' 年</div></div>' +
            '<div class="stat-card"><div class="num">' + lastYearCount + '</div><div class="label">' + lastYear + ' 年</div></div>';
    }

    function renderRatingDist(cat) {
        var items = allData[cat] || [];
        var counts = {};
        var maxCount = 0;
        for (var r = 1; r <= 5; r++) {
            var c = items.filter(function(i) { return i.rating === r; }).length;
            counts[r] = c;
            if (c > maxCount) maxCount = c;
        }

        ratingBars.innerHTML = [5, 4, 3, 2, 1].map(function(r) {
            var pct = maxCount > 0 ? (counts[r] / maxCount * 100) : 0;
            return '<div class="rating-row">' +
                '<span class="rating-label">' + r + '★</span>' +
                '<div class="rating-track"><div class="rating-fill" style="width:0" data-width="' + pct + '"></div></div>' +
                '<span class="rating-count">' + counts[r] + '</span></div>';
        }).join('');

        requestAnimationFrame(function() {
            ratingBars.querySelectorAll('.rating-fill').forEach(function(el) {
                el.style.width = el.dataset.width + '%';
            });
        });
    }

    function getChartTheme() {
        var isLight = document.documentElement.hasAttribute('data-theme');
        return {
            grid: isLight ? 'rgba(44,40,36,0.06)' : 'rgba(255,255,255,0.06)',
            text: isLight ? '#8c7e6c' : '#8f8271',
            gold: '#c4a35a',
            fillTop: 'rgba(196,163,90,0.06)',
            fillBottom: 'rgba(196,163,90,0.005)'
        };
    }

    function renderCumulativeChart(cat) {
        if (cumulativeChartInstance) {
            cumulativeChartInstance.destroy();
            cumulativeChartInstance = null;
        }

        var items = allData[cat] || [];
        var collected = items.filter(function(i) {
            return i.date && i.status === 'collect';
        }).sort(function(a, b) {
            return a.date.localeCompare(b.date);
        });

        var canvas = document.getElementById('cumulativeChart');
        if (collected.length < 2) {
            canvas.style.display = 'none';
            return;
        }
        canvas.style.display = '';

        var monthly = {};
        collected.forEach(function(i) {
            var ym = i.date.substring(0, 7);
            monthly[ym] = (monthly[ym] || 0) + 1;
        });

        var sortedMonths = Object.keys(monthly).sort();
        var cum = 0;
        var labels = sortedMonths.map(function(m) {
            var d = new Date(m + '-01');
            return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
        });
        var data = sortedMonths.map(function(m) {
            cum += monthly[m];
            return cum;
        });

        var colors = getChartTheme();
        var ctx = canvas.getContext('2d');

        var gradient = ctx.createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, colors.fillTop);
        gradient.addColorStop(1, colors.fillBottom);

        cumulativeChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '累计',
                    data: data,
                    borderColor: colors.gold,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 10,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.text === '#8c7e6c' ? '#f0ebe2' : '#27231e',
                        titleColor: colors.text === '#8c7e6c' ? '#2b221a' : '#ddd3c4',
                        bodyColor: colors.text === '#8c7e6c' ? '#5c5142' : '#bfb29f',
                        borderColor: colors.text === '#8c7e6c' ? 'rgba(44,40,36,0.08)' : 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        cornerRadius: 0,
                        padding: 10,
                        callbacks: {
                            label: function(ctx) {
                                return ctx.parsed.y + ' 项';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: colors.text,
                            font: { size: 10, family: 'Spectral' },
                            maxRotation: 45,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        grid: { color: colors.grid },
                        beginAtZero: true,
                        ticks: {
                            color: colors.text,
                            font: { size: 10, family: 'Spectral' },
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function getFilteredItems(cat) {
        var items = allData[cat] || [];
        if (ratingFilter > 0) {
            items = items.filter(function(i) { return i.rating === ratingFilter; });
        }
        return items;
    }

    function renderItems(cat) {
        var items = getFilteredItems(cat);

        filterCount.textContent = items.length > 0 ? '显示 ' + items.length + ' 项' : '';

        if (items.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        grid.innerHTML = items.map(function(item) {
            var coverUrl = getCover(item);
            var hasCover = coverUrl && coverUrl.trim();
            var initial = item.title ? item.title.charAt(0) : '?';
            var statusText = getStatusText(cat, item.status);
            var stars = renderStars(item.rating);
            var dateStr = item.date ? item.date.substring(0, 7) : '';

            return '<div class="item-card">' +
                '<div class="item-cover">' +
                (hasCover
                    ? '<img src="' + coverUrl + '" alt="' + item.title + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML=\'<span class=placeholder>' + initial + '</span>\'">'
                    : '<span class="placeholder">' + initial + '</span>'
                ) +
                '</div>' +
                '<div class="item-info">' +
                '<div class="item-title" title="' + item.title.replace(/"/g, '&quot;') + '">' + item.title + '</div>' +
                '<div class="item-author" title="' + (item.author || '').replace(/"/g, '&quot;') + '">' + (item.author || '') + '</div>' +
                '<div class="item-meta">' +
                '<span class="item-status ' + item.status + '">' + statusText + '</span>' +
                (stars ? '<span class="item-rating">' + stars + '</span>' : '') +
                (dateStr ? '<span class="item-date">' + dateStr + '</span>' : '') +
                '</div>' +
                (item.comment ? '<div class="item-comment">' + item.comment + '</div>' : '') +
                '</div></div>';
        }).join('');
    }

    function switchCategory(cat) {
        currentCat = cat;
        ratingFilter = 0;

        filterTabs.forEach(function(t) { t.classList.remove('active'); });
        var zeroFilter = document.querySelector('.filter-tab[data-rating="0"]');
        if (zeroFilter) zeroFilter.classList.add('active');

        renderStats(cat);
        renderRatingDist(cat);
        renderCumulativeChart(cat);
        renderItems(cat);
    }

    // Init
    fetch('data/bookshelf.json')
        .then(function(r) {
            if (!r.ok) throw new Error('Not found');
            return r.json();
        })
        .then(function(data) {
            allData = data;

            document.getElementById('countBooks').textContent = (data.books || []).length;
            document.getElementById('countMovies').textContent = (data.movies || []).length;
            document.getElementById('countMusic').textContent = (data.music || []).length;
            document.getElementById('countGames').textContent = (data.games || []).length;

            if (data.updated) {
                var d = new Date(data.updated);
                updateTime.textContent = '数据同步于 ' + d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
            }

            switchCategory('books');
        })
        .catch(function() {
            grid.innerHTML = '<div class="empty-state">加载失败</div>';
            statCards.innerHTML = '';
            ratingBars.innerHTML = '';
        });

    // Events
    catTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            catTabs.forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            switchCategory(this.dataset.cat);
        });
    });

    filterTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            filterTabs.forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            ratingFilter = parseInt(this.dataset.rating);
            renderItems(currentCat);
        });
    });
});
