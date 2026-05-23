/* ============================================
   Jillax.github.io — Blog Page SPA
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    var pinsSection = document.getElementById('pinsSection');
    var feed = document.getElementById('feed');
    var pinsEmpty = document.getElementById('pinsEmpty');
    var articlesSection = document.getElementById('articlesSection');
    var articleList = document.getElementById('articleList');
    var articlesEmpty = document.getElementById('articlesEmpty');
    var tabs = document.querySelectorAll('.blog-tab');
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var pinCount = document.getElementById('pinCount');
    var articleCount = document.getElementById('articleCount');
    var thesisCount = document.getElementById('thesisCount');
    var blogSearch = document.getElementById('blogSearch');
    var thesisSection = document.getElementById('thesisSection');
    var thesisList = document.getElementById('thesisList');
    var thesisEmpty = document.getElementById('thesisEmpty');
    var thesisArticleView = document.getElementById('thesisArticleView');
    var thesisArticleTitle = document.getElementById('thesisArticleTitle');
    var thesisArticleMeta = document.getElementById('thesisArticleMeta');
    var thesisArticleContent = document.getElementById('thesisArticleContent');
    var thesisArticleBack = document.getElementById('thesisArticleBack');
    var excerptsSection = document.getElementById('excerptsSection');
    var excerptList = document.getElementById('excerptList');
    var excerptsEmpty = document.getElementById('excerptsEmpty');
    var excerptCount = document.getElementById('excerptCount');
    var excerptArticleView = document.getElementById('excerptArticleView');
    var excerptArticleTitle = document.getElementById('excerptArticleTitle');
    var excerptArticleMeta = document.getElementById('excerptArticleMeta');
    var excerptArticleContent = document.getElementById('excerptArticleContent');
    var excerptArticleBack = document.getElementById('excerptArticleBack');
    var excerptSourceBadge = document.getElementById('excerptSourceBadge');
    var searchQuery = '';
    var allDataRaw = null;
    var thesisPosts = [];
    var excerpts = [];
    var currentTab = 'pins';

    function fmtNum(n) {
        if (!n && n !== 0) return '—';
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        return String(n);
    }

    function fmtDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }

    function fmtTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        var now = new Date();
        var diff = now - d;
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days < 1) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return days + '天前';
        if (days < 30) return Math.floor(days / 7) + '周前';
        return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Reading Progress
    var readingActive = false;
    function trackReadingProgress(active) {
        readingActive = active;
        var bar = document.getElementById('readingProgress');
        if (!active) { bar.style.width = '0'; return; }
        setTimeout(function() {
            var articleEl = document.getElementById('thesisArticleContent') || document.getElementById('excerptArticleContent');
            if (!articleEl) return;
            var rect = articleEl.getBoundingClientRect();
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var articleTop = rect.top + scrollTop;
            var articleHeight = articleEl.scrollHeight;
            var winHeight = window.innerHeight;
            var totalScrollable = articleHeight - winHeight + Math.max(articleTop - 80, 0);
            if (totalScrollable <= 0) { bar.style.width = '100%'; return; }
            function updateBar() {
                if (!readingActive) return;
                var st = window.pageYOffset || document.documentElement.scrollTop;
                var progress = Math.min(Math.max((st - articleTop + 80) / totalScrollable, 0), 1);
                bar.style.width = (progress * 100) + '%';
                requestAnimationFrame(updateBar);
            }
            updateBar();
        }, 100);
    }

    // Tab Switching
    function switchTab(tab) {
        currentTab = tab;
        tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tab); });
        pinsSection.style.display = tab === 'pins' ? '' : 'none';
        articlesSection.style.display = tab === 'articles' ? '' : 'none';
        thesisSection.style.display = tab === 'thesis' ? '' : 'none';
        excerptsSection.style.display = tab === 'excerpts' ? '' : 'none';
        // Hide zhihu article viewer when switching tabs
        var zhView = document.getElementById('zhArticleView');
        if (zhView) zhView.style.display = 'none';
        history.pushState(null, '', 'blog.html' + (tab !== 'pins' ? '#' + tab : ''));
    }

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Search
    if (blogSearch) {
        blogSearch.addEventListener('input', function() {
            searchQuery = this.value.trim().toLowerCase();
            var activeTab = document.querySelector('.blog-tab.active');
            var tab = activeTab ? activeTab.dataset.tab : 'pins';
            if (tab === 'pins') renderPins(allDataRaw);
            else if (tab === 'articles') renderArticles(allDataRaw);
            else if (tab === 'thesis') renderThesisList();
            else if (tab === 'excerpts') renderExcerptList();
        });
    }

    // Pins
    function renderPins(data) {
        if (!data) return;
        var pins = data.pins || [];
        if (searchQuery) {
            pins = pins.filter(function(p) { return (p.content || '').toLowerCase().includes(searchQuery); });
        }
        pinCount.textContent = pins.length || '';

        if (pins.length === 0) {
            feed.innerHTML = '';
            pinsEmpty.style.display = 'block';
            return;
        }
        pinsEmpty.style.display = 'none';

        var name = data.profile && data.profile.name ? data.profile.name : 'Jillax';
        feed.innerHTML = pins.map(function(pin) {
            var timeStr = fmtDate(pin.created);
            var content = (pin.content || '').replace(/\n/g, '<br>');
            var hasImages = pin.images && pin.images.length > 0;
            var isBlocked = pin.blocked;

            return '<div class="pin-card ' + (isBlocked ? 'pin-blocked' : '') + '">' +
                '<div class="pin-header">' +
                '<div class="pin-avatar">J</div>' +
                '<span class="pin-author">' + name + '</span>' +
                '<span class="pin-time">' + timeStr + '</span>' +
                (isBlocked ? '<span class="pin-blocked-badge">已屏蔽</span>' : '') +
                '</div>' +
                '<div class="pin-content ' + (isBlocked ? 'pin-content-dimmed' : '') + '">' + content + '</div>' +
                (hasImages ? '<div class="pin-images">' +
                    pin.images.map(function(img) {
                        return '<img src="' + img + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
                            'onclick="document.getElementById(\'lightboxImg\').src=this.src;document.getElementById(\'lightbox\').classList.add(\'active\');document.body.style.overflow=\'hidden\'">';
                    }).join('') +
                '</div>' : '') +
                '<div class="pin-footer">' +
                '<span class="pin-stat">👍 <span class="num">' + fmtNum(pin.likes) + '</span></span>' +
                '<span class="pin-stat">💬 <span class="num">' + fmtNum(pin.comments) + '</span></span>' +
                '</div></div>';
        }).join('');
    }

    // Articles
    function renderArticles(data) {
        if (!data) return;
        window.__zhArticleData = data.articles || [];
        var articles = data.articles || [];
        if (searchQuery) {
            articles = articles.filter(function(a) {
                var title = (a.title || '').toLowerCase();
                var summary = (a.summary || '').toLowerCase();
                return title.includes(searchQuery) || summary.includes(searchQuery);
            });
        }
        articleCount.textContent = articles.length || '';

        if (articles.length === 0) {
            articleList.innerHTML = '';
            articlesEmpty.style.display = 'block';
            return;
        }
        articlesEmpty.style.display = 'none';

        articleList.innerHTML = articles.map(function(a) {
            var timeStr = fmtTime(a.created);
            return '<div class="article-card" onclick="openZhArticle(\'' + a.url + '\')">' +
                '<div class="article-card-title"><a href="' + a.url + '" target="_blank" rel="noopener">' + a.title + '</a></div>' +
                '<div class="article-card-meta"><span>' + timeStr + '</span></div>' +
                (a.summary ? '<div class="article-card-summary">' + a.summary + '</div>' : '') +
                '<div class="article-card-stats">' +
                '<span>👍 ' + fmtNum(a.likes) + '</span>' +
                '<span>💬 ' + fmtNum(a.comments) + '</span>' +
                '</div></div>';
        }).join('');
    }

    // Thesis
    function renderThesisList() {
        var filtered = thesisPosts;
        if (searchQuery) {
            filtered = thesisPosts.filter(function(p) {
                var title = (p.title || '').toLowerCase();
                var tags = (p.tags || []).join(' ').toLowerCase();
                return title.includes(searchQuery) || tags.includes(searchQuery);
            });
        }
        if (filtered.length === 0) {
            thesisList.innerHTML = '';
            thesisEmpty.style.display = 'block';
            thesisCount.textContent = '';
            return;
        }
        thesisEmpty.style.display = 'none';
        thesisCount.textContent = filtered.length || '';
        thesisList.innerHTML = filtered.map(function(p) {
            return '<div class="post-item" data-id="' + p.id + '">' +
                '<div class="post-title">' + p.title + '</div>' +
                '<div class="post-meta"><span>' + p.date + '</span>' +
                (p.tags ? p.tags.map(function(t) { return '<span class="post-tag">' + t + '</span>'; }).join('') : '') +
                '</div>' +
                '<div class="post-summary">' + p.summary + '</div></div>';
        }).join('');

        thesisList.querySelectorAll('.post-item').forEach(function(el) {
            el.addEventListener('click', function() { showThesisArticle(el.dataset.id); });
        });
    }

    function showThesisList() {
        thesisList.style.display = '';
        thesisArticleView.classList.remove('active');
        trackReadingProgress(false);
    }

    function showThesisArticle(postId) {
        var post = thesisPosts.find(function(p) { return p.id === postId; });
        if (!post) { showThesisList(); return; }

        switchTab('thesis');
        thesisList.style.display = 'none';
        thesisArticleView.classList.add('active');
        thesisArticleTitle.textContent = post.title;
        thesisArticleMeta.textContent = post.date + (post.tags ? '  ·  ' + post.tags.join(' · ') : '');
        thesisArticleContent.innerHTML = '<p style="color:var(--text-faint)">加载中...</p>';

        trackReadingProgress(true);

        fetch(post.file)
            .then(function(r) {
                if (!r.ok) throw new Error('Not found');
                return r.text();
            })
            .then(function(md) {
                thesisArticleContent.innerHTML = marked.parse(md);
            })
            .catch(function() {
                thesisArticleContent.innerHTML = '<p style="color:var(--text-muted)">加载失败</p>';
            });
    }

    // Excerpts
    function renderExcerptList() {
        var filtered = excerpts;
        if (searchQuery) {
            filtered = excerpts.filter(function(p) {
                var title = (p.title || '').toLowerCase();
                var tags = (p.tags || []).join(' ').toLowerCase();
                var summary = (p.summary || '').toLowerCase();
                return title.includes(searchQuery) || tags.includes(searchQuery) || summary.includes(searchQuery);
            });
        }
        if (filtered.length === 0) {
            excerptList.innerHTML = '';
            excerptsEmpty.style.display = 'block';
            excerptCount.textContent = '';
            return;
        }
        excerptsEmpty.style.display = 'none';
        excerptCount.textContent = filtered.length || '';
        excerptList.innerHTML = filtered.map(function(p) {
            return '<div class="post-item" data-id="' + p.id + '">' +
                '<div class="post-title">' + p.title + '</div>' +
                '<div class="post-meta"><span>' + p.date + '</span>' +
                (p.tags ? p.tags.map(function(t) { return '<span class="post-tag">' + t + '</span>'; }).join('') : '') +
                '</div>' +
                '<div class="post-summary">' + p.summary + '</div></div>';
        }).join('');

        excerptList.querySelectorAll('.post-item').forEach(function(el) {
            el.addEventListener('click', function() { showExcerptArticle(el.dataset.id); });
        });
    }

    function showExcerptList() {
        excerptList.style.display = '';
        excerptArticleView.classList.remove('active');
        trackReadingProgress(false);
    }

    function showExcerptArticle(postId) {
        var post = excerpts.find(function(p) { return p.id === postId; });
        if (!post) { showExcerptList(); return; }

        switchTab('excerpts');
        excerptList.style.display = 'none';
        excerptArticleView.classList.add('active');
        excerptArticleTitle.textContent = post.title;
        excerptArticleMeta.textContent = post.date;
        excerptSourceBadge.textContent = post.source ? '✎ 摘自 ' + post.source : '';
        excerptArticleContent.innerHTML = '<p style="color:var(--text-faint)">加载中...</p>';

        trackReadingProgress(true);

        fetch(post.file)
            .then(function(r) {
                if (!r.ok) throw new Error('Not found');
                return r.text();
            })
            .then(function(md) {
                excerptArticleContent.innerHTML = marked.parse(md);
            })
            .catch(function() {
                excerptArticleContent.innerHTML = '<p style="color:var(--text-muted)">加载失败</p>';
            });
    }

    // Zhihu Article Viewer
    window.openZhArticle = function(url) {
        var arts = window.__zhArticleData || [];
        var a = arts.find(function(x) { return x.url === url; });
        if (!a || !a.body_html) { window.open(url, '_blank'); return; }
        document.getElementById('articlesSection').style.display = 'none';
        document.getElementById('zhArticleView').style.display = '';
        document.getElementById('zhArtTitle').textContent = a.title;
        document.getElementById('zhArtMeta').innerHTML = fmtTime(a.created) + ' · 👍 ' + fmtNum(a.likes) + ' · 💬 ' + fmtNum(a.comments);
        document.getElementById('zhArtBody').innerHTML = a.body_html;
    };

    document.getElementById('zhArtBack').addEventListener('click', function() {
        document.getElementById('zhArticleView').style.display = 'none';
        document.getElementById('articlesSection').style.display = '';
    });

    // Load Data
    fetch('thesis/index.json')
        .then(function(r) {
            if (!r.ok) throw new Error('Not found');
            return r.json();
        })
        .then(function(data) {
            thesisPosts = data;
            renderThesisList();

            var hash = window.location.hash.slice(1);
            if (hash) {
                var found = thesisPosts.find(function(p) { return p.id === hash; });
                if (found) showThesisArticle(hash);
            }
        })
        .catch(function() {
            thesisList.innerHTML = '';
            thesisEmpty.style.display = 'block';
            thesisCount.textContent = '';
        });

    fetch('data/excerpts.json')
        .then(function(r) {
            if (!r.ok) throw new Error('Not found');
            return r.json();
        })
        .then(function(data) {
            excerpts = data;
            renderExcerptList();

            var hash = window.location.hash.slice(1);
            if (hash) {
                var found = excerpts.find(function(p) { return p.id === hash; });
                if (found) showExcerptArticle(hash);
            }
        })
        .catch(function() {
            excerptList.innerHTML = '';
            excerptsEmpty.style.display = 'block';
            excerptCount.textContent = '';
        });

    fetch('data/zhihu.json')
        .then(function(r) {
            if (!r.ok) throw new Error('Not found');
            return r.json();
        })
        .then(function(data) {
            allDataRaw = data;
            renderPins(data);
            renderArticles(data);
        })
        .catch(function() {
            feed.innerHTML = '';
            pinsEmpty.style.display = 'block';
            articleList.innerHTML = '';
            articlesEmpty.style.display = 'block';
        });

    // Initial tab from URL hash
    var initHash = window.location.hash.slice(1);
    if (initHash === 'pins' || initHash === 'articles' || initHash === 'thesis' || initHash === 'excerpts') {
        switchTab(initHash);
    } else {
        switchTab('pins');
    }

    // Back Buttons
    thesisArticleBack.addEventListener('click', showThesisList);
    excerptArticleBack.addEventListener('click', showExcerptList);

    // Lightbox
    document.getElementById('lightboxClose').addEventListener('click', function() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    });
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Browser Navigation
    window.addEventListener('popstate', function() {
        var hash = window.location.hash.slice(1);
        if (hash === 'pins' || hash === 'articles' || hash === 'thesis' || hash === 'excerpts') {
            switchTab(hash);
        } else if (hash) {
            var t = thesisPosts.find(function(p) { return p.id === hash; });
            if (t) showThesisArticle(hash);
            else {
                var e = excerpts.find(function(p) { return p.id === hash; });
                if (e) showExcerptArticle(hash);
            }
        } else {
            switchTab('pins');
        }
    });
});