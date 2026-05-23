/* ============================================
   Jillax.github.io — Shared Components
   Injects nav, footer, and page transition overlay
   Must load BEFORE main.js
   ============================================ */

(function() {
    // Determine current page from body data attribute
    const page = document.body.getAttribute('data-page') || 'index';
    const isHome = page === 'index';
    const logoHref = isHome ? '#' : 'index.html';

    const navItems = [
        { href: 'about.html',     label: '关于',   hide: '' },
        { href: 'portfolio.html', label: '投资',   hide: '' },
        { href: 'contact.html',   label: '联系',   hide: 'small' },
        { href: 'share.html',     label: '分享',   hide: 'mobile' },
        { href: 'translations.html', label: '译制', hide: 'mobile' },
        { href: 'bookshelf.html', label: '书影音', hide: 'mobile' },
        { href: 'blog.html',      label: '随笔',   hide: 'mobile' },
    ];

    // ---- Build nav HTML ----
    const linksHTML = navItems.map(function(item) {
        var cls = (page !== 'index' && item.href.indexOf(page) !== -1) ? ' class="current"' : '';
        var hideAttr = item.hide ? ' data-nav-hide="' + item.hide + '"' : '';
        return '<a href="' + item.href + '"' + cls + hideAttr + '>' + item.label + '</a>';
    }).join('\n                ');

    var navHTML =
        '<nav>' +
        '<div class="container">' +
        '<a href="' + logoHref + '" class="nav-logo">Jillax</a>' +
        '<div class="nav-links">' +
        linksHTML +
        '<button class="theme-toggle" id="themeToggle" title="切换主题">☀</button>' +
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
        '<p>&copy; 2026 Jillax · AI降临派，比起人还是更喜欢人工智能</p>' +
        footerExtra +
        '</div>' +
        '</footer>';

    // ---- Inject into DOM ----
    // Insert nav as first element in body
    document.body.insertAdjacentHTML('afterbegin', navHTML);
    // Insert overlay after nav
    document.body.insertAdjacentHTML('afterbegin', overlayHTML);
    // Append footer at end of body
    document.body.insertAdjacentHTML('beforeend', footerHTML);
})();
