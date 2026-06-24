/* ============================================
   Jillax.github.io — Password Protection
   ============================================ */

(function() {
    var AUTH_KEY = 'jillax_auth';
    var PASSWORD = 'Jillax894';

    function isBot() {
        var ua = navigator.userAgent.toLowerCase();
        return /bot|crawl|spider|slurp|bingpreview|googlebot|baiduspider|yandex|sogou|duckduckbot/i.test(ua);
    }

    function isAuthenticated() {
        return sessionStorage.getItem(AUTH_KEY) === 'true';
    }

    function setAuthenticated() {
        sessionStorage.setItem(AUTH_KEY, 'true');
    }

    function showAuthOverlay() {
        var overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML =
            '<div class="auth-box">' +
            '<div class="auth-header">◆ JILLAX</div>' +
            '<div class="auth-label">// ACCESS REQUIRED</div>' +
            '<div class="auth-input-wrap">' +
            '<span class="auth-dots" id="authDots"></span>' +
            '<span class="auth-cursor" id="authCursor">|</span>' +
            '</div>' +
            '<input type="password" id="authInput" class="auth-hidden-input" autocomplete="off">' +
            '<div class="auth-error" id="authError"></div>' +
            '<button class="auth-btn" id="authBtn">进入</button>' +
            '</div>';

        var style = document.createElement('style');
        style.textContent =
            '#auth-overlay {' +
            '  position: fixed;' +
            '  top: 0; left: 0; right: 0; bottom: 0;' +
            '  background: var(--bg, #0d0a1a);' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  z-index: 99999;' +
            '  font-family: var(--font-mono, monospace);' +
            '}' +
            '.auth-box {' +
            '  text-align: center;' +
            '  padding: 40px;' +
            '  max-width: 320px;' +
            '  width: 90%;' +
            '}' +
            '.auth-header {' +
            '  font-size: 1.2rem;' +
            '  color: var(--purple-bright, #b47aff);' +
            '  letter-spacing: 4px;' +
            '  margin-bottom: 8px;' +
            '}' +
            '.auth-label {' +
            '  font-size: 0.7rem;' +
            '  color: var(--text-faint, #6b5a8a);' +
            '  letter-spacing: 2px;' +
            '  margin-bottom: 32px;' +
            '}' +
            '.auth-input-wrap {' +
            '  display: flex;' +
            '  align-items: center;' +
            '  justify-content: center;' +
            '  min-height: 48px;' +
            '  padding: 12px 16px;' +
            '  border: 1px solid var(--border, #2a2040);' +
            '  cursor: text;' +
            '  transition: border-color 0.3s;' +
            '}' +
            '.auth-input-wrap:focus-within {' +
            '  border-color: var(--purple, #9b59ff);' +
            '}' +
            '.auth-dots {' +
            '  color: var(--text, #e8e0f0);' +
            '  letter-spacing: 8px;' +
            '  font-size: 1rem;' +
            '}' +
            '.auth-cursor {' +
            '  color: var(--purple-bright, #b47aff);' +
            '  font-size: 1rem;' +
            '  animation: blink 1s step-end infinite;' +
            '}' +
            '@keyframes blink {' +
            '  0%, 100% { opacity: 1; }' +
            '  50% { opacity: 0; }' +
            '}' +
            '.auth-hidden-input {' +
            '  position: absolute;' +
            '  opacity: 0;' +
            '  width: 0;' +
            '  height: 0;' +
            '}' +
            '.auth-error {' +
            '  color: #ff6b6b;' +
            '  font-size: 0.72rem;' +
            '  margin-top: 8px;' +
            '  min-height: 18px;' +
            '}' +
            '.auth-btn {' +
            '  margin-top: 20px;' +
            '  padding: 10px 32px;' +
            '  background: transparent;' +
            '  border: 1px solid var(--purple, #9b59ff);' +
            '  color: var(--purple-bright, #b47aff);' +
            '  font-family: var(--font-mono, monospace);' +
            '  font-size: 0.78rem;' +
            '  letter-spacing: 2px;' +
            '  cursor: pointer;' +
            '  transition: all 0.3s;' +
            '}' +
            '.auth-btn:hover {' +
            '  background: var(--purple-soft, rgba(155,89,255,0.1));' +
            '}';

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        var input = document.getElementById('authInput');
        var dots = document.getElementById('authDots');
        var cursor = document.getElementById('authCursor');
        var btn = document.getElementById('authBtn');
        var error = document.getElementById('authError');
        var wrap = document.querySelector('.auth-input-wrap');

        function updateDots() {
            dots.textContent = '●'.repeat(input.value.length);
        }

        wrap.addEventListener('click', function() {
            input.focus();
        });

        input.addEventListener('input', function() {
            updateDots();
        });

        function tryAuth() {
            if (input.value === PASSWORD) {
                setAuthenticated();
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s';
                setTimeout(function() {
                    overlay.remove();
                    document.body.style.overflow = '';
                }, 500);
            } else {
                error.textContent = '// ACCESS DENIED';
                input.value = '';
                updateDots();
                input.focus();
            }
        }

        btn.addEventListener('click', tryAuth);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') tryAuth();
        });

        document.body.style.overflow = 'hidden';
        setTimeout(function() { input.focus(); }, 100);
    }

    if (isBot()) {
        return;
    }

    if (!isAuthenticated()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showAuthOverlay);
        } else {
            showAuthOverlay();
        }
    }
})();
