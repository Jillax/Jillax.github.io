/* ============================================
   Jillax.github.io — About Page Timeline
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    var timelineData = [
        {
            title: '公开数据与写作',
            subtitle: '持续进行中',
            type: 'education',
            date: '持续',
            desc: '用公开数据做可视化，写随笔，折腾 AI 工具。',
            tags: ['数据可视化', 'AI 工具', '写作']
        }
    ];

    var list = document.getElementById('tlList');
    var empty = document.getElementById('tlEmpty');
    var filters = document.querySelectorAll('.tl-filter-btn');
    var currentFilter = 'all';

    var typeLabels = {
        education: '关注方向',
        work: '工作经历',
        project: '项目经历'
    };
    var typeBadge = {
        education: 'edu',
        work: 'work',
        project: 'project'
    };

    function updateCounts() {
        var total = timelineData.length;
        var edu = timelineData.filter(function(d) { return d.type === 'education'; }).length;
        var work = timelineData.filter(function(d) { return d.type === 'work'; }).length;
        var proj = timelineData.filter(function(d) { return d.type === 'project'; }).length;
        var el;
        el = document.getElementById('countAll'); if (el) el.textContent = total;
        el = document.getElementById('countEdu'); if (el) el.textContent = edu;
        el = document.getElementById('countWork'); if (el) el.textContent = work;
        el = document.getElementById('countProj'); if (el) el.textContent = proj;
    }

    function render(filter) {
        var filtered = filter === 'all'
            ? timelineData
            : timelineData.filter(function(d) { return d.type === filter; });

        if (filtered.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        list.innerHTML = filtered.map(function(d) {
            var badgeLabel = typeLabels[d.type] || d.type;
            var badgeClass = typeBadge[d.type] || '';
            var tagsHtml = d.tags && d.tags.length
                ? '<div class="tl-tags">' + d.tags.map(function(t) { return '<span class="tl-tag">' + t + '</span>'; }).join('') + '</div>'
                : '';
            return '<div class="tl-item">' +
                '<div class="tl-dot"></div>' +
                '<div class="tl-card">' +
                '<div class="tl-card-header">' +
                '<div><div class="tl-title">' + d.title + '</div>' +
                (d.subtitle ? '<div class="tl-subtitle">' + d.subtitle + '</div>' : '') + '</div>' +
                '<span class="tl-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
                '</div>' +
                '<div class="tl-date">' + d.date + '</div>' +
                '<div class="tl-desc">' + d.desc + '</div>' +
                tagsHtml +
                '</div></div>';
        }).join('');
    }

    updateCounts();
    render(currentFilter);

    filters.forEach(function(btn) {
        btn.addEventListener('click', function() {
            filters.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            render(currentFilter);
        });
    });
});
