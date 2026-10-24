/* ============================================
   Jillax.github.io — Index Page
   ============================================ */

(function() {
    // ---- Last Update ----
    fetch('https://api.github.com/repos/Jillax/Jillax.github.io/commits?per_page=1')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data[0] && data[0].commit) {
                var date = new Date(data[0].commit.committer.date);
                var y = date.getFullYear();
                var m = String(date.getMonth() + 1).padStart(2, '0');
                var d = String(date.getDate()).padStart(2, '0');
                var h = String(date.getHours()).padStart(2, '0');
                var min = String(date.getMinutes()).padStart(2, '0');
                var el = document.getElementById('lastUpdate');
                if (el) el.textContent = y + '-' + m + '-' + d + ' ' + h + ':' + min;
            } else {
                var el2 = document.getElementById('lastUpdate');
                if (el2) el2.textContent = '—';
            }
        })
        .catch(function() {
            var el3 = document.getElementById('lastUpdate');
            if (el3) el3.textContent = '—';
        });

    // ---- Jill Dialog Typewriter ----
    document.addEventListener('DOMContentLoaded', function() {
        var dialogText = document.getElementById('jillDialogText');
        var dialogEl = document.getElementById('jillDialog');
        var dialogQuotes = [];
        var dialogIndex = -1;
        var cycleId = 0;
        var cycleTimer = null;

        function getDialogQuotes() {
            dialogQuotes = [];
            fetch('data/quotes.json')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    dialogQuotes = data;
                    shuffleQuotes();
                    runDialogCycle();
                })
                .catch(function() {
                    dialogQuotes = [
                        { text: '好好活着为了享受书影音和游戏。' },
                        { text: '对混沌和未来保持谦虚。' },
                        { text: '混合饮料与混合思想。' },
                        { text: '在没有黑暗的地方相遇。' }
                    ];
                    shuffleQuotes();
                    runDialogCycle();
                });
        }

        function shuffleQuotes() {
            for (var i = dialogQuotes.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = dialogQuotes[i];
                dialogQuotes[i] = dialogQuotes[j];
                dialogQuotes[j] = tmp;
            }
        }

        function getNextDialogQuote() {
            dialogIndex++;
            if (dialogIndex >= dialogQuotes.length) {
                shuffleQuotes();
                dialogIndex = 0;
            }
            return dialogQuotes[dialogIndex].text;
        }

        function typeWriter(text, charIndex, callback) {
            if (!dialogText) return;
            if (charIndex < text.length) {
                dialogText.textContent = text.substring(0, charIndex + 1);
                setTimeout(function() {
                    typeWriter(text, charIndex + 1, callback);
                }, 45 + Math.random() * 35);
            } else {
                if (callback) callback();
            }
        }

        function runDialogCycle() {
            if (!dialogText || !dialogEl) return;
            cycleId++;
            var myId = cycleId;
            if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
            var text = getNextDialogQuote();
            dialogText.textContent = '';
            typeWriter(text, 0, function() {
                if (myId !== cycleId) return;
                cycleTimer = setTimeout(function() {
                    if (myId !== cycleId) return;
                    if (dialogEl) dialogEl.style.transition = 'opacity 0.5s ease';
                    if (dialogEl) dialogEl.style.opacity = '0.3';
                    cycleTimer = setTimeout(function() {
                        if (myId !== cycleId) return;
                        if (dialogText) dialogText.textContent = '';
                        if (dialogEl) dialogEl.style.opacity = '1';
                        runDialogCycle();
                    }, 600);
                }, 6000);
            });
        }

        // Refresh button
        var refreshBtn = document.getElementById('jillDialogRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                if (!dialogQuotes.length) return;
                if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
                cycleId++;
                dialogText.textContent = '';
                dialogEl.style.opacity = '1';
                runDialogCycle();
            });
        }

        // Start dialog after initial animation delay
        getDialogQuotes();
        setTimeout(function() {}, 2500);

        loadHomeStage();
    });

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[ch];
        });
    }

    function featuredCard(item) {
        var tags = (item.tags || []).map(function(tag) {
            return '<span class="project-card-tag">' + esc(tag) + '</span>';
        }).join('');
        var kicker = item.group ? '<div class="project-card-kicker">' + esc(item.group) + '</div>' : '';
        var tagRow = tags ? '<div class="project-card-tags">' + tags + '</div>' : '';
        return '<a class="project-card" href="' + esc(item.href) + '">' +
            kicker +
            '<div class="project-card-name">' + esc(item.title) + '</div>' +
            '<div class="project-card-desc">' + esc(item.blurb) + '</div>' +
            tagRow +
            '</a>';
    }

    function loadFeatured() {
        var slot = document.getElementById('featuredProjects');
        if (!slot) return;
        fetch('data/projects.json')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var items = ((data && data.items) || []).filter(function(item) {
                    return item && item.featured && item.href && item.title;
                });
                if (!items.length) {
                    slot.innerHTML = '<p class="home-loading">作品页里还没有标成首页展示的条目。<a href="projects.html">去作品</a></p>';
                    return;
                }
                slot.innerHTML = items.map(featuredCard).join('');
            })
            .catch(function() {
                slot.innerHTML = '<p class="home-loading">作品没有加载出来。<a href="projects.html">去作品</a></p>';
            });
    }

    function loadRecentVideos() {
        var list = document.getElementById('recentList');
        if (!list) return;

        fetch('data/translations.json')
            .then(function(response) { return response.json(); })
            .then(function(data) {
                var items = ((data && data.items) || []).filter(function(item) {
                    return item && item.title && item.date && item.bvid;
                }).sort(function(a, b) {
                    return String(b.date).localeCompare(String(a.date));
                }).slice(0, 3);

                if (!items.length) {
                    list.innerHTML = '<p class="home-loading">译制列表里还没有可显示的条目。<a href="translations.html">去看译制</a></p>';
                    return;
                }

                list.innerHTML = items.map(function(item) {
                    return '<a class="home-recent-item" href="translations.html?bvid=' + encodeURIComponent(item.bvid) + '">' +
                        '<span class="home-recent-kind">译制</span>' +
                        '<span class="home-recent-title">' + esc(item.title) + '</span>' +
                        '<span class="home-recent-date">' + esc(item.date) + '</span>' +
                        '</a>';
                }).join('');
            })
            .catch(function() {
                list.innerHTML = '<p class="home-loading">最近译制没有加载出来。<a href="translations.html">去看译制</a></p>';
            });
    }

    function loadHomeStage() {
        loadFeatured();
        loadRecentVideos();
    }
})();
