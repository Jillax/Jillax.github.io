/* ============================================
   Jillax.github.io — Shared JavaScript
   ============================================ */

// ===== Theme Toggle =====
(function() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const html = document.documentElement;
    const saved = localStorage.getItem('theme');

    if (saved === 'light') {
        html.setAttribute('data-theme', 'light');
        toggle.textContent = '☾';
    } else if (saved === 'dark') {
        html.removeAttribute('data-theme');
        toggle.textContent = '☀';
    }

    toggle.addEventListener('click', function() {
        const isLight = html.hasAttribute('data-theme');
        if (isLight) {
            html.removeAttribute('data-theme');
            toggle.textContent = '☀';
            localStorage.setItem('theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
            toggle.textContent = '☾';
            localStorage.setItem('theme', 'light');
        }
    });
})();

// ===== Page Transition Overlay =====
(function() {
    const overlay = document.getElementById('page-transition-overlay');
    if (!overlay) return;

    // Fade in on page load (overlay starts opaque via inline style, then fades out)
    requestAnimationFrame(function() {
        overlay.style.transition = 'opacity 0.25s ease';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    });

    // Intercept internal link clicks
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') ||
            href.startsWith('mailto:') || href.startsWith('tel:') ||
            link.hasAttribute('download') || link.target === '_blank') return;

        e.preventDefault();
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'all';
        setTimeout(function() {
            window.location.href = href;
        }, 280);
    });

    // Handle browser back/forward cache
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            overlay.style.transition = 'none';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            // Re-trigger fade
            requestAnimationFrame(function() {
                overlay.style.transition = 'opacity 0.25s ease';
            });
        }
    });
})();

// ===== i18n — Language Toggle =====
(function() {
    let currentLang = localStorage.getItem('lang') || 'zh';
    let dict = {};
    let loaded = false;

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const entry = dict[key];
            if (!entry) return;
            const text = entry[currentLang];
            if (text !== undefined && text !== null) {
                el.textContent = text;
            }
        });
        document.documentElement.setAttribute('lang', currentLang === 'zh' ? 'zh-CN' : 'en');
    }

    function toggleLang(btn) {
        currentLang = currentLang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('lang', currentLang);
        if (btn) btn.textContent = currentLang === 'zh' ? 'EN' : '中';
        applyTranslations();
    }

    function init() {
        const btn = document.querySelector('.lang-toggle');
        if (!btn) return;

        btn.textContent = currentLang === 'zh' ? 'EN' : '中';

        fetch('data/i18n.json')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                dict = data;
                loaded = true;
                applyTranslations();
            })
            .catch(function() {
                // i18n unavailable, fall back to Chinese
            });

        btn.addEventListener('click', function() {
            toggleLang(btn);
        });
    }

    init();
})();

// ===== Scroll Reveal =====
(function() {
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(function(el) {
        return observer.observe(el);
    });
})();
