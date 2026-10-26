/* ============================================
   rights.html — 检索与目录高亮
   纯本地文本匹配，不依赖网络 / 可直接 file:// 打开
   ============================================ */

(function () {
    var input = document.getElementById('rSearch');
    var count = document.getElementById('rCount');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.r-card'));
    var secs = Array.prototype.slice.call(document.querySelectorAll('.r-sec'));
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.r-toc a'));

    function normalize(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, '');
    }

    function renderCount(shown, query) {
        if (!count) return;
        count.textContent = query
            ? shown + ' / ' + cards.length + ' 条匹配'
            : '共 ' + cards.length + ' 条';
    }

    renderCount(cards.length, '');

    function applyFilter() {
        var query = normalize(input.value.trim());
        var hits = 0;

        cards.forEach(function (card) {
            var match = !query || normalize(card.textContent).indexOf(query) !== -1;
            card.classList.toggle('is-hidden', !match);
            if (match) hits++;
        });

        secs.forEach(function (sec) {
            var visible = sec.querySelectorAll('.r-card:not(.is-hidden)').length;
            sec.classList.toggle('is-hidden', visible === 0);
        });

        tocLinks.forEach(function (link) {
            var target = document.getElementById(link.getAttribute('href').slice(1));
            if (target) link.classList.toggle('is-hidden', target.classList.contains('is-hidden'));
        });

        renderCount(hits, query);
    }

    if (input) {
        input.addEventListener('input', applyFilter);

        document.addEventListener('keydown', function (event) {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
            if (document.activeElement === input) return;
            event.preventDefault();
            input.focus();
        });
    }

    // ---- 目录跟随滚动 ----
    if (!tocLinks.length) return;

    var ticking = false;

    function setActive() {
        ticking = false;
        var offset = 160;
        var current = '';

        secs.forEach(function (sec) {
            if (sec.classList.contains('is-hidden')) return;
            if (sec.getBoundingClientRect().top - offset <= 0) current = sec.id;
        });

        if (!current) {
            var firstVisible = secs.filter(function (sec) {
                return !sec.classList.contains('is-hidden');
            })[0];
            current = firstVisible ? firstVisible.id : '';
        }

        tocLinks.forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('href') === '#' + current);
        });
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(setActive);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (input) input.addEventListener('input', onScroll);
    setActive();
})();
