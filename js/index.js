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

    // ---- Quote Rotator ----
    document.addEventListener('DOMContentLoaded', function() {
        var quoteText = document.getElementById('quoteText');
        var quoteSource = document.getElementById('quoteSource');
        var quoteRefresh = document.getElementById('quoteRefresh');
        var quotes = [];

        fetch('data/quotes.json')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                quotes = data;
                showRandomQuote();
            })
            .catch(function() {
                if (quoteText) quoteText.textContent = '对混沌和未来保持谦虚，寻找属于这个时代的回答。';
                if (quoteSource) quoteSource.textContent = 'Jillax';
            });

        function showRandomQuote() {
            if (quotes.length === 0) return;
            var q = quotes[Math.floor(Math.random() * quotes.length)];
            if (quoteText) quoteText.textContent = q.text;
            if (quoteSource) quoteSource.textContent = q.source || '';
        }

        if (quoteRefresh) {
            quoteRefresh.addEventListener('click', function(e) {
                e.preventDefault();
                showRandomQuote();
                this.style.transition = 'transform 0.4s ease';
                this.style.transform = 'translateX(-50%) rotate(180deg)';
                setTimeout(function() {
                    this.style.transition = 'none';
                    this.style.transform = 'translateX(-50%)';
                }.bind(this), 400);
            });
        }

        // ---- Jill Dialog Typewriter ----
        var dialogText = document.getElementById('jillDialogText');
        var dialogEl = document.getElementById('jillDialog');
        var dialogQuotes = [];
        var dialogIndex = -1;
        var isTyping = false;

        // Reuse the same quotes data, fallback if needed
        function getDialogQuotes() {
            if (quotes.length > 0) {
                dialogQuotes = quotes.slice();
            } else {
                dialogQuotes = [
                    { text: '好好活着为了享受书影音和游戏。' },
                    { text: '对混沌和未来保持谦虚。' },
                    { text: '混合饮料与混合思想。' },
                    { text: '在没有黑暗的地方相遇。' }
                ];
            }
            // Shuffle
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
                getDialogQuotes();
                dialogIndex = 0;
            }
            return dialogQuotes[dialogIndex].text;
        }

        function typeWriter(text, charIndex, callback) {
            if (!dialogText) return;
            if (charIndex < text.length) {
                isTyping = true;
                dialogText.textContent = text.substring(0, charIndex + 1);
                setTimeout(function() {
                    typeWriter(text, charIndex + 1, callback);
                }, 45 + Math.random() * 35);
            } else {
                isTyping = false;
                if (callback) callback();
            }
        }

        function runDialogCycle() {
            if (!dialogText || !dialogEl) return;
            var text = getNextDialogQuote();
            // Clear and type
            dialogText.textContent = '';
            typeWriter(text, 0, function() {
                // Wait, then fade out, then next
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
        setTimeout(runDialogCycle, 2500);
    });
})();
