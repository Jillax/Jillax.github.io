/* ============================================
   Jillax.github.io — Reading hub
   Shows the latest translation on the channel page
   ============================================ */

(function() {
    var slot = document.getElementById('readingLatest');
    if (!slot) return;

    fetch('data/translations.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            var items = (data && data.items) || [];
            var latest = null;
            items.forEach(function(item) {
                if (!item || !item.date || !item.title) return;
                if (!latest || item.date > latest.date) latest = item;
            });
            if (!latest) {
                slot.textContent = '译制列表还是空的。';
                return;
            }
            slot.textContent = latest.date + ' · ' + latest.title;
        })
        .catch(function() {
            slot.textContent = '最近一条译制暂时读不出来。';
        });
})();
