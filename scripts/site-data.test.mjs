import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function readJSON(path) {
    return JSON.parse(await readFile(new URL(path, root), 'utf8'));
}

function isValidDate(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

test('全球行情快照：结构与数值', async () => {
    const data = await readJSON('data/global-markets.json');

    assert.equal(typeof data.updated, 'string');
    assert.match(data.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof data.source, 'string');
    assert.match(data.sourceUrl, /^https:\/\//);
    assert.ok(Array.isArray(data.markets));
    assert.ok(data.markets.length >= 15, '至少覆盖 15 个指数');

    const ids = new Set();
    const cities = new Set();
    const regions = new Set(['美洲', '欧洲', '亚太']);
    const maxAsOf = new Date(data.updated + 'T23:59:59Z');

    for (const market of data.markets) {
        assert.ok(market.id && market.symbol && market.name, '指数标识完整');
        assert.ok(!ids.has(market.id), `指数 id 不重复：${market.id}`);
        ids.add(market.id);

        assert.ok(market.cityId && market.city && market.country);
        cities.add(market.cityId);
        assert.ok(regions.has(market.region), `地区合法：${market.region}`);

        assert.ok(market.lat >= -90 && market.lat <= 90, `${market.id} 纬度合法`);
        assert.ok(market.lng >= -180 && market.lng <= 180, `${market.id} 经度合法`);
        assert.ok(market.close > 0, `${market.id} 收盘价为正`);
        assert.ok(Number.isFinite(market.change), `${market.id} 涨跌额有效`);
        assert.ok(Number.isFinite(market.changePct), `${market.id} 涨跌幅有效`);
        assert.ok(isValidDate(market.asOf), `${market.id} asOf 有效`);
        assert.ok(new Date(market.asOf) <= maxAsOf, `${market.id} asOf 不晚于快照日期`);

        const previous = market.close - market.change;
        const impliedPct = previous !== 0 ? (market.change / previous) * 100 : 0;
        assert.ok(
            Math.abs(impliedPct - market.changePct) < 0.02,
            `${market.id} 涨跌幅与涨跌额自洽`
        );
    }

    assert.equal(cities.size, 13, '覆盖 13 个金融中心');

    for (const id of ['us-spx', 'us-ndx', 'us-dji', 'cn-sse', 'jp-n225', 'hk-hsi']) {
        assert.ok(ids.has(id), `包含 ${id}`);
    }
});

test('前沿科技时间轴：两条线、日期与状态', async () => {
    const data = await readJSON('data/frontier-tech.json');

    assert.ok(isValidDate(data.updated), 'updated 有效');
    assert.ok(Array.isArray(data.tracks));
    assert.deepEqual(data.tracks.map((t) => t.id), ['ai', 'space']);
    assert.ok(data.note && data.note.length > 10, '保留口径说明');

    const allowedStatus = new Set(['released', 'ongoing', 'planned']);
    const updated = Date.parse(data.updated + 'T23:59:59Z');
    const seenTitles = new Set();

    for (const track of data.tracks) {
        assert.ok(track.label && track.en && track.tagline, `${track.id} 标题完整`);
        assert.equal(track.metrics.length, 4, `${track.id} 恰好 4 个指标`);
        for (const metric of track.metrics) {
            assert.ok(metric.label && metric.value && metric.unit, `${track.id} 指标字段完整`);
            assert.ok(metric.note, `${track.id} 指标保留口径`);
        }

        assert.ok(track.milestones.length >= 7, `${track.id} 至少 7 个节点`);
        const dates = track.milestones.map((m) => m.date);
        assert.deepEqual(dates, dates.slice().sort().reverse(), `${track.id} 节点按时间倒序`);

        for (const milestone of track.milestones) {
            assert.match(milestone.date, /^\d{4}-\d{2}-\d{2}$/, '日期格式统一');
            assert.ok(isValidDate(milestone.date), `${milestone.title} 日期有效`);
            assert.ok(milestone.title && milestone.org && milestone.detail, '节点内容完整');
            assert.ok(allowedStatus.has(milestone.status), `状态合法：${milestone.status}`);
            assert.match(milestone.source, /^https:\/\//, '来源使用 HTTPS');
            assert.ok(!seenTitles.has(milestone.title), `节点标题不重复：${milestone.title}`);
            seenTitles.add(milestone.title);

            if (milestone.status === 'planned') {
                assert.ok(Date.parse(milestone.date) > updated, `${milestone.title} 计划项在未来`);
            } else {
                assert.ok(Date.parse(milestone.date) <= updated, `${milestone.title} 已落地项不在未来`);
            }
        }
    }
});
