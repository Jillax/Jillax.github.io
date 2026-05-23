# -*- coding: utf-8 -*-
"""用 glob 绕过编码问题扫描目录"""
import glob
import os

# 用 * 通配符绕过路径中的中文编码问题
base = r"C:\Users\25382\Desktop\*"
print("=== 扫描 Desktop 子目录 ===")
for p in glob.glob(base):
    name = os.path.basename(p)
    if os.path.isdir(p):
        print(f"  [DIR] {name}")

print("\n=== 尝试更多 pattern ===")
for p in glob.glob(r"C:\Users\25382\Desktop\*\*"):
    name = os.path.basename(p)
    parent = os.path.basename(os.path.dirname(p))
    if '教材' in name or '历史' in name or '历史' in parent or '教材' in parent:
        print(f"  {parent}/{name}  ({os.path.getsize(p) if os.path.isfile(p) else 'dir'})")