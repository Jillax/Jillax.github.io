# -*- coding: utf-8 -*-
"""复制教材源文件到项目目录"""

import os
import shutil
import glob

# 源目录和项目目录
SRC = r"C:\Users\25382\Desktop\资料\高中教材"
DST = r"D:\AI Related\history-textbook-visuals\source-texts"

# 用 os.scandir 处理中文路径
print("=== 扫描源目录 ===")
try:
    entries = list(os.scandir(SRC))
    for e in entries:
        print(f"  {e.name}  ({os.path.getsize(e.path)} bytes)" if e.is_file() else f"  [{e.name}] (dir)")
except Exception as ex:
    print(f"扫描失败: {ex}")

print("\n=== 复制 .md 文件 ===")
md_files = [e for e in entries if e.is_file() and e.name.endswith('.md')]
for e in md_files:
    dst = os.path.join(DST, e.name)
    shutil.copy2(e.path, dst)
    print(f"  {e.name} -> {dst} ({os.path.getsize(e.path)} bytes)")

print("\n=== 查看 .md 文件内容预览 ===")
for e in md_files:
    mddst = os.path.join(DST, e.name)
    if os.path.exists(mddst):
        with open(mddst, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"\n--- {e.name} ({len(content)} 字符) ---")
        print(content[:1000])
        print("...")