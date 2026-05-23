# -*- coding: utf-8 -*-
"""清洗文本并输出预览到文件"""
import re

# 读取上策
with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 清洗：移除逐字换行（单字+换行模式）
# 教材PDF的特点是每个字后面都有换行
lines = content.split('\n')
cleaned_lines = []
buffer = ''
for line in lines:
    stripped = line.strip()
    if len(stripped) <= 1 and stripped not in '，。、；：？！""''（）《》—…·':
        # 可能是单字换行，积累起来
        buffer += stripped
    else:
        if buffer:
            cleaned_lines.append(buffer)
            buffer = ''
        if stripped:
            cleaned_lines.append(stripped)

if buffer:
    cleaned_lines.append(buffer)

cleaned = '\n'.join(cleaned_lines)

# 输出预览到文件
with open(r'D:\AI Related\history-textbook-visuals\source-texts\上册_预览.txt', 'w', encoding='utf-8') as f:
    f.write(f"总字符: {len(content)} -> 清洗后: {len(cleaned)}\n\n")
    f.write("="*60 + "\n")
    f.write("前5000字符预览\n")
    f.write("="*60 + "\n\n")
    f.write(cleaned[:5000])
    f.write("\n\n...\n\n")
    # 也输出一些关键词附近的内容
    for kw in ['分封', '宗法', '铁犁', '百家争鸣', '皇帝', '郡县', '丝绸之路']:
        idx = cleaned.find(kw)
        if idx > 0:
            f.write(f"\n{'='*60}\n")
            f.write(f"[{kw}] 出现位置: {idx}\n")
            f.write(f"{'='*60}\n")
            start = max(0, idx-100)
            end = min(len(cleaned), idx+300)
            f.write(cleaned[start:end] + "\n")

print("预览已保存到 上册_预览.txt")