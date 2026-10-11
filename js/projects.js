/* ============================================
   Jillax.github.io — Works page
   Cards come from data/projects.json
   ============================================ */

(function() {
    var root = document.getElementById('projectRoot');
    if (!root) return;

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

    function cardHTML(item) {
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

    function render(items) {
        var order = [];
        var groups = {};
        items.forEach(function(item) {
            if (!item || !item.href || !item.title) return;
            var name = item.group || '作品';
            if (!groups[name]) {
                groups[name] = [];
                order.push(name);
            }
            groups[name].push(item);
        });
        if (!order.length) {
            root.innerHTML = '<p class="project-status">作品列表是空的。</p>';
            return;
        }
        root.innerHTML = order.map(function(name) {
            return '<div class="project-category">' +
                '<div class="project-category-title">// ' + esc(name) + '</div>' +
                '<div class="project-grid">' + groups[name].map(cardHTML).join('') + '</div>' +
                '</div>';
        }).join('');
    }

    fetch('data/projects.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            render((data && data.items) || []);
        })
        .catch(function() {
            root.innerHTML =
                '<p class="project-status">作品列表没有加载出来。可以直接打开 ' +
                '<a href="congress-portfolios/">申报上的美国</a>、' +
                '<a href="dsa/">帐篷里的派系</a>、' +
                '<a href="sovereign-funds/">披露上的国家资本</a>。</p>';
        });
})();
