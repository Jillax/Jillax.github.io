#!/usr/bin/env python3
"""更换全站访问门禁密钥。

用法：
    python scripts/set_access_key.py                    # 自动生成新的强随机密钥
    python scripts/set_access_key.py --key 'my-key'     # 指定自定义密钥

脚本只把密钥的 SHA-256 写进 js/access-gate.js，明文不会落到仓库里。
改完请提交并推送；旧的 30 天免密授权需要访问 /?logout 才会失效。
"""
import argparse
import hashlib
import re
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GATE = ROOT / "js" / "access-gate.js"
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉易混淆的 I/O/0/1


def random_key():
    return "JX-" + "-".join(
        "".join(secrets.choice(ALPHABET) for _ in range(5)) for _ in range(4)
    )


def main():
    ap = argparse.ArgumentParser(description="更换站点访问密钥")
    ap.add_argument("--key", help="自定义密钥（不传则随机生成）")
    args = ap.parse_args()

    key = args.key.strip() if args.key else random_key()
    if not key:
        sys.exit("密钥不能为空")

    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    src = GATE.read_text(encoding="utf-8")
    new, n = re.subn(
        r"(var KEY_HASH = ')[0-9a-f]{64}(';)",
        lambda m: m.group(1) + digest + m.group(2),
        src,
        count=1,
    )
    if n != 1:
        sys.exit("未找到 KEY_HASH 常量，js/access-gate.js 可能被改过，请手动检查")
    GATE.write_text(new, encoding="utf-8", newline="")

    print("新密钥（请自行保存，仓库里不留明文）：")
    print("    " + key)
    print("SHA-256：" + digest)
    print("已更新：" + str(GATE))
    print("提示：让所有设备访问 https://jillax.github.io/?logout 可立即撤销旧的免密授权。")


if __name__ == "__main__":
    main()
