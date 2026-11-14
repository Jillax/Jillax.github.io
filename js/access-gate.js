/* ============================================================
   jillax.github.io - 全站访问门禁 (front-door gate)

   注意：这是前端"门帘"，不是服务端鉴权。GitHub Pages 是纯静态托管，
   任何 HTML / JSON / 图片仍可通过直接 URL 取到。此脚本只用于挡住
   "随手搜到点进来"的访问者；真正的访问控制需要带鉴权的托管。

   明文密钥不落盘、不入库，这里只存 SHA-256。
   换密钥：python scripts/set_access_key.py
   ============================================================ */
(function () {
  'use strict';

  var KEY_HASH = '032d8ef77b3f690b9ed45ea330cfcb69978f263cf21cece030e14235bc088126';
  var STORAGE_KEY = 'jx.access.until';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000;

  /* ---------- SHA-256 (纯 JS，无外部依赖，file:// 下也能用) ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var bin = unescape(encodeURIComponent(str));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(str) {
    var msg = utf8Bytes(str);
    var len = msg.length;
    var bitLenHi = Math.floor(len / 0x20000000);   // len * 8 / 2^32
    var bitLenLo = (len * 8) >>> 0;
    var padded = (((len + 9) + 63) >> 6) << 6;
    var buf = new Uint8Array(padded);
    buf.set(msg);
    buf[len] = 0x80;
    buf[padded - 8] = (bitLenHi >>> 24) & 255;
    buf[padded - 7] = (bitLenHi >>> 16) & 255;
    buf[padded - 6] = (bitLenHi >>> 8) & 255;
    buf[padded - 5] = bitLenHi & 255;
    buf[padded - 4] = (bitLenLo >>> 24) & 255;
    buf[padded - 3] = (bitLenLo >>> 16) & 255;
    buf[padded - 2] = (bitLenLo >>> 8) & 255;
    buf[padded - 1] = bitLenLo & 255;

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    var i, off;

    for (off = 0; off < padded; off += 64) {
      for (i = 0; i < 16; i++) {
        var j = off + i * 4;
        w[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3],
          e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ---------- 授权状态 ---------- */
  function readGrant() {
    var now = Date.now(), v;
    try { v = parseInt(localStorage.getItem(STORAGE_KEY), 10); if (v > now) return true; } catch (e) {}
    try { v = parseInt(sessionStorage.getItem(STORAGE_KEY), 10); if (v > now) return true; } catch (e) {}
    return false;
  }

  function writeGrant() {
    var until = String(Date.now() + TTL_MS);
    try { localStorage.setItem(STORAGE_KEY, until); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_KEY, until); } catch (e) {}
  }

  function clearGrant() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // 访问 /?logout 或 #logout 可立即撤销本机授权
  try {
    if (/(?:^|[?&])logout(?:[=&]|$)/.test(location.search) || location.hash === '#logout') {
      clearGrant();
      history.replaceState(null, '', location.pathname);
    }
  } catch (e) {}

  var root = document.documentElement;

  function unlock() {
    root.classList.remove('jx-locked');
    var g = document.getElementById('jx-gate');
    if (g && g.parentNode) g.parentNode.removeChild(g);
    var s = document.getElementById('jx-gate-style');
    if (s && s.parentNode) s.parentNode.removeChild(s);
  }

  /* ---------- 样式：解析阶段就锁住，避免内容闪现 ---------- */
  var GATE_CSS = [
    'html.jx-locked{background:#0d0a1a!important}',
    'html.jx-locked body{overflow:hidden!important}',
    // opacity:0 作用于整棵子树且无法被后代覆盖；不用 display:none 是为了保留布局尺寸，
    // 让依赖容器宽度的图表脚本在解锁后仍能正确绘制。
    'html.jx-locked body > *:not(#jx-gate){visibility:hidden!important;opacity:0!important;pointer-events:none!important}',
    '#jx-gate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;',
      'background:radial-gradient(circle at 50% 32%,#1b1136 0%,#0d0a1a 68%);',
      'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace;color:#d4c8ef}',
    '#jx-gate .jx-box{position:relative;width:min(420px,88vw);padding:34px 32px 26px;',
      'background:rgba(18,12,36,.94);border:1px solid #3a2a63;border-radius:2px;',
      'box-shadow:0 0 70px rgba(155,89,255,.16),inset 0 0 44px rgba(155,89,255,.05)}',
    '#jx-gate .jx-box:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;',
      'background:linear-gradient(90deg,#9b59ff,#ff4da6,#00e5ff)}',
    '#jx-gate .jx-tag{font-size:10px;letter-spacing:.3em;color:#9b59ff;text-transform:uppercase;margin-bottom:18px}',
    '#jx-gate .jx-title{margin:0 0 8px;font-size:20px;font-weight:600;letter-spacing:.06em;color:#f0e9ff}',
    '#jx-gate .jx-sub{margin:0 0 26px;font-size:12px;line-height:1.75;color:#8b7bb5}',
    '#jx-gate .jx-row{display:flex;gap:8px}',
    '#jx-gate .jx-input{flex:1;min-width:0;padding:11px 13px;background:#0b0818;',
      'border:1px solid #3a2a63;border-radius:2px;color:#e8ddff;outline:none;',
      'font-family:inherit;font-size:14px;letter-spacing:.1em}',
    '#jx-gate .jx-input::placeholder{color:#4c3f70;letter-spacing:.04em}',
    '#jx-gate .jx-input:focus{border-color:#9b59ff;box-shadow:0 0 0 2px rgba(155,89,255,.16)}',
    '#jx-gate .jx-btn{padding:0 18px;border:0;border-radius:2px;background:#9b59ff;color:#0d0a1a;',
      'font-family:inherit;font-size:13px;font-weight:700;letter-spacing:.1em;cursor:pointer;transition:background .15s}',
    '#jx-gate .jx-btn:hover{background:#b47aff}',
    '#jx-gate .jx-err{margin-top:12px;min-height:16px;font-size:11.5px;letter-spacing:.04em;color:#ff4da6}',
    '#jx-gate .jx-foot{display:flex;justify-content:space-between;margin-top:26px;padding-top:16px;',
      'border-top:1px solid #2a1f4d;font-size:10px;letter-spacing:.1em;color:#5b4d80}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('jx-gate-style')) return;
    var s = document.createElement('style');
    s.id = 'jx-gate-style';
    s.textContent = GATE_CSS;
    (document.head || root).appendChild(s);
  }

  /* ---------- 门帘 UI ---------- */
  function showGate() {
    if (document.getElementById('jx-gate')) return;
    var box = document.createElement('div');
    box.id = 'jx-gate';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<div class="jx-box">' +
        '<div class="jx-tag">// access required</div>' +
        '<h1 class="jx-title">私人站点</h1>' +
        '<p class="jx-sub">这里不对外开放。输入访问密钥继续。</p>' +
        '<form class="jx-row" autocomplete="off">' +
          '<input class="jx-input" type="password" name="key" placeholder="ACCESS KEY" ' +
            'autocomplete="off" autocapitalize="off" spellcheck="false" required>' +
          '<button class="jx-btn" type="submit">ENTER</button>' +
        '</form>' +
        '<div class="jx-err" aria-live="polite"></div>' +
        '<div class="jx-foot"><span>PRIVATE / NO INDEX</span><span>JX-GATE 1.0</span></div>' +
      '</div>';
    document.body.appendChild(box);

    var form = box.querySelector('form');
    var input = box.querySelector('input');
    var err = box.querySelector('.jx-err');
    var tries = 0;

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = (input.value || '').trim();
      if (!val) return;
      if (sha256Hex(val) === KEY_HASH) {
        writeGrant();
        unlock();
      } else {
        tries++;
        err.textContent = tries > 2 ? '密钥不正确（连续失败 ' + tries + ' 次）' : '密钥不正确，请重试。';
        input.value = '';
        input.focus();
      }
    });
    try { input.focus(); } catch (e) {}
  }

  /* ---------- 启动 ---------- */
  injectStyle();
  if (readGrant()) {
    // 已授权：不锁，也不插入门帘
    return;
  }
  root.classList.add('jx-locked');

  function boot() { showGate(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
