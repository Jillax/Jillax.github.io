# -*- coding: utf-8 -*-
"""
提取《中外历史纲要》上下册教材文本
输出：按课分割的结构化 Markdown 文件
"""

import fitz
import os
import re

# 配置
PDF_DIR = r"C:\Users\25382\Desktop\资料\高中教材"
OUTPUT_DIR = r"D:\AI Related\history-textbook-visuals\source-texts"

VOLUMES = {
    "上册": os.path.join(PDF_DIR, "中外历史纲要（上）.pdf"),
    "下册": os.path.join(PDF_DIR, "中外历史纲要（下）.pdf"),
}

# 上册目录结构（已知的课名，用于分割检测）
LESSONS_UPPER = [
    ("第一单元", "从中华文明起源到秦汉统一多民族封建国家的建立与巩固"),
    ("第1课", "中华文明的起源与早期国家"),
    ("第2课", "诸侯纷争与变法运动"),
    ("第3课", "秦统一多民族封建国家的建立"),
    ("第4课", "西汉与东汉——统一多民族封建国家的巩固"),
    ("第二单元", "三国两晋南北朝的民族交融与隋唐统一多民族封建国家的发展"),
    ("第5课", "三国两晋南北朝的政权更迭与民族交融"),
    ("第6课", "从隋唐盛世到五代十国"),
    ("第7课", "隋唐制度的变化与创新"),
    ("第8课", "三国至隋唐的文化"),
    ("第三单元", "辽宋夏金多民族政权的并立与元朝的统一"),
    ("第9课", "两宋的政治和军事"),
    ("第10课", "辽夏金元的统治"),
    ("第11课", "辽宋夏金元的经济与社会"),
    ("第12课", "辽宋夏金元的文化"),
    ("第四单元", "明清中国版图的奠定与面临的挑战"),
    ("第13课", "从明朝建立到清军入关"),
    ("第14课", "清朝前中期的鼎盛与危机"),
    ("第15课", "明至清中叶的经济与文化"),
    ("第五单元", "晚清时期的内忧外患与救亡图存"),
    ("第16课", "两次鸦片战争"),
    ("第17课", "国家出路的探索与列强侵略的加剧"),
    ("第18课", "挽救民族危亡的斗争"),
    ("第六单元", "辛亥革命与中华民国的建立"),
    ("第19课", "辛亥革命"),
    ("第20课", "北洋军阀统治时期的政治、经济与文化"),
    ("第七单元", "中国共产党成立与新民主主义革命兴起"),
    ("第21课", "五四运动与中国共产党的诞生"),
    ("第22课", "南京国民政府的统治和中国共产党开辟革命新道路"),
    ("第八单元", "中华民族的抗日战争和人民解放战争"),
    ("第23课", "从局部抗战到全面抗战"),
    ("第24课", "全民族浴血奋战与抗日战争的胜利"),
    ("第25课", "人民解放战争"),
    ("第九单元", "中华人民共和国成立和社会主义革命与建设"),
    ("第26课", "中华人民共和国成立和向社会主义的过渡"),
    ("第27课", "社会主义建设在探索中曲折发展"),
    ("第十单元", "改革开放与社会主义现代化建设新时期"),
    ("第28课", "中国特色社会主义道路的开辟与发展"),
    ("第29课", "改革开放以来的巨大成就"),
]

LESSONS_LOWER = [
    ("第一单元", "古代文明的产生与发展"),
    ("第1课", "文明的产生与早期发展"),
    ("第2课", "古代世界的帝国与文明的交流"),
    ("第二单元", "中古时期的世界"),
    ("第3课", "中古时期的欧洲"),
    ("第4课", "中古时期的亚洲"),
    ("第5课", "古代非洲与美洲"),
    ("第三单元", "走向整体的世界"),
    ("第6课", "全球航路的开辟"),
    ("第7课", "全球联系的初步建立与世界格局的演变"),
    ("第四单元", "资本主义制度的确立"),
    ("第8课", "欧洲的思想解放运动"),
    ("第9课", "资产阶级革命与资本主义制度的确立"),
    ("第五单元", "工业革命与马克思主义的诞生"),
    ("第10课", "影响世界的工业革命"),
    ("第11课", "马克思主义的诞生与传播"),
    ("第六单元", "世界殖民体系与亚非拉民族独立运动"),
    ("第12课", "资本主义世界殖民体系的形成"),
    ("第13课", "亚非拉民族独立运动"),
    ("第七单元", "两次世界大战、十月革命与国际秩序的演变"),
    ("第14课", "第一次世界大战与战后国际秩序"),
    ("第15课", "十月革命的胜利与苏联的社会主义实践"),
    ("第16课", "亚非拉民族民主运动的高涨"),
    ("第17课", "第二次世界大战与战后国际秩序的形成"),
    ("第八单元", "20世纪下半叶世界的新变化"),
    ("第18课", "冷战与国际格局的演变"),
    ("第19课", "资本主义国家的新变化"),
    ("第20课", "社会主义国家的发展与变化"),
    ("第21课", "世界殖民体系的瓦解与新兴国家的发展"),
    ("第九单元", "当代世界发展的特点与主要趋势"),
    ("第22课", "世界多极化与经济全球化"),
    ("第23课", "和平发展合作共赢的时代潮流"),
]


