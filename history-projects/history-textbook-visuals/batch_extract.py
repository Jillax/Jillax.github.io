# -*- coding: utf-8 -*-
"""批量提取各课正文到单独文件"""
import re

with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到所有"第 N 课"的位置（正文中的，不是目录中的）
# 策略：找到"第 N 课"之后跟着课程名称的文本块
lessons = []
current_lesson = None
current_lines = []
capture = False

for i, line in enumerate(lines):
    s = line.strip()

    # 检测新课开始（在正文区，且是"第 N 课"格式）
    if re.match(r'^第 \d+ 课', s) and i > 150:  # i>150 跳过目录
        if current_lesson:
            lessons.append((current_lesson, current_lines))
        current_lesson = s
        current_lines = [s]
        capture = True
        continue

    if capture:
        # 排除干扰行
        if not s or s.isdigit() or s in ['统编版', '®', '']:
            continue
        if s.startswith('▲') or s.startswith('●'):
            continue
        if '普通高中教科书' in s or 'PUTONG' in s or 'LISHI' in s:
            continue
        if '中外历史纲要' in s and '上' in s:
            continue
        current_lines.append(s)

# 最后一课
if current_lesson:
    lessons.append((current_lesson, current_lines))

print(f"共提取到 {len(lessons)} 课")
for title, lns in lessons:
    text = '\n'.join(lns)
    print(f"  {title}: {len(text)} 字符")

# 保存到文件
import os
output_dir = r'D:\AI Related\history-textbook-visuals\source-texts\上册'
for title, lns in lessons:
    # 提取课号
    match = re.match(r'第 (\d+) 课', title)
    if match:
        num = match.group(1)
        # 提取课名（去掉"第 N 课"后的部分）
        name = title.replace(f'第 {num} 课', '').strip()
        filename = f"第{num}课_{name}.txt"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lns))
        print(f"  已保存: {filename}")