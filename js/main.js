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

// ===== Scroll Reveal =====
(function() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();