def extract_text_by_page(pdf_path, output_dir, volume_name):
    """提取PDF所有页面文本，同时输出完整文本和按页分割的文本"""
    print(f"\n{'='*60}")
    print(f"处理：{volume_name}")
    print(f"文件：{pdf_path}")
    print(f"{'='*60}")

    if not os.path.exists(pdf_path):
        print(f"[ERROR] 文件不存在: {pdf_path}")
        return

    doc = fitz.open(pdf_path)
    print(f"总页数：{doc.page_count}")

    # --- 尝试读取目录 ---
    toc = doc.get_toc()
    if toc:
        print(f"内置目录条目数：{len(toc)}")
        for item in toc[:30]:
            print(f"  {'  ' * (item[0]-1)}Level{item[0]}: {item[1]} (p.{item[2]})")
    else:
        print("无内置目录")

    # --- 全量文本输出 ---
    full_text = []
    for i, page in enumerate(doc):
        text = page.get_text()
        full_text.append(f"\n\n===== 第{i+1}页 =====\n{text}")

    # 保存完整文本
    full_file = os.path.join(output_dir, volume_name, f"{volume_name}_全文.md")
    with open(full_file, "w", encoding="utf-8") as f:
        f.write(f"# 《中外历史纲要（{volume_name}）》全文提取\n\n")
        f.write(f"来源：{pdf_path}\n")
        f.write(f"总页数：{doc.page_count}\n")
        f.write(f"提取时间：{__import__('datetime').datetime.now()}\n\n")
        f.write("".join(full_text))
    print(f"全文已保存：{full_file}")

    # --- 按页分割保存（方便逐课处理） ---
    pages_dir = os.path.join(output_dir, volume_name, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    for i, page in enumerate(doc):
        text = page.get_text()
        page_file = os.path.join(pages_dir, f"p{i+1:03d}.md")
        with open(page_file, "w", encoding="utf-8") as f:
            f.write(f"# 第{i+1}页\n\n{text}")
    print(f"逐页文件已保存至：{pages_dir}")

    # --- 打印前20页预览，方便判断课时边界 ---
    print(f"\n--- 前20页内容预览 ---")
    for i in range(min(20, doc.page_count)):
        text = doc[i].get_text()
        preview = text.strip()[:200].replace("\n", " | ")
        print(f"  p{i+1:03d}: {preview}...")

    doc.close()
    return toc


def segment_by_lessons(volume_name, lessons):
    """基于已知的课名列表，手动标记每课对应的页码范围"""
    pages_dir = os.path.join(OUTPUT_DIR, volume_name, "pages")
    lesson_file = os.path.join(OUTPUT_DIR, volume_name, f"{volume_name}_课时索引.md")

    # 读取所有页面，检测课名出现位置
    lesson_pages = {}  # lesson_keyword -> list of page numbers
    current_lesson = "前言/目录"

    for p in range(1, 300):  # 扫描前300页
        page_file = os.path.join(pages_dir, f"p{p:03d}.md")
        if not os.path.exists(page_file):
            break
        with open(page_file, "r", encoding="utf-8") as f:
            content = f.read()

        # 检查是否匹配某课开头
        for keyword, title in lessons:
            # 匹配 "第N课" 或 "第N课 XXXX" 模式
            pattern = f"第\\d+课.*{keyword.replace('第', '').replace('课', '') if keyword.startswith('第') else keyword}"
            match = re.search(keyword, content[:500])
            if match:
                if current_lesson != f"{keyword} {title}":
                    if current_lesson not in lesson_pages:
                        lesson_pages[current_lesson] = []
                    lesson_pages[current_lesson].append(f"p{p}")
                    current_lesson = f"{keyword} {title}"
                break

    # 保存索引
    with open(lesson_file, "w", encoding="utf-8") as f:
        f.write(f"# 《中外历史纲要（{volume_name}）》课时-页码索引\n\n")
        for lesson, pages in lesson_pages.items():
            f.write(f"- {lesson}: {', '.join(pages)}\n")
    print(f"课时索引已保存：{lesson_file}")


if __name__ == "__main__":
    # 处理上册
    extract_text_by_page(VOLUMES["上册"], OUTPUT_DIR, "上册")

    # 处理下册
    extract_text_by_page(VOLUMES["下册"], OUTPUT_DIR, "下册")

    print("\n\n=== 提取完成！===")
    print(f"输出目录：{OUTPUT_DIR}")