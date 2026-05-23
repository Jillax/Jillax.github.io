/* ============================================
   Jillax.github.io — Shared Components
   Injects nav, footer, and page transition overlay
   Must load BEFORE main.js (i18n depends on nav DOM)
   ============================================ */

(function() {
    // Determine current page from body data attribute
    const page = document.body.getAttribute('data-page') || 'index';
    const isHome = page === 'index';
    const logoHref = isHome ? '#' : 'index.html';

    const navItems = [
        { href: 'about.html',    i18n: 'nav.about',       zh: '关于',   en: 'About', hide: '' },
        { href: 'portfolio.html',i18n: 'nav.portfolio',   zh: '投资',   en: 'Portfolio', hide: '' },
        { href: 'contact.html',  i18n: 'nav.contact',     zh: '联系',   en: 'Contact', hide: 'small' },
        { href: 'share.html',    i18n: 'nav.share',       zh: '分享',   en: 'Share', hide: 'mobile' },
        { href: 'translations.html', i18n: 'nav.translations', zh: '译制', en: 'Subs', hide: 'mobile' },
        { href: 'bookshelf.html',i18n: 'nav.bookshelf',   zh: '书影音', en: 'Shelf+', hide: 'mobile' },
        { href: 'blog.html',     i18n: 'nav.blog',        zh: '随笔',   en: 'Blog', hide: 'mobile' },
    ];

    // ---- Build nav HTML ----
    const linksHTML = navItems.map(function(item) {
        var cls = (page !== 'index' && item.href.indexOf(page) !== -1) ? ' class="current"' : '';
        var hideAttr = item.hide ? ' data-nav-hide="' + item.hide + '"' : '';
        return '<a href="' + item.href + '"' + cls + hideAttr + ' data-i18n="' + item.i18n + '">' + item.zh + '</a>';
    }).join('\n                ');

    var navHTML =
        '<nav>' +
        '<div class="container">' +
        '<a href="' + logoHref + '" class="nav-logo">Jillax</a>' +
        '<div class="nav-links">' +
        linksHTML +
        '<button class="theme-toggle" id="themeToggle" title="切换主题">☀</button>' +
        '<button class="lang-toggle" title="语言/Language">EN</button>' +
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
