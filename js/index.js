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
    });
})();
