/* ============================================
   Jillax.github.io — Frontier Tech Timelines
   AI + aerospace milestones from static data
   ============================================ */

(function() {
    'use strict';

    var DATA_URL = 'data/frontier-tech.json';
    var state = { loaded: false, loading: false };

    function byId(id) { return document.getElementById(id); }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function statusLabel(status) {
        if (status === 'released') return '已落地';
        if (status === 'ongoing') return '进行中';
        return '计划';
    }

    function statusClass(status) {
        if (status === 'released') return 'is-released';
        if (status === 'ongoing') return 'is-ongoing';
        return 'is-planned';
    }

    function metricHTML(metric) {
        return '<div class="ft-metric">' +
            '<span class="ft-metric-k">' + esc(metric.label) + '</span>' +
            '<div><span class="ft-metric-v">' + esc(metric.value) + '</span>' +
                (metric.unit ? '<span class="ft-metric-unit">' + esc(metric.unit) + '</span>' : '') +
            '</div>' +
            (metric.note ? '<span class="ft-metric-n">' + esc(metric.note) + '</span>' : '') +
        '</div>';
    }

    function milestoneHTML(item) {
        var status = item.status || 'planned';
        var source = item.source
            ? '<a class="ft-source" href="' + esc(item.source) + '" target="_blank" rel="noopener">' +
                'SOURCE // ' + esc(item.sourceLabel || '原文') + ' ↗</a>'
            : '';
        return '<li class="ft-node" data-status="' + esc(status) + '">' +
            '<div class="ft-node-head">' +
                '<span class="ft-date">' + esc(item.date) + '</span>' +
                '<span class="ft-org">' + esc(item.org) + '</span>' +
                '<span class="ft-status ' + statusClass(status) + '">' + statusLabel(status) + '</span>' +
            '</div>' +
            '<h4 class="ft-node-title">' + esc(item.title) + '</h4>' +
            '<p class="ft-node-detail">' + esc(item.detail) + '</p>' +
            source +
        '</li>';
    }

    function trackHTML(track, index) {
        var milestones = (track.milestones || []).slice().sort(function(a, b) {
            return String(b.date).localeCompare(String(a.date));
        });
        var metrics = (track.metrics || []).map(metricHTML).join('');
        var nodes = milestones.map(milestoneHTML).join('');
        return '<article class="ft-track" data-track="' + esc(track.id) + '">' +
            '<header class="ft-track-head">' +
                '<span class="ft-track-kicker">TRACK ' + String(index + 1).padStart(2, '0') + ' // SIGNAL</span>' +
                '<h3 class="ft-track-title">' + esc(track.label) + '</h3>' +
                '<div class="ft-track-en">' + esc(track.en) + '</div>' +
                (track.tagline ? '<p class="ft-track-tagline">' + esc(track.tagline) + '</p>' : '') +
            '</header>' +
            '<div class="ft-metrics">' + metrics + '</div>' +
            '<ol class="ft-timeline">' + nodes + '</ol>' +
        '</article>';
    }

    function updateTabMeta(tracks) {
        var meta = byId('tabMetaFrontier');
        if (!meta) return;
        var counts = tracks.map(function(track) {
            return (track.milestones || []).length;
        });
        meta.textContent = tracks.map(function(track, i) {
            return track.id === 'ai' ? 'AI ' + counts[i] : track.id === 'space' ? '航天 ' + counts[i] : counts[i] + ' 节点';
        }).join(' · ');
    }

    function render(data) {
        var tracksEl = byId('ftTracks');
        var noteEl = byId('ftNote');
        if (!tracksEl) return;

        var tracks = data.tracks || [];
        tracksEl.innerHTML = tracks.map(trackHTML).join('');
        updateTabMeta(tracks);

        if (noteEl) {
            noteEl.innerHTML =
                '时间轴更新于 ' + esc(data.updated) + '。' + esc(data.note || '') +
                ' 每条节点都保留来源链接，计划项会随任务与监管变化。';
        }
    }

    function renderError() {
        var tracksEl = byId('ftTracks');
        if (tracksEl) {
            tracksEl.innerHTML = '<div class="ft-empty">前沿科技时间轴加载失败，请稍后刷新。</div>';
        }
    }

    function ensureLoaded() {
        if (state.loaded || state.loading) return;
        state.loading = true;

        window.PortfolioWorkspace.fetchJSON(DATA_URL)
            .then(function(data) {
                state.loaded = true;
                render(data);
            })
            .catch(renderError)
            .finally(function() {
                state.loading = false;
            });
    }

    function init() {
        document.addEventListener('portfolio:tabchange', function(e) {
            if (e.detail && e.detail.id === 'frontier') ensureLoaded();
        });

        if (window.PortfolioWorkspace && window.PortfolioWorkspace.getActive() === 'frontier') {
            ensureLoaded();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
