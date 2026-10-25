/* ============================================
   Jillax.github.io — Portfolio Tab Workspace
   Hash routing, keyboard control, focus mode
   ============================================ */

(function() {
    'use strict';

    var IDS = ['holdings', 'lookthrough', 'global', 'frontier'];
    var loaded = {};
    var active = null;
    var isFocus = false;
    var savedScroll = 0;

    var workspace, tablist, tabs, panels, cmdEl, statusEl, clockEl, focusBtn, focusExit;

    function byId(id) { return document.getElementById(id); }

    function normalizeHash() {
        var hash = (window.location.hash || '').replace(/^#/, '');
        if (!hash) return null;
        if (hash.indexOf('panel-') === 0) hash = hash.slice(6);
        return IDS.indexOf(hash) !== -1 ? hash : null;
    }

    function activate(id, options) {
        if (IDS.indexOf(id) === -1) return;
        options = options || {};
        if (active === id && !options.force) return;

        active = id;
        tabs.forEach(function(tab) {
            var on = tab.getAttribute('data-panel') === id;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.setAttribute('tabindex', on ? '0' : '-1');
        });
        panels.forEach(function(panel) {
            var on = panel.id === 'panel-' + id;
            panel.hidden = !on;
            panel.classList.toggle('is-active', on);
        });

        if (cmdEl) cmdEl.textContent = 'open ' + id + ' --tab';

        if (!options.silentHash && window.location.hash !== '#' + id) {
            try {
                window.history.replaceState(null, '', '#' + id);
            } catch (e) {
                /* file:// or sandboxed contexts */
            }
        }

        var first = !loaded[id];
        loaded[id] = true;

        var panel = byId('panel-' + id);
        if (panel) {
            panel.classList.remove('is-entering');
            requestAnimationFrame(function() {
                panel.classList.add('is-entering');
            });
        }

        document.dispatchEvent(new CustomEvent('portfolio:tabchange', {
            detail: { id: id, first: first }
        }));
    }

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.classList.toggle('is-error', !!isError);
        statusEl.innerHTML = '<span class="pf-console-dot" aria-hidden="true"></span>' + text;
    }

    function setFocus(on) {
        if (on === isFocus || !workspace) return;
        isFocus = on;
        if (on) {
            savedScroll = window.scrollY || window.pageYOffset || 0;
            workspace.classList.add('is-focus');
            document.body.classList.add('pf-focus');
            workspace.scrollTop = 0;
        } else {
            workspace.classList.remove('is-focus');
            document.body.classList.remove('pf-focus');
            window.scrollTo(0, savedScroll);
        }
        if (focusBtn) focusBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        document.dispatchEvent(new CustomEvent('portfolio:focuschange', {
            detail: { focus: on }
        }));
    }

    function tickClock() {
        if (!clockEl) return;
        var text = new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            timeZone: 'Asia/Shanghai'
        });
        clockEl.textContent = text + ' UTC+8';
    }

    function init() {
        workspace = byId('pfWorkspace');
        tablist = document.querySelector('.pf-tabs');
        if (!workspace || !tablist) return;

        tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
        panels = Array.prototype.slice.call(document.querySelectorAll('.pf-panels > [role="tabpanel"]'));
        cmdEl = byId('pfCmd');
        statusEl = byId('pfStatus');
        clockEl = byId('pfClock');
        focusBtn = byId('pfFocusBtn');
        focusExit = byId('pfFocusExit');

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                activate(tab.getAttribute('data-panel'));
            });
        });

        tablist.addEventListener('keydown', function(e) {
            var index = IDS.indexOf(active);
            var next = null;
            if (e.key === 'ArrowRight') next = IDS[(index + 1) % IDS.length];
            else if (e.key === 'ArrowLeft') next = IDS[(index - 1 + IDS.length) % IDS.length];
            else if (e.key === 'Home') next = IDS[0];
            else if (e.key === 'End') next = IDS[IDS.length - 1];
            if (!next) return;
            e.preventDefault();
            activate(next);
            var tab = byId('tab-' + next);
            if (tab) tab.focus();
        });

        if (focusBtn) {
            focusBtn.addEventListener('click', function() { setFocus(!isFocus); });
        }
        if (focusExit) {
            focusExit.addEventListener('click', function() { setFocus(false); });
        }

        document.addEventListener('keydown', function(e) {
            var target = e.target;
            var tag = target && target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                (target && target.isContentEditable)) return;
            if (e.key === 'Escape' && isFocus) {
                setFocus(false);
                return;
            }
            if ((e.key === 'f' || e.key === 'F') &&
                !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                setFocus(!isFocus);
            }
        });

        window.addEventListener('hashchange', function() {
            var id = normalizeHash();
            if (id && id !== active) activate(id, { silentHash: true });
        });

        tickClock();
        window.setInterval(tickClock, 1000);

        var initial = normalizeHash();
        activate(initial || 'holdings', { force: true, silentHash: true });
    }

    window.PortfolioWorkspace = {
        activate: activate,
        getActive: function() { return active; },
        setStatus: setStatus,
        setFocus: setFocus,
        isLoaded: function(id) { return !!loaded[id]; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
