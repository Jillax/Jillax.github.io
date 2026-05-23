# -*- coding: utf-8 -*-
"""精确提取第1课正文"""
with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 实际第1课内容从line 354开始(单元导语)
# 第2课从line 991附近开始
# 我们先取line 354到line 980
lesson_lines = []
capture = False
for i, line in enumerate(lines):
    if i >= 350 and i < 990:
        s = line.strip()
        if not s or s.isdigit() or s in ['统编版', '®']:
            continue
        if s.startswith('▲') or s.startswith('●'):
            continue
        if '普通高中教科书' in s or 'PUTONG' in s or 'LISHI' in s:
            continue
        lesson_lines.append(s)

text = '\n'.join(lesson_lines)

with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_纯净版.txt', 'w', encoding='utf-8') as f:
    f.write(text)

with open(r'D:\AI Related\history-textbook-visuals\source-texts\第1课_预览.txt', 'w', encoding='utf-8') as f:
    f.write(f"第1课正文: {len(text)} 字符\n\n")
    f.write(text[:3000])
    f.write("\n\n...\n\n")
    f.write(text[-1000:])

print(f"OK - {len(text)} chars saved")