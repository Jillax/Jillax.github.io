# -*- coding: utf-8 -*-
"""
读取第1课内容并输出为干净文本
"""
import re

with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 清洗：整理文本行
lines = content.split('\n')
cleaned = []
for line in lines:
    s = line.strip()
    # 跳过纯数字页码、空行、格式标记
    if not s:
        continue
    if s.isdigit() and len(s) <= 4:
        continue
    if s in ['统编版', '®', 'PUTONG GAOZHONG JIAOKESHU', 'LISHI']:
        continue
    if s.startswith('▲') or s.startswith('●'):
        continue  # 图片标记
    cleaned.append(s)

text = '\n'.join(cleaned)

# 截取第1课内容（从"第1课"到"第2课"之前）
start = text.find('第 1 课')
end = text.find('第 2 课', start + 10)
lesson1 = text[start:end] if end > start else text[start:start+8000]

with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_纯净版.txt', 'w', encoding='utf-8') as f:
    f.write(lesson1)

print(f"第1课提取完成，共 {len(lesson1)} 字符")
print("=== 前1000字符 ===")
print(lesson1[:1000])
print("\n...\n=== 后1000字符 ===")
print(lesson1[-1000:])