import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { aggregateLookthrough } = require('../js/lookthrough.js');

const portfolio = JSON.parse(readFileSync(new URL('../data/portfolio.json', import.meta.url), 'utf8'));
const weights = JSON.parse(readFileSync(new URL('../data/index-lookthrough.json', import.meta.url), 'utf8'));
const result = aggregateLookthrough(portfolio, weights);

function closeTo(actual, expected, tolerance, message) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        (message || 'value') + ': expected ' + expected + ' ±' + tolerance + ', got ' + actual
    );
}

function rowOf(ticker) {
    return result.rows.find(function (row) {
        return row.tickers.split(' / ').indexOf(ticker) !== -1;
    });
}

test('美股权益等于标普与纳指基金市值之和', function () {
    closeTo(result.usEquity, 16754.91 + 11629.73, 1e-6, 'usEquity');
});

test('标普前十五与纳指前十五去重后为 18 行', function () {
    assert.equal(result.rows.length, 18);
});

test('英伟达按两只基金加权后约为 2,244 元', function () {
    const nvda = rowOf('NVDA');
    assert.equal(nvda.name, '英伟达');
    closeTo(nvda.value, 2244.38, 0.01, 'NVDA value');
    closeTo(nvda.weights.sp500, 7.78, 1e-9, 'NVDA sp500 weight');
    closeTo(nvda.weights.ndx, 8.09, 1e-9, 'NVDA ndx weight');
    closeTo(nvda.share, 0.04066, 0.0001, 'NVDA share');
});

test('GOOGL 与 GOOG 合并为 Alphabet 一行', function () {
    const alphabet = rowOf('GOOG');
    assert.equal(result.rows.filter(function (row) { return row.name === 'Alphabet'; }).length, 1);
    assert.equal(alphabet.tickers, 'GOOGL / GOOG');
    closeTo(alphabet.weights.sp500, 5.19, 1e-9, 'Alphabet sp500 weight');
    closeTo(alphabet.weights.ndx, 5.78, 1e-9, 'Alphabet ndx weight');
    closeTo(alphabet.value, 1541.78, 0.01, 'Alphabet value');
});

test('未覆盖部分拆成标普与纳指两条残差', function () {
    const sp500 = result.residuals.find(function (row) { return row.key === 'sp500'; });
    const ndx = result.residuals.find(function (row) { return row.key === 'ndx'; });
    closeTo(sp500.residualWeight, 55.35, 1e-9, 'sp500 residual weight');
    closeTo(ndx.residualWeight, 41.65, 1e-9, 'ndx residual weight');
    closeTo(sp500.value, 9273.84, 0.02, 'sp500 residual value');
    closeTo(ndx.value, 4843.78, 0.02, 'ndx residual value');
});

test('个股与残差之和等于美股权益，没有漏算', function () {
    const named = result.rows.reduce(function (sum, row) { return sum + row.value; }, 0);
    const residual = result.residuals.reduce(function (sum, row) { return sum + row.value; }, 0);
    closeTo(named + residual, result.usEquity, 1e-6, 'rows total');
});

test('个股按隐含敞口降序排列', function () {
    for (let i = 1; i < result.rows.length; i++) {
        assert.ok(result.rows[i - 1].value >= result.rows[i].value, 'row ' + i + ' out of order');
    }
});

test('前十大合计与重叠数量与快照一致', function () {
    closeTo(result.top10Value, 12245.87, 0.05, 'top10');
    assert.equal(result.overlapCount, 10);
});
