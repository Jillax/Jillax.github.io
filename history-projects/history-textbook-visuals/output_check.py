# -*- coding: utf-8 -*-
"""输出检查 - 将结果写入文件避免终端编码问题"""
with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_纯净版.txt', 'r', encoding='utf-8') as f:
    content = f.read()

with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_输出检查.txt', 'w', encoding='utf-8') as out:
    out.write(f"总字符: {len(content)}\n")
    out.write("="*60 + "\n\n")
    out.write(content[:3000])
    out.write("\n\n...\n\n")
    out.write(content[-1000:])

print("OK - 已写入检查文件")