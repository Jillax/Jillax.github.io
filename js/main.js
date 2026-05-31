/* ============================================
   Jillax.github.io — Shared JavaScript
   VA-11 Hall-A Cyberpunk Theme
   ============================================ */

// ===== Theme Toggle =====
(function() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const html = document.documentElement;
    const saved = localStorage.getItem('theme');

    // Default is dark (cyberpunk). Light mode still stays dark-ish (cyberpunk lite)
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
        overlay.style.transition = 'opacity 0.3s ease';
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
        }, 300);
    });

    // Handle browser back/forward cache
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            overlay.style.transition = 'none';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            // Re-trigger fade
            requestAnimationFrame(function() {
                overlay.style.transition = 'opacity 0.3s ease';
            });
        }
    });
})();

// ===== Scroll Reveal =====
(function() {
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function(el) {
        return observer.observe(el);
    });
})();

// ===== Neon Particles Generator =====
(function() {
    var container = document.getElementById('particles');
    if (!container) return;

    var count = window.innerWidth < 768 ? 12 : 25;
    var colors = [
        'var(--purple)',
        'var(--neon-pink)',
        'var(--neon-cyan)',
        'var(--purple-bright)'
    ];

    for (var i = 0; i < count; i++) {
        var p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (8 + Math.random() * 15) + 's';
        p.style.animationDelay = (Math.random() * 10) + 's';
        p.style.width = (2 + Math.random() * 3) + 'px';
        p.style.height = p.style.width;
        // Randomly pick a color
        var ci = Math.floor(Math.random() * colors.length);
        p.style.background = colors[ci];
        if (ci === 0) p.style.boxShadow = '0 0 8px var(--purple-glow), 0 0 20px var(--purple-glow)';
        else if (ci === 1) p.style.boxShadow = '0 0 8px var(--neon-pink-glow), 0 0 20px var(--neon-pink-glow)';
        else if (ci === 2) p.style.boxShadow = '0 0 8px var(--neon-cyan-soft), 0 0 16px var(--neon-cyan-soft)';
        else p.style.boxShadow = '0 0 8px var(--purple-glow), 0 0 20px var(--purple-glow)';
        container.appendChild(p);
    }
})();

