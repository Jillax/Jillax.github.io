# -*- coding: utf-8 -*-
"""更精确地提取第1课正文"""
import re

with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到"第一单元"正文之后第一次出现的"第 1 课"
unit1_start = content.find('第一单元')
lesson1_section = content[unit1_start:]

# 找到这个区域里的"第 1 课"（跳过目录里的那个）
lines = lesson1_section.split('\n')
lesson_content = []
in_lesson1 = False
in_lesson2 = False

for i, line in enumerate(lines):
    s = line.strip()
    if '第 1 课' in s and '中华文明' in s:
        # 这可能是真正的第1课内容
        # 检查上下文：如果在它前面数十行内没有"第2课"，则是TOC的条目
        # 简单策略：找到有大量正文文本跟随的"第1课"
        in_lesson1 = True
        lesson_content.append(s)
        continue
    if in_lesson1:
        if '第 2 课' in s:
            break
        if s and not s.isdigit() and s not in ['统编版', '®'] and not s.startswith('▲') and not s.startswith('●'):
            lesson_content.append(s)

result = '\n'.join(lesson_content)

with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_纯净版.txt', 'w', encoding='utf-8') as f:
    f.write(result)

print(f"第1课正文: {len(result)} 字符")
print("="*50)
print(result[:2000])
print("\n...")
print(result[-500:])