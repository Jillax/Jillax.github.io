import { readFile, writeFile } from 'node:fs/promises';

const OUT = 'data/global-markets.json';
const ENDPOINT = 'https://push2.eastmoney.com/api/qt/ulist.np/get';
const FIELDS = 'f2,f3,f4,f12,f13,f14,f124';

const MARKETS = [
    { id: 'us-spx', secid: '100.SPX', symbol: 'SPX', name: '标普500', cityId: 'new-york', city: '纽约', country: '美国', region: '美洲', lat: 40.7128, lng: -74.006 },
    { id: 'us-ndx', secid: '100.NDX100', symbol: 'NDX', name: '纳斯达克100', cityId: 'new-york', city: '纽约', country: '美国', region: '美洲', lat: 40.7128, lng: -74.006 },
    { id: 'us-dji', secid: '100.DJIA', symbol: 'DJI', name: '道琼斯', cityId: 'new-york', city: '纽约', country: '美国', region: '美洲', lat: 40.7128, lng: -74.006 },
    { id: 'ca-tsx', secid: '100.TSX', symbol: 'TSX', name: '加拿大 S&P/TSX', cityId: 'toronto', city: '多伦多', country: '加拿大', region: '美洲', lat: 43.6532, lng: -79.3832 },
    { id: 'br-bvsp', secid: '100.BVSP', symbol: 'BVSP', name: '巴西 BOVESPA', cityId: 'sao-paulo', city: '圣保罗', country: '巴西', region: '美洲', lat: -23.5505, lng: -46.6333 },
    { id: 'uk-ftse', secid: '100.FTSE', symbol: 'FTSE', name: '英国富时100', cityId: 'london', city: '伦敦', country: '英国', region: '欧洲', lat: 51.5074, lng: -0.1278 },
    { id: 'de-dax', secid: '100.GDAXI', symbol: 'DAX', name: '德国 DAX', cityId: 'frankfurt', city: '法兰克福', country: '德国', region: '欧洲', lat: 50.1109, lng: 8.6821 },
    { id: 'fr-cac', secid: '100.FCHI', symbol: 'CAC', name: '法国 CAC40', cityId: 'paris', city: '巴黎', country: '法国', region: '欧洲', lat: 48.8566, lng: 2.3522 },
    { id: 'in-sensex', secid: '100.SENSEX', symbol: 'SENSEX', name: '印度 SENSEX', cityId: 'mumbai', city: '孟买', country: '印度', region: '亚太', lat: 19.076, lng: 72.8777 },
    { id: 'sg-sti', secid: '100.STI', symbol: 'STI', name: '新加坡海峡时报', cityId: 'singapore', city: '新加坡', country: '新加坡', region: '亚太', lat: 1.3521, lng: 103.8198 },
    { id: 'hk-hsi', secid: '100.HSI', symbol: 'HSI', name: '恒生指数', cityId: 'hong-kong', city: '香港', country: '中国', region: '亚太', lat: 22.3193, lng: 114.1694 },
    { id: 'cn-sse', secid: '1.000001', symbol: '000001', name: '上证指数', cityId: 'shanghai', city: '上海', country: '中国', region: '亚太', lat: 31.2304, lng: 121.4737 },
    { id: 'jp-n225', secid: '100.N225', symbol: 'N225', name: '日经225', cityId: 'tokyo', city: '东京', country: '日本', region: '亚太', lat: 35.6762, lng: 139.6503 },
    { id: 'kr-kospi', secid: '100.KS11', symbol: 'KS11', name: '韩国 KOSPI', cityId: 'seoul', city: '首尔', country: '韩国', region: '亚太', lat: 37.5665, lng: 126.978 },
    { id: 'au-asx', secid: '100.AS51', symbol: 'AS51', name: '澳大利亚 S&P/ASX 200', cityId: 'sydney', city: '悉尼', country: '澳大利亚', region: '亚太', lat: -33.8688, lng: 151.2093 }
];

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toIso(seconds) {
    const num = Number(seconds);
    if (!Number.isFinite(num) || num <= 0) return null;
    return new Date(num * 1000).toISOString();
}

async function loadPrevious() {
    try {
        const raw = await readFile(OUT, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.markets) ? parsed.markets : [];
    } catch (error) {
        return [];
    }
}

async function main() {
    const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=' +
        MARKETS.map(function (market) { return market.secid; }).join(',') +
        '&fields=' + FIELDS;

    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!response.ok) throw new Error('行情接口返回 HTTP ' + response.status);

    const payload = await response.json();
    const rows = payload && payload.data && payload.data.diff;
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('行情接口返回结构异常');
    }

    const quotes = new Map();
    rows.forEach(function (row) {
        quotes.set(String(row.f13) + '.' + String(row.f12), row);
    });

    const previous = await loadPrevious();
    const previousById = new Map(previous.map(function (market) { return [market.id, market]; }));

    const markets = [];
    const missing = [];

    MARKETS.forEach(function (meta) {
        const quote = quotes.get(meta.secid);
        const close = quote ? toNumber(quote.f2) : null;
        const changePct = quote ? toNumber(quote.f3) : null;
        const change = quote ? toNumber(quote.f4) : null;
        const asOf = quote ? toIso(quote.f124) : null;

        if (close !== null && changePct !== null && asOf) {
            markets.push({
                id: meta.id,
                symbol: meta.symbol,
                name: meta.name,
                cityId: meta.cityId,
                city: meta.city,
                country: meta.country,
                region: meta.region,
                lat: meta.lat,
                lng: meta.lng,
                close: close,
                change: change === null ? 0 : change,
                changePct: changePct === 0 ? 0 : changePct,
                asOf: asOf
            });
            return;
        }

        if (previousById.has(meta.id)) {
            markets.push(previousById.get(meta.id));
            missing.push(meta.id);
            return;
        }

        missing.push(meta.id);
    });

    if (markets.length < 5) {
        throw new Error('可用行情不足（' + markets.length + ' 个），保留上一份快照');
    }

    const asOf = markets.reduce(function (latest, market) {
        return !latest || market.asOf > latest ? market.asOf : latest;
    }, null);

    const fetchedAt = new Date();
    const payloadOut = {
        updated: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(fetchedAt),
        asOf: asOf,
        source: '东方财富',
        sourceUrl: 'https://quote.eastmoney.com/',
        note: '每个指数为最近一个交易时段的收盘数据，不同时区的 asOf 不同；抓取失败的指数沿用上一份快照。',
        markets: markets
    };

    await writeFile(OUT, JSON.stringify(payloadOut, null, 2) + '\n', 'utf8');
    console.log('写入 ' + OUT + '：' + markets.length + ' 个指数，asOf=' + asOf);
    if (missing.length) {
        console.log('本次未取到、沿用旧值：' + missing.join(', '));
    }
}

main().catch(function (error) {
    console.error(error.message);
    process.exitCode = 1;
});
