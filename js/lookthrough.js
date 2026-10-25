/* ============================================
   Jillax.github.io — Index Look-through
   纯计算，无 DOM 依赖，可在 Node 中直接测试
   ============================================ */

(function (root) {
    'use strict';

    function itemValue(item) {
        if (item.subItems && item.subItems.length) {
            return item.subItems.reduce(function (sum, sub) {
                return sum + (sub.value || 0);
            }, 0);
        }
        return item.value || 0;
    }

    function totalAssets(portfolio) {
        var total = 0;
        portfolio.categories.forEach(function (cat) {
            cat.items.forEach(function (item) { total += itemValue(item); });
        });
        return total;
    }

    function findItemValue(portfolio, itemName) {
        var value = 0;
        portfolio.categories.forEach(function (cat) {
            cat.items.forEach(function (item) {
                if (item.name === itemName) value += itemValue(item);
            });
        });
        return value;
    }

    function aggregateLookthrough(portfolio, weights) {
        var total = totalAssets(portfolio);
        var usEquity = 0;
        var rowsByKey = {};
        var indices = [];
        var indexKeys = Object.keys(weights.indices);

        indexKeys.forEach(function (indexKey) {
            var index = weights.indices[indexKey];
            var fundValue = findItemValue(portfolio, index.portfolioItem);
            usEquity += fundValue;

            var covered = 0;
            index.holdings.forEach(function (holding) {
                covered += holding.weight;
                var key = holding.group || holding.ticker;
                var row = rowsByKey[key];
                if (!row) {
                    row = rowsByKey[key] = {
                        key: key,
                        name: holding.name,
                        tickers: [],
                        weights: {},
                        value: 0
                    };
                }
                if (row.tickers.indexOf(holding.ticker) === -1) {
                    row.tickers.push(holding.ticker);
                }
                row.weights[indexKey] = (row.weights[indexKey] || 0) + holding.weight;
                row.value += fundValue * holding.weight / 100;
            });

            var residualWeight = Math.max(0, 100 - covered);
            indices.push({
                key: indexKey,
                label: index.label,
                fundValue: fundValue,
                coveredWeight: covered,
                residualWeight: residualWeight,
                residualValue: fundValue * residualWeight / 100,
                asOf: index.asOf,
                source: index.source,
                sourceUrl: index.sourceUrl
            });
        });

        var rows = Object.keys(rowsByKey).map(function (key) {
            var row = rowsByKey[key];
            return {
                key: row.key,
                name: row.name,
                tickers: row.tickers.join(' / '),
                weights: row.weights,
                value: row.value,
                share: total > 0 ? row.value / total : 0
            };
        }).sort(function (a, b) { return b.value - a.value; });

        var residuals = indices.map(function (index) {
            return {
                key: index.key,
                name: index.label + ' 其他成分股',
                value: index.residualValue,
                share: total > 0 ? index.residualValue / total : 0,
                residualWeight: index.residualWeight
            };
        });

        var top10Value = rows.slice(0, 10).reduce(function (sum, row) {
            return sum + row.value;
        }, 0);

        var overlapCount = rows.filter(function (row) {
            return Object.keys(row.weights).length === indexKeys.length;
        }).length;

        return {
            totalAssets: total,
            usEquity: usEquity,
            rows: rows,
            residuals: residuals,
            indices: indices,
            top10Value: top10Value,
            overlapCount: overlapCount
        };
    }

    var api = {
        itemValue: itemValue,
        totalAssets: totalAssets,
        aggregateLookthrough: aggregateLookthrough
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.LookThrough = api;
    }
})(typeof window !== 'undefined' ? window : null);
