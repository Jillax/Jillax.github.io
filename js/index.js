/* ============================================
   Jillax.github.io — Index Page
   ============================================ */

(function() {
    // ---- Last Update ----
    fetch('https://api.github.com/repos/Jillax/Jillax.github.io/commits?per_page=1')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data && data[0] && data[0].commit) {
                var date = new Date(data[0].commit.committer.date);
                var y = date.getFullYear();
                var m = String(date.getMonth() + 1).padStart(2, '0');
                var d = String(date.getDate()).padStart(2, '0');
                var h = String(date.getHours()).padStart(2, '0');
                var min = String(date.getMinutes()).padStart(2, '0');
                var el = document.getElementById('lastUpdate');
                if (el) el.textContent = y + '-' + m + '-' + d + ' ' + h + ':' + min;
            } else {
                var el2 = document.getElementById('lastUpdate');
                if (el2) el2.textContent = '—';
            }
        })
        .catch(function() {
            var el3 = document.getElementById('lastUpdate');
            if (el3) el3.textContent = '—';
        });

    // ---- Jill Dialog Typewriter ----
    document.addEventListener('DOMContentLoaded', function() {
        var dialogText = document.getElementById('jillDialogText');
        var dialogEl = document.getElementById('jillDialog');
        var dialogQuotes = [];
        var dialogIndex = -1;

        function getDialogQuotes() {
            dialogQuotes = [];
            fetch('data/quotes.json')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    dialogQuotes = data;
                    shuffleQuotes();
                    runDialogCycle();
                })
                .catch(function() {
                    dialogQuotes = [
                        { text: '好好活着为了享受书影音和游戏。' },
                        { text: '对混沌和未来保持谦虚。' },
                        { text: '混合饮料与混合思想。' },
                        { text: '在没有黑暗的地方相遇。' }
                    ];
                    shuffleQuotes();
                    runDialogCycle();
                });
        }

        function shuffleQuotes() {
            for (var i = dialogQuotes.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = dialogQuotes[i];
                dialogQuotes[i] = dialogQuotes[j];
                dialogQuotes[j] = tmp;
            }
        }

        function getNextDialogQuote() {
            dialogIndex++;
            if (dialogIndex >= dialogQuotes.length) {
                shuffleQuotes();
                dialogIndex = 0;
            }
            return dialogQuotes[dialogIndex].text;
        }

        function typeWriter(text, charIndex, callback) {
            if (!dialogText) return;
            if (charIndex < text.length) {
                dialogText.textContent = text.substring(0, charIndex + 1);
                setTimeout(function() {
                    typeWriter(text, charIndex + 1, callback);
                }, 45 + Math.random() * 35);
            } else {
                if (callback) callback();
            }
        }

        function runDialogCycle() {
            if (!dialogText || !dialogEl) return;
            var text = getNextDialogQuote();
            dialogText.textContent = '';
            typeWriter(text, 0, function() {
                setTimeout(function() {
                    if (dialogEl) dialogEl.style.transition = 'opacity 0.5s ease';
                    if (dialogEl) dialogEl.style.opacity = '0.3';
                    setTimeout(function() {
                        if (dialogText) dialogText.textContent = '';
                        if (dialogEl) dialogEl.style.opacity = '1';
                        runDialogCycle();
                    }, 600);
                }, 6000);
            });
        }

        // Start dialog after initial animation delay
        getDialogQuotes();
        setTimeout(function() {}, 2500);

        // ===== Pixel Jill Canvas =====
        (function() {
            var pc = document.getElementById('jillPixelCanvas');
            if (!pc) return;
            var px = pc.getContext('2d');
            var PW = pc.width, PH = pc.height;
            var pmx = PW/2, pmy = PH/2, pframe = 0, pblink = 0, pblinking = false;
            var pbreath = 0;

            function drawPxJill() {
                pframe++;
                pbreath += 0.025;
                var s = 2.8, cx = PW/2, cy = PH/2 + 30;
                px.clearRect(0, 0, PW, PH);
                px.save();
                px.translate(cx, cy + Math.sin(pbreath) * 1.5);

                // Hair
                px.fillStyle = '#6b3fa0';
                px.fillRect(-16*s, -38*s, 32*s, 16*s);
                px.fillRect(-20*s, -32*s, 7*s, 26*s);
                px.fillRect(13*s, -32*s, 7*s, 26*s);
                px.fillStyle = '#9b59ff';
                px.fillRect(-10*s, -36*s, 5*s, 3*s);
                px.fillRect(7*s, -34*s, 3*s, 2*s);

                // Face
                px.fillStyle = '#f5deb3';
                px.fillRect(-12*s, -24*s, 24*s, 20*s);

                // Eyes
                var elx = -6*s, erx = 4*s, ey = -18*s;
                pblink++;
                if (pblink > 160 + Math.random()*100) { pblinking = true; pblink = 0; }
                if (pblinking && pblink > 7) pblinking = false;

                if (pblinking) {
                    px.fillStyle = '#2a1f3d';
                    px.fillRect(elx - 3*s, ey, 6*s, 1*s);
                    px.fillRect(erx - 3*s, ey, 6*s, 1*s);
                } else {
                    px.fillStyle = '#fff';
                    px.fillRect(elx - 3*s, ey - 3*s, 7*s, 6*s);
                    px.fillRect(erx - 3*s, ey - 3*s, 7*s, 6*s);
                    px.fillStyle = '#9b59ff';
                    px.fillRect(elx - 1*s, ey - 1*s, 4*s, 4*s);
                    px.fillRect(erx - 1*s, ey - 1*s, 4*s, 4*s);
                    px.fillStyle = '#2a1f3d';
                    px.fillRect(elx, ey, 2*s, 2*s);
                    px.fillRect(erx, ey, 2*s, 2*s);
                    px.fillStyle = '#fff';
                    px.fillRect(elx + 1*s, ey - 1*s, 1*s, 1*s);
                    px.fillRect(erx + 1*s, ey - 1*s, 1*s, 1*s);
                }

                // Mouth
                px.fillStyle = '#c0392b';
                px.fillRect(-3*s, -9*s, 6*s, 1*s);

                // Blush
                px.fillStyle = 'rgba(255,150,150,0.3)';
                px.fillRect(-10*s, -12*s, 5*s, 2*s);
                px.fillRect(5*s, -12*s, 5*s, 2*s);

                // Neck
                px.fillStyle = '#f5deb3';
                px.fillRect(-3*s, -4*s, 6*s, 3*s);

                // Body
                px.fillStyle = '#2a1f3d';
                px.fillRect(-14*s, -1, 28*s, 24*s);
                px.fillStyle = '#fff';
                px.fillRect(-8*s, -1, 16*s, 3*s);
                px.fillStyle = '#9b59ff';
                px.fillRect(-2*s, 2*s, 4*s, 10*s);
                px.fillStyle = '#b47aff';
                px.fillRect(-1*s, 4*s, 2*s, 7*s);

                // Arms
                px.fillStyle = '#2a1f3d';
                px.fillRect(-19*s, 1*s, 5*s, 16*s);
                px.fillRect(14*s, 1*s, 5*s, 16*s);
                px.fillStyle = '#f5deb3';
                px.fillRect(-19*s, 17*s, 5*s, 3*s);
                px.fillRect(14*s, 17*s, 5*s, 3*s);

                // Glass
                px.fillStyle = 'rgba(0,229,255,0.4)';
                px.fillRect(16*s, 8*s, 7*s, 10*s);
                px.fillStyle = 'rgba(0,229,255,0.6)';
                px.shadowColor = 'rgba(0,229,255,0.5)';
                px.shadowBlur = 6;
                px.fillRect(17*s, 10*s, 5*s, 5*s);
                px.shadowBlur = 0;

                px.restore();
            }

            function animJill() { drawPxJill(); requestAnimationFrame(animJill); }
            animJill();
        })();
    });
})();
