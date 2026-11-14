#!/usr/bin/env python3
"""把访问门禁 + 去索引 meta + noscript 降级样式注入所有页面（幂等）。

新建页面后跑一次即可：
    python scripts/install_access_gate.py

注入位置：紧跟 <meta charset>，保证门禁脚本先于其它脚本执行，
且 charset 声明仍在文档最前面。会保留每个文件原有的换行风格（CRLF / LF）。
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ROBOTS = ('    <meta name="robots" content="noindex,nofollow,noarchive,'
          'nosnippet,noimageindex,max-snippet:0,max-image-preview:none">\n'
          '    <meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet">\n')
GATE = '    <script src="/js/access-gate.js"></script>\n'
NOSCRIPT = (
    '    <noscript id="jx-noscript"><style>'
    'html{background:#0d0a1a}'
    'body>*{display:none!important}'
    'body::before{content:"ACCESS DENIED / JavaScript required";position:fixed;inset:0;'
    'display:flex;align-items:center;justify-content:center;background:#0d0a1a;'
    'color:#9b59ff;font-family:monospace;font-size:13px;letter-spacing:.1em}'
    '</style></noscript>\n'
)

HEAD_RE = re.compile(r'(<head\b[^>]*>\s*\n)', re.I)
CHARSET_RE = re.compile(r'(^[ \t]*<meta\s+charset=["\'][^"\']+["\']\s*/?>[ \t]*\n)', re.I | re.M)


def main():
    pages = sorted(
        p for p in ROOT.rglob("*.html")
        if "tmp" not in p.relative_to(ROOT).parts
        and ".git" not in p.relative_to(ROOT).parts
    )
    changed = []
    for page in pages:
        raw = page.read_bytes()
        had_bom = raw.startswith(b"\xef\xbb\xbf")
        text = raw.decode("utf-8-sig").replace("\r\n", "\n")
        crlf = raw.count(b"\r\n") > raw.count(b"\n") - raw.count(b"\r\n")
        newline = "\r\n" if crlf else "\n"

        additions = []
        if "access-gate.js" not in text:
            additions.append(GATE)
        if 'name="robots"' not in text:
            additions.append(ROBOTS)
        if 'id="jx-noscript"' not in text:
            additions.append(NOSCRIPT)
        if not additions:
            continue

        block = "".join(additions)
        m = CHARSET_RE.search(text)
        if m:
            text = text[:m.end()] + block + text[m.end():]
        else:
            m2 = HEAD_RE.search(text)
            if not m2:
                print("跳过（找不到 <head>）：" + str(page))
                continue
            text = text[:m2.end()] + block + text[m2.end():]

        text = text.replace("\n", newline)
        out = text.encode("utf-8")
        if had_bom:
            out = b"\xef\xbb\xbf" + out
        page.write_bytes(out)
        changed.append(str(page.relative_to(ROOT)))

    print("已注入 %d 个页面：" % len(changed))
    for p in changed:
        print("  " + p)
    print("共扫描 %d 个 HTML 文件。" % len(pages))


if __name__ == "__main__":
    main()
