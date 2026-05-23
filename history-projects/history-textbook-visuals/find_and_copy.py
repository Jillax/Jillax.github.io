# -*- coding: utf-8 -*-
"""
精确找到教材目录并处理文件
"""
import os
import shutil

desktop = r"C:\Users\25382\Desktop"

# 列出 desktop 子目录，找到包含"高中教材"的那个
for name in os.listdir(desktop):
    full = os.path.join(desktop, name)
    if os.path.isdir(full):
        # 检查它是否包含 高中教材 子目录
        for sub in os.listdir(full):
            subfull = os.path.join(full, sub)
            if os.path.isdir(subfull) and '教材' in sub:
                print(f"找到教材目录: {repr(full)} -> {repr(sub)}")
                print(f"完整路径: {subfull}")

                # 列出其中的 .md 和 .pdf 文件
                print("\n--- 文件列表 ---")
                for f in os.listdir(subfull):
                    fpath = os.path.join(subfull, f)
                    if os.path.isfile(fpath):
                        size = os.path.getsize(fpath)
                        print(f"  {repr(f):50s} {size:>10,} bytes")

                # 复制 .md 文件
                dst_base = r"D:\AI Related\history-textbook-visuals\source-texts"
                print(f"\n--- 复制 .md 文件 ---")
                for f in os.listdir(subfull):
                    if f.endswith('.md'):
                        src = os.path.join(subfull, f)
                        dst = os.path.join(dst_base, f)
                        shutil.copy2(src, dst)
                        print(f"  已复制: {f}")

                # 读取 .md 文件预览
                print(f"\n--- .md 文件内容预览 ---")
                for f in os.listdir(subfull):
                    if f.endswith('.md'):
                        src = os.path.join(subfull, f)
                        with open(src, 'r', encoding='utf-8') as fp:
                            content = fp.read()
                        print(f"\n{'='*60}")
                        print(f"文件: {f} ({len(content)} 字符)")
                        print(f"{'='*60}")
                        print(content[:2000])
                        if len(content) > 2000:
                            print(f"\n... (剩余 {len(content)-2000} 字符)")
                break