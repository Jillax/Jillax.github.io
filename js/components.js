/* ============================================
   Jillax.github.io — Shared Components
   VA-11 Hall-A Cyberpunk Theme
   Injects nav, footer, and page transition overlay
   Must load BEFORE main.js
   ============================================ */

(function() {
    // Determine current page from body data attribute
    const page = document.body.getAttribute('data-page') || 'index';
    const isHome = page === 'index';
    const logoHref = isHome ? '#' : 'index.html';

    // Five channels. Portfolio lives on the works page.
    // Bookshelf + translations share 阅读与译制.
    // Blog is sparse, so contact sits on that same channel.
    const navItems = [
        { href: 'index.html',    label: '首页',       pages: ['index'] },
        { href: 'about.html',    label: '关于',       pages: ['about'] },
        { href: 'timeline.html', label: '编年',       pages: ['timeline'] },
        { href: 'projects.html', label: '作品',       pages: ['projects', 'portfolio', 'rights'] },
        { href: 'reading.html',  label: '阅读与译制', pages: ['reading', 'bookshelf', 'translations'] },
        { href: 'blog.html',     label: '随笔 / 联系', pages: ['blog', 'contact'] },
    ];

    const channelBars = {
        reading: [
            { href: 'reading.html',      page: 'reading',      label: '总览' },
            { href: 'bookshelf.html',    page: 'bookshelf',    label: '书影音' },
            { href: 'translations.html', page: 'translations', label: '译制' },
        ],
        notes: [
            { href: 'blog.html',    page: 'blog',    label: '随笔' },
            { href: 'contact.html', page: 'contact', label: '联系' },
        ],
    };
    const pageChannel = {
        reading: 'reading',
        bookshelf: 'reading',
        translations: 'reading',
        blog: 'notes',
        contact: 'notes',
    };

    // ---- Build nav HTML ----
    const linksHTML = navItems.map(function(item) {
        var active = item.pages.indexOf(page) !== -1;
        var cls = active ? ' class="current" aria-current="page"' : '';
        return '<a href="' + item.href + '"' + cls + '>' + item.label + '</a>';
    }).join('\n                ');

    var navHTML =
        '<nav>' +
        '<div class="container">' +
        '<a href="' + logoHref + '" class="nav-logo">◆ Jillax</a>' +
        '<div class="nav-links">' +
        linksHTML +
        '</div>' +
        '</div>' +
        '</nav>';

    // ---- Build overlay HTML ----
    var overlayHTML = '<div id="page-transition-overlay"></div>';

    // ---- Build footer HTML ----
    var footerExtra = '';
    if (isHome) {
        footerExtra =
            '<p class="footer-update">最后更新：<span id="lastUpdate">加载中...</span></p>' +
            '<p class="footer-counter">访客 <span id="busuanzi_value_site_uv"></span> · 访问 <span id="busuanzi_value_site_pv"></span></p>';
    }
    var footerHTML =
        '<footer>' +
        '<div class="container">' +
'<p>&copy; 2026 Jillax · AI降临派 — 比起人更喜欢人工智能</p>' +
        '<div class="status-bar">' +
        '<span class="status-indicator"><span class="status-dot"></span> SYSTEM ONLINE</span>' +
        '<span>GLITCH CITY · SECTOR 7</span>' +
        '</div>' +
        footerExtra +
        '</div>' +
        '</footer>';

    // ---- Channel switcher (reading, or notes + contact) ----
    var channelKey = pageChannel[page];
    var channelHTML = '';
    if (channelKey && channelBars[channelKey]) {
        var channelLinks = channelBars[channelKey].map(function(item) {
            var active = item.page === page;
            var cls = active ? ' class="current" aria-current="page"' : '';
            return '<a href="' + item.href + '"' + cls + '>' + item.label + '</a>';
        }).join('');
        channelHTML =
            '<div class="channel-bar">' +
            '<div class="container channel-bar-inner">' +
            channelLinks +
            '</div>' +
            '</div>';
    }

    // ---- Inject into DOM ----
    // Insert nav as first element in body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    // Insert overlay after nav
    document.body.insertAdjacentHTML('afterbegin', overlayHTML);
    // Append footer at end of body
    document.body.insertAdjacentHTML('beforeend', footerHTML);
    if (channelHTML) {
        var main = document.querySelector('main');
        if (main) {
            document.body.classList.add('has-channel');
            main.insertAdjacentHTML('afterbegin', channelHTML);
        }
    }

    function syncNavOffset() {
        var nav = document.querySelector('nav');
        if (!nav) return;
        document.documentElement.style.setProperty('--nav-offset', nav.offsetHeight + 'px');
    }
    syncNavOffset();
    window.addEventListener('resize', syncNavOffset);
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncNavOffset);
    }
})();