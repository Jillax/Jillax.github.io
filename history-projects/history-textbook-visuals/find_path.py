# -*- coding: utf-8 -*-
"""找到教材目录的多种尝试"""
import os
import glob

desktop = r"C:\Users\25382\Desktop"

# 方法1: 列出所有条目
print("=== Desktop 全部条目 ===")
try:
    items = os.listdir(desktop)
    for i, item in enumerate(items):
        full = os.path.join(desktop, item)
        is_dir = os.path.isdir(full)
        print(f"  [{i}] {'[DIR]' if is_dir else '[FILE]'} {repr(item)} [{len(item)} chars]")
except Exception as e:
    print(f"Error: {e}")

# 方法2: 用 os.walk 从 desktop 向下找
print("\n=== 从 Desktop 向下搜索 ===")
count = 0
for root, dirs, files in os.walk(desktop):
    if count > 50:
        print("  (截断)")
        break
    # 只深入第一层子目录
    depth = root.replace(desktop, '').count(os.sep)
    if depth > 2:
        dirs.clear()
        continue

    basename = os.path.basename(root)
    # 打印所有第一层子目录的内容
    if depth == 1:
        print(f"\n  [{basename}] ({len(dirs)} subdirs, {len(files)} files)")
        for d in dirs[:8]:
            print(f"    [DIR] {repr(d)}")
        for f in files[:8]:
            print(f"          {repr(f)}")
    count += 1