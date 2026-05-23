/* ============================================
   Jillax.github.io — Share Page File Browser
   ============================================ */

(function() {
    var GITHUB_OWNER = 'Jillax';
    var GITHUB_REPO = 'Jillax.github.io';
    var BRANCH = 'main';
    var ROOT_PATH = 'Share';
    var IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

    var currentPath = ROOT_PATH;
    var fileGrid = document.getElementById('fileGrid');
    var stateMsg = document.getElementById('stateMsg');
    var stateIcon = document.getElementById('stateIcon');
    var stateText = document.getElementById('stateText');
    var stateDetail = document.getElementById('stateDetail');
    var breadcrumb = document.getElementById('breadcrumb');
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxDl = document.getElementById('lightboxDl');

    function isImage(name) {
        return IMAGE_EXTS.some(function(ext) { return name.toLowerCase().endsWith(ext); });
    }

    function formatSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getRawUrl(path) {
        return 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + BRANCH + '/' + path;
    }

    function getCdnUrl(path) {
        return 'https://cdn.jsdelivr.net/gh/' + GITHUB_OWNER + '/' + GITHUB_REPO + '@' + BRANCH + '/' + path;
    }

    async function listDir(dirPath) {
        var indexPath = dirPath ? 'Share/' + dirPath + '/index.json' : 'Share/index.json';
        var url = 'https://raw.githubusercontent.com/Jillax/Jillax.github.io/main/' + indexPath;
        var res = await fetch(url);
        if (!res.ok) throw new Error('目录加载失败');
        var data = await res.json();
        return (data.files || []).map(function(f) {
            var fp = dirPath ? dirPath + '/' + f.name : f.name;
            if (f.type === 'dir') return { type: 'dir', name: f.name, path: ROOT_PATH + '/' + fp };
            return { type: 'file', name: f.name, path: 'Share/' + fp, size: f.size || 0 };
        });
    }

    function renderBreadcrumb(path) {
        var parts = path ? path.split('/') : [];
        var html = '';
        var accumulated = '';
        parts.forEach(function(part, i) {
            accumulated += (accumulated ? '/' : '') + part;
            var isLast = i === parts.length - 1;
            if (i > 0) html += '<span class="sep">›</span>';
            if (isLast) {
                html += '<span class="current">' + part + '</span>';
            } else {
                html += '<a href="#" data-path="' + accumulated + '">' + part + '</a>';
            }
        });
        breadcrumb.innerHTML = html;
        breadcrumb.querySelectorAll('a[data-path]').forEach(function(a) {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                navigateTo(a.dataset.path);
            });
        });
    }

    function showState(icon, text, detail, isError) {
        stateMsg.style.display = 'block';
        fileGrid.style.display = 'none';
        stateIcon.textContent = icon;
        stateText.textContent = text;
        stateText.className = isError ? 'error-msg' : '';
        stateDetail.textContent = detail || '';
    }

    function showGrid() {
        stateMsg.style.display = 'none';
        fileGrid.style.display = 'grid';
    }

    async function navigateTo(path) {
        currentPath = path || ROOT_PATH;
        renderBreadcrumb(currentPath);
        showState('⏳', '加载中...', '');

        try {
            var relPath = currentPath === ROOT_PATH ? '' : currentPath.replace(ROOT_PATH + '/', '');
            var items = await listDir(relPath);
            showGrid();
            fileGrid.innerHTML = '';

            var folders = items.filter(function(i) { return i.type === 'dir'; });
            var files = items.filter(function(i) { return i.type === 'file'; });

            folders.sort(function(a, b) { return a.name.localeCompare(b.name); });
            files.sort(function(a, b) { return a.name.localeCompare(b.name); });

            var allItems = folders.concat(files);

            if (allItems.length === 0) {
                showState('📂', '这个文件夹是空的', '');
                return;
            }

            allItems.forEach(function(item) {
                var div = document.createElement('div');
                div.className = 'file-item' + (item.type === 'dir' ? ' folder' : '');

                if (item.type === 'dir') {
                    div.innerHTML = '<div class="file-icon">📁</div><div class="file-name">' + item.name + '</div>';
                    div.addEventListener('click', function() { navigateTo(item.path); });
                } else if (isImage(item.name)) {
                    var thumbUrl = getCdnUrl(item.path);
                    div.innerHTML =
                        '<img class="file-thumb" src="' + thumbUrl + '" alt="' + item.name + '" loading="lazy" ' +
                        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
                        '<div class="file-icon" style="display:none">🖼️</div>' +
                        '<div class="file-name">' + item.name + '</div>' +
                        '<div class="file-size">' + formatSize(item.size) + '</div>';
                    div.addEventListener('click', function() { openLightbox(item.path, item.name); });
                } else {
                    var rawUrl = getRawUrl(item.path);
                    div.innerHTML =
                        '<div class="file-icon">📄</div>' +
                        '<div class="file-name">' + item.name + '</div>' +
                        '<div class="file-size">' + formatSize(item.size) + '</div>';
                    div.addEventListener('click', function() { window.open(rawUrl, '_blank'); });
                }

                fileGrid.appendChild(div);
            });
        } catch (err) {
            showState('⚠️', '加载失败', err.message, true);
        }
    }

    function openLightbox(path, name) {
        var url = getRawUrl(path);
        lightboxImg.src = url;
        lightboxDl.href = url;
        lightboxDl.download = name;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeLightbox();
    });

    navigateTo(ROOT_PATH);
})();
