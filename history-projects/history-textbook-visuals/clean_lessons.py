# -*- coding: utf-8 -*-
"""更智能地分段清洗各课文本"""
import re, os

with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 第一步：清洗全部文本（合并逐字换行）
cleaned = []
for i, line in enumerate(lines):
    s = line.strip()
    if not s or s.isdigit() or s in ['统编版', '®', '']:
        continue
    if s.startswith('▲') or s.startswith('●'):
        continue
    if '普通高中教科书' in s or 'PUTONG' in s or 'LISHI' in s:
        continue
    cleaned.append(s)

full_text = '\n'.join(cleaned)

# 第二步：找到每个"第 N 课"的实际位置（跳过目录区）
# 目录在第一个"第一单元"之前
unit1_pos = full_text.find('第一单元')

# 找到各个课在正文中的位置
lesson_positions = []
for m in re.finditer(r'第 (\d+) 课', full_text):
    pos = m.start()
    # 只取在单元正文之后的（跳过目录）
    if pos > unit1_pos:
        # 取课名：从"第N课"到下一个换行
        line_start = full_text.rfind('\n', 0, pos) + 1
        line_end = full_text.find('\n', pos)
        title_line = full_text[line_start:line_end].strip()
        lesson_positions.append((int(m.group(1)), title_line, pos))

lesson_positions.sort()

# 第三步：按课切割并保存
output_dir = r'D:\AI Related\history-textbook-visuals\source-texts\上册'
for idx, (num, title, start_pos) in enumerate(lesson_positions):
    # 课结束位置 = 下一课开始
    if idx + 1 < len(lesson_positions):
        end_pos = lesson_positions[idx + 1][2]
    else:
        end_pos = len(full_text)

    lesson_text = full_text[start_pos:end_pos].strip()

    # 保存
    filename = f"lesson_{num:02d}_{title[:20]}.txt"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(lesson_text)

    # 预览前100字符
    preview = lesson_text[:100].replace('\n', ' ')
    print(f"第{num}课: {len(lesson_text):>6}字符 | {preview}...")

print(f"\n共处理 {len(lesson_positions)} 课")