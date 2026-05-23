# -*- coding: utf-8 -*-
"""智能分段清洗各课文本，输出到文件避免终端编码问题"""
import re, os

with open(r'D:\AI Related\history-textbook-visuals\source-texts\中外历史纲要（上）.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 清洗全部文本
cleaned = []
for s in lines:
    s = s.strip()
    if not s or s.isdigit() or s in ['统编版', '®', '']:
        continue
    if s.startswith('\u25b2') or s.startswith('\u25cf'):
        continue
    if 'PUTONG' in s or 'LISHI' in s:
        continue
    cleaned.append(s)

full_text = '\n'.join(cleaned)

# 找到每个"第 N 课"在正文中的位置
unit1_pos = full_text.find('\u7b2c\u4e00\u5355\u5143')  # 第一单元

lesson_positions = []
for m in re.finditer(r'\u7b2c (\d+) \u8bfe', full_text):  # 第 N 课
    pos = m.start()
    if pos > unit1_pos:
        line_start = full_text.rfind('\n', 0, pos) + 1
        line_end = full_text.find('\n', pos)
        title_line = full_text[line_start:line_end].strip()
        lesson_positions.append((int(m.group(1)), title_line, pos))

lesson_positions.sort()

# 切割并保存
output_dir = r'D:\AI Related\history-textbook-visuals\source-texts\上册'
for idx, (num, title, start_pos) in enumerate(lesson_positions):
    end_pos = lesson_positions[idx + 1][2] if idx + 1 < len(lesson_positions) else len(full_text)
    lesson_text = full_text[start_pos:end_pos].strip()

    filename = f"lesson_{num:02d}.txt"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(lesson_text)

# 输出统计到文件
with open(os.path.join(output_dir, '_index.txt'), 'w', encoding='utf-8') as f:
    for idx, (num, title, start_pos) in enumerate(lesson_positions):
        end_pos = lesson_positions[idx + 1][2] if idx + 1 < len(lesson_positions) else len(full_text)
        lesson_text = full_text[start_pos:end_pos].strip()
        f.write(f"Lesson {num:02d}: {len(lesson_text):>6} chars | {title}\n")

print("Done. Files saved.")