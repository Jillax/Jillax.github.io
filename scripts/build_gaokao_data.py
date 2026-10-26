# -*- coding: utf-8 -*-
"""生成 gaokao/data/*.js —— 山东高考志愿参考数据。

数据来源（山东省教育招生考试院官网，全部为官方附件）：
  投档表   山东省 2022—2026 年普通类常规批第 1 次志愿投档情况表（XLS）
  分段表   2022—2026 年夏季高考文化成绩一分一段表（XLS）

口径说明：
  * 常规批第 1 次志愿投档表逐「院校+专业」给出投档计划数与投档最低位次，
    官方附件不含投档最低分；本脚本用当年一分一段表（全体累计人数）把
    位次反推为分数：取累计人数 ≥ 位次的最高分段分数。同分同位次，反推唯一。
  * 2026 年投档表不带计划数，带「选考科目要求」列；其余年份相反。

用法：
  python scripts/build_gaokao_data.py            # 读取 scripts/data/gaokao/ 下的 XLS
  python scripts/build_gaokao_data.py --download # 缺哪个补哪个（从 sdzk.cn 官网下载）
输出：
  gaokao/data/meta.js      window.GAOKAO_META
  gaokao/data/td20XX.js    window.GAOKAO_TD["20XX"]（每年一个文件）
"""

import json
import os
import re
import sys
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "scripts", "data", "gaokao")
OUT_DIR = os.path.join(ROOT, "gaokao", "data")

YEARS = [2022, 2023, 2024, 2025, 2026]

# sdzk.cn 官方附件原始地址（与 scripts/data/gaokao/ 下的文件一一对应）
SOURCES = {
    "td": {
        2022: "https://www.sdzk.cn/Floadup/file/20220720/6379394386491280723406560.xls",
        2023: "https://www.sdzk.cn/Floadup/file/20230719/6382538122655052185031609.xls",
        2024: "https://www.sdzk.cn/Floadup/file/20240719/6385700532268895241675882.xls",
        2025: "https://www.sdzk.cn/Floadup/file/20250719/6388855130412530367357143.xls",
        2026: "https://www.sdzk.cn/Floadup/file/20260719/6392007688153010366643145.xls",
    },
    "band": {
        2022: "https://www.sdzk.cn/Floadup/file/20220626/6379183893483079468961719.xls",
        2023: "https://www.sdzk.cn/Floadup/file/20230625/6382330466178390033845468.xls",
        2024: "https://www.sdzk.cn/Floadup/file/20240625/6385492724297110442689837.xls",
        2025: "https://www.sdzk.cn/Floadup/file/20250625/6388646133710894671069456.xls",
        2026: "https://www.sdzk.cn/Floadup/file/20260625/6391799529165570082629463.xls",
    },
}

# ---------------------------------------------------------------- 院校分类 ----
# 层次：以教育部名单为准；校区（括号内容、分校）随母体。
TIER_985 = {
    "北京大学", "清华大学", "中国人民大学", "北京航空航天大学", "北京理工大学",
    "北京师范大学", "中国农业大学", "中央民族大学", "南开大学", "天津大学",
    "大连理工大学", "东北大学", "吉林大学", "哈尔滨工业大学", "复旦大学",
    "同济大学", "上海交通大学", "华东师范大学", "南京大学", "东南大学",
    "浙江大学", "中国科学技术大学", "厦门大学", "山东大学", "中国海洋大学",
    "武汉大学", "华中科技大学", "湖南大学", "中南大学", "国防科技大学",
    "中山大学", "华南理工大学", "四川大学", "电子科技大学", "重庆大学",
    "西安交通大学", "西北工业大学", "兰州大学", "西北农林科技大学",
}
TIER_211 = {
    "北京交通大学", "北京工业大学", "北京科技大学", "北京化工大学", "北京邮电大学",
    "北京林业大学", "北京中医药大学", "北京外国语大学", "中国传媒大学",
    "中央财经大学", "对外经济贸易大学", "北京体育大学", "中央音乐学院",
    "中国政法大学", "华北电力大学", "中国矿业大学", "中国石油大学",
    "中国地质大学", "天津医科大学", "河北工业大学", "太原理工大学",
    "内蒙古大学", "辽宁大学", "大连海事大学", "延边大学", "东北师范大学",
    "哈尔滨工程大学", "东北农业大学", "东北林业大学", "华东理工大学",
    "东华大学", "上海外国语大学", "上海财经大学", "上海大学", "海军军医大学",
    "第二军医大学", "苏州大学", "南京航空航天大学", "南京理工大学",
    "中国药科大学", "河海大学", "南京农业大学", "南京师范大学", "江南大学",
    "安徽大学", "合肥工业大学", "福州大学", "南昌大学", "郑州大学",
    "武汉理工大学", "华中农业大学", "华中师范大学", "中南财经政法大学",
    "湖南师范大学", "暨南大学", "华南师范大学", "广西大学", "海南大学",
    "四川农业大学", "西南交通大学", "西南财经大学", "西南大学", "贵州大学",
    "云南大学", "西藏大学", "西北大学", "西安电子科技大学", "长安大学",
    "陕西师范大学", "空军军医大学", "第四军医大学", "青海大学", "宁夏大学",
    "新疆大学", "石河子大学",
}
TIER_DOUBLE_FIRST = {  # 双一流中非 985/211 的高校
    "中国科学院大学", "首都师范大学", "外交学院", "中国人民公安大学",
    "中国音乐学院", "中央美术学院", "中央戏剧学院", "北京协和医学院",
    "天津工业大学", "天津中医药大学", "山西大学", "上海科技大学",
    "上海海洋大学", "上海中医药大学", "上海体育大学", "上海体育学院",
    "上海音乐学院", "南京邮电大学", "南京林业大学", "南京信息工程大学",
    "南京中医药大学", "南京医科大学", "中国美术学院", "宁波大学",
    "河南大学", "湘潭大学", "华南农业大学", "广州医科大学", "广州中医药大学",
    "南方科技大学", "成都理工大学", "西南石油大学", "成都中医药大学",
}

# 高校所在省份/城市的显式修正：名称里不直接带地名、或地名有歧义的
REGION_OVERRIDE = {
    "中国海洋大学": "山东", "国防科技大学": "湖南",
    "华东师范大学": "上海", "华东理工大学": "上海", "华东政法大学": "上海",
    "华东交通大学": "江西",
    "华北电力大学": "北京", "华北理工大学": "河北", "华北水利水电大学": "河南",
    "华中科技大学": "湖北", "华中师范大学": "湖北", "华中农业大学": "湖北",
    "中南大学": "湖南", "中南财经政法大学": "湖北", "中南民族大学": "湖北",
    "中南林业科技大学": "湖南",
    "东南大学": "江苏",
    "东北大学": "辽宁", "东北师范大学": "吉林", "东北林业大学": "黑龙江",
    "东北农业大学": "黑龙江", "东北财经大学": "辽宁", "东北电力大学": "吉林",
    "东北石油大学": "黑龙江",
    "西北工业大学": "陕西", "西北大学": "陕西", "西北农林科技大学": "陕西",
    "西北政法大学": "陕西", "西北师范大学": "甘肃", "西北民族大学": "甘肃",
    "西南大学": "重庆", "西南交通大学": "四川", "西南财经大学": "四川",
    "西南政法大学": "重庆", "西南民族大学": "四川", "西南石油大学": "四川",
    "西南科技大学": "四川", "西南医科大学": "四川", "西南林业大学": "云南",
    "电子科技大学": "四川",
    "中国矿业大学": "江苏", "中国地质大学": "湖北", "中国石油大学": "山东",
    "中国计量大学": "浙江", "中国美术学院": "浙江", "中国音乐学院": "北京",
    "中国戏曲学院": "北京", "中国民航大学": "天津",
    "中国民用航空飞行学院": "四川", "中国人民公安大学": "北京",
    "中国刑事警察学院": "辽宁", "中国劳动关系学院": "北京",
    "海军军医大学": "上海", "第二军医大学": "上海", "空军军医大学": "陕西",
    "第四军医大学": "陕西", "陆军军医大学": "重庆", "第三军医大学": "重庆",
    "陆军工程大学": "江苏", "海军工程大学": "湖北", "空军工程大学": "陕西",
    "海军航空大学": "山东", "陆军军事交通学院": "天津",
    "中央民族大学": "北京", "中央财经大学": "北京", "中央美术学院": "北京",
    "中央戏剧学院": "北京", "中央音乐学院": "北京", "中央司法警官学院": "河北",
    "外交学院": "北京", "国际关系学院": "北京", "中国青年政治学院": "北京",
    "中国科学院大学": "北京", "中国科学技术大学": "安徽",
    "中国人民警察大学": "河北", "消防救援学院": "北京",
}

# 山东省内本科高校（含民办/职业本科/异地校区），名称与投档表一致
SD_SCHOOLS = {
    "山东大学", "中国海洋大学", "中国石油大学", "哈尔滨工业大学", "山东科技大学",
    "青岛科技大学", "济南大学", "青岛理工大学", "山东建筑大学", "齐鲁工业大学",
    "山东理工大学", "山东农业大学", "青岛农业大学", "山东第一医科大学",
    "山东中医药大学", "潍坊医学院", "山东第二医科大学", "滨州医学院",
    "济宁医学院", "山东师范大学", "曲阜师范大学", "聊城大学", "鲁东大学",
    "临沂大学", "烟台大学", "青岛大学", "山东财经大学", "山东政法学院",
    "山东交通学院", "山东工商学院", "潍坊学院", "德州学院", "山东航空学院",
    "滨州学院", "泰山学院", "济宁学院", "菏泽学院", "枣庄学院", "山东管理学院",
    "山东青年政治学院", "山东女子学院", "齐鲁师范学院", "山东体育学院",
    "山东艺术学院", "山东工艺美术学院", "山东警察学院", "齐鲁理工学院",
    "青岛滨海学院", "烟台南山学院", "青岛工学院", "山东协和学院",
    "山东英才学院", "潍坊科技学院", "烟台理工学院", "青岛城市学院",
    "烟台科技学院", "泰山科技学院", "山东华宇工学院", "青岛黄海学院",
    "山东现代学院", "青岛电影学院", "山东工程职业技术大学",
    "山东外国语职业技术大学", "山东外事职业大学", "青岛职业技术大学",
    "潍坊理工学院", "山东石油化工学院", "山东农业工程学院",
}

PROVINCE_PATTERNS = [
    ("北京", r"北京"), ("上海", r"上海"), ("天津", r"天津"), ("重庆", r"重庆"),
    ("河北", r"河北|石家庄|保定|秦皇岛|唐山|廊坊|沧州|邯郸|张家口|承德|衡水|邢台"),
    ("山西", r"山西|太原|大同|晋中|长治|运城|临汾"),
    ("辽宁", r"辽宁|沈阳|大连|鞍山|抚顺|锦州|阜新|丹东|盘锦|葫芦岛|营口|辽阳|铁岭|朝阳"),
    ("吉林", r"吉林|长春|延边|延吉|四平|通化|白城|松原"),
    ("黑龙江", r"黑龙江|哈尔滨|齐齐哈尔|大庆|牡丹江|佳木斯|黑河"),
    ("江苏", r"江苏|南京|苏州|无锡|徐州|常州|扬州|镇江|南通|泰州|淮安|盐城|连云港|宿迁|昆山"),
    ("浙江", r"浙江|杭州|宁波|温州|嘉兴|金华|绍兴|湖州|台州|丽水|衢州|舟山|义乌"),
    ("安徽", r"安徽|合肥|芜湖|蚌埠|马鞍山|淮南|淮北|安庆|黄山|滁州|阜阳|六安"),
    ("福建", r"福建|福州|厦门|泉州|漳州|莆田|三明|南平|龙岩|宁德"),
    ("江西", r"江西|南昌|赣州|九江|上饶|宜春|吉安|抚州|景德镇|萍乡|新余|鹰潭"),
    ("山东", r"山东|青岛|济南|烟台|潍坊|临沂|淄博|泰安|济宁|威海|日照|德州|聊城|滨州|菏泽|枣庄|东营|曲阜"),
    ("河南", r"河南|郑州|洛阳|开封|新乡|焦作|许昌|南阳|商丘|信阳|周口|安阳|平顶山"),
    ("湖北", r"湖北|武汉|宜昌|荆州|襄阳|黄石|十堰|黄冈|孝感|咸宁"),
    ("湖南", r"湖南|长沙|株洲|湘潭|衡阳|岳阳|常德|郴州|益阳|永州|邵阳|张家界"),
    ("广东", r"广东|广州|深圳|珠海|汕头|佛山|江门|湛江|茂名|肇庆|惠州|东莞|中山|潮州|揭阳|汕尾|清远|韶关"),
    ("海南", r"海南|海口|三亚"),
    ("四川", r"四川|成都|绵阳|德阳|自贡|攀枝花|泸州|宜宾|南充|乐山|雅安|达州"),
    ("贵州", r"贵州|贵阳|遵义|都匀|凯里|安顺|毕节|铜仁"),
    ("云南", r"云南|昆明|大理|曲靖|玉溪|红河|丽江|保山|昭通|普洱"),
    ("陕西", r"陕西|西安|咸阳|宝鸡|延安|汉中|渭南|榆林|安康|商洛|杨凌"),
    ("甘肃", r"甘肃|兰州|天水|白银|庆阳|张掖|武威|酒泉|平凉"),
    ("青海", r"青海|西宁"),
    ("内蒙古", r"内蒙古|呼和浩特|包头|赤峰|通辽|鄂尔多斯|呼伦贝尔|乌海"),
    ("广西", r"广西|桂林|南宁|柳州|北海|梧州|玉林|百色|河池|钦州"),
    ("西藏", r"西藏|拉萨|林芝"),
    ("宁夏", r"宁夏|银川|石嘴山|吴忠|固原"),
    ("新疆", r"新疆|乌鲁木齐|石河子|克拉玛依|喀什|伊犁|昌吉|阿拉尔|库尔勒|塔里木"),
    ("香港", r"香港"), ("澳门", r"澳门"),
    # 地方简称前缀（放在精确名修正之后兜底）
    ("安徽", r"^皖"), ("江西", r"^赣"), ("云南", r"^滇"), ("贵州", r"^黔"),
    ("湖南", r"^湘"), ("湖北", r"^鄂"), ("甘肃", r"^陇"), ("福建", r"^闽"),
    ("海南", r"^琼"),
    ("山东", r"泰山|齐鲁|康复大学"),
]

# 名称里完全看不出地名的院校 → 省份（精确名匹配，优先于上面所有规则）
REGION_EXACT = {
    "中国人民大学": "北京", "清华大学": "北京", "复旦大学": "上海", "同济大学": "上海",
    "复旦大学医学院": "上海", "浙大城市学院": "浙江",
    "中国石油大学(北京)克拉玛依校区": "新疆",
    "南开大学": "天津", "东华大学": "上海", "江南大学": "江苏", "河海大学": "江苏",
    "长安大学": "陕西", "中国农业大学": "北京", "中国传媒大学": "北京",
    "中国政法大学": "北京", "中国药科大学": "江苏", "对外经济贸易大学": "北京",
    "暨南大学": "广东", "华侨大学": "福建", "集美大学": "福建", "仰恩大学": "福建",
    "闽南师范大学": "福建", "闽江大学": "福建", "闽江学院": "福建",
    "武夷学院": "福建", "阳光学院": "福建", "集美大学诚毅学院": "福建",
    "中国医科大学": "辽宁", "鲁迅美术学院": "辽宁", "渤海大学": "辽宁",
    "辽东学院": "辽宁", "中国计量大学现代科技学院": "浙江",
    "首都体育学院": "北京", "首都医科大学": "北京", "首都师范大学": "北京",
    "首都经济贸易大学": "北京", "中华女子学院": "北京", "北方工业大学": "北京",
    "中国社会科学院大学": "北京", "民政职业大学": "北京",
    "康复大学": "山东", "鲁东大学": "山东", "泰山学院": "山东",
    "泰山科技学院": "山东", "齐鲁医药学院": "山东",
    "南方医科大学": "广东", "南方科技大学": "广东", "星海音乐学院": "广东",
    "岭南师范学院": "广东", "嘉应学院": "广东", "韩山师范学院": "广东",
    "五邑大学": "广东", "华南理工大学": "广东", "华南师范大学": "广东",
    "华南农业大学": "广东",
    "燕山大学": "河北", "华北科技学院": "河北", "防灾科技学院": "河北",
    "应急管理大学": "河北", "华北理工大学冀唐学院": "河北",
    "华北理工大学轻工学院": "河北", "北华航天工业学院": "河北",
    "中北大学": "山西", "吕梁学院": "山西", "忻州师范学院": "山西",
    "北华大学": "吉林", "北方民族大学": "宁夏", "集宁师范学院": "内蒙古",
    "绥化学院": "黑龙江", "琼台师范学院": "海南",
    "三峡大学": "湖北", "三峡大学科技学院": "湖北", "长江大学": "湖北",
    "长江师范学院": "重庆", "汉口学院": "湖北", "江汉大学": "湖北",
    "汉江师范学院": "湖北", "武昌工学院": "湖北", "武昌理工学院": "湖北",
    "武昌首义学院": "湖北", "文华学院": "湖北", "荆楚理工学院": "湖北",
    "湘南学院": "湖南", "吉首大学": "湖南", "怀化学院": "湖南",
    "南华大学": "湖南", "南华大学船山学院": "湖南",
    "中南林业科技大学涉外学院": "湖南",
    "中原工学院": "河南", "豫北医学院": "河南", "黄淮学院": "河南",
    "漯河食品工程职业大学": "河南", "黄河水利职业技术大学": "河南",
    "黄河科技学院": "河南",
    "赣东学院": "江西", "赣南医学院": "江西", "赣南医科大学": "江西",
    "赣南师范大学": "江西", "赣南师范大学科技学院": "江西",
    "赣南科技学院": "江西", "东华理工大学": "江西", "井冈山大学": "江西",
    "豫章师范学院": "江西",
    "亳州学院": "安徽", "宿州学院": "安徽", "巢湖学院": "安徽", "池州学院": "安徽",
    "铜陵学院": "安徽", "皖西学院": "安徽", "皖江工学院": "安徽",
    "右江民族医学院": "广西", "北部湾大学": "广西", "贺州学院": "广西",
    "桂林旅游学院": "广西",
    "六盘水师范学院": "贵州", "兴义民族师范学院": "贵州", "茅台学院": "贵州",
    "黔南民族师范学院": "贵州",
    "滇池学院": "云南", "滇西应用技术大学": "云南", "滇西科技师范学院": "云南",
    "楚雄师范学院": "云南", "文山学院": "云南",
    "内江师范学院": "四川", "川北医学院": "四川", "西华大学": "四川",
    "西华师范大学": "四川", "西昌学院": "四川", "阿坝师范学院": "四川",
    "吉利学院": "四川", "西南交通大学希望学院": "四川",
    "西南财经大学天府学院": "四川",
    "河西学院": "甘肃", "陇东学院": "甘肃", "陇南师范学院": "甘肃",
    "西京学院": "陕西", "西北大学现代学院": "陕西",
    "三江学院": "江苏", "东南大学成贤学院": "江苏", "常熟理工学院": "江苏",
    "淮阴工学院": "江苏", "淮阴师范学院": "江苏", "金陵科技学院": "江苏",
    "中国矿业大学徐海学院": "江苏", "西交利物浦大学": "江苏",
}

TYPE_RULES = [
    ("师范", r"师范"),
    ("民族", r"民族"),
    ("军事", r"军医大学|陆军|海军|空军|火箭军|战略支援|国防科技大学|武警|消防"),
    ("政法", r"政法|公安|警察|司法|刑事|海关|外交学院|国际关系"),
    ("体育", r"体育"),
    ("艺术", r"艺术|美术|音乐|戏剧|戏曲|电影|舞蹈|传媒|影视|工艺美术|演艺"),
    ("语言", r"外国语|语言大学|语言职业"),
    ("医药", r"医科|医药|中医药|医学|药科|药学|护理|卫生|健康|康复|口腔"),
    ("财经", r"财经|财政|金融|经济|审计|贸易|商业|工商|商务|海关"),
    ("农林", r"农业|农林|林业|畜牧|兽医|茶叶"),
    ("理工", r"理工|工业|工程|科技|交通|邮电|电子|信息|航空航天|航空|航天|船舶|海洋工程|建筑|轻工|纺织|服装|计量|气象|电力|水利|矿业|石油|钢铁|冶金|机械|地质|自动化|城建|资源|能源|环境|安全|防灾"),
]

TYPE_OVERRIDE = {
    "中国海洋大学": "综合", "上海海洋大学": "农林", "大连海洋大学": "农林",
    "浙江海洋大学": "农林", "广东海洋大学": "农林", "江苏海洋大学": "农林",
    "海南热带海洋学院": "综合",
}


CAMPUS_SUFFIX_RE = re.compile(r"(?:威海|深圳|珠海|秦皇岛|克拉玛依|宣城|保定|舟山|烟台|荣昌|苏州|临沂)(?:校区|分校)$")


def base_name(name: str) -> str:
    """去掉括号里的校区/备注、结尾的「XX校区/XX分校」，用于层次与类型匹配。"""
    b = re.sub(r"[（(][^）)]*[)）]", "", name).strip()
    b = CAMPUS_SUFFIX_RE.sub("", b).strip()
    return b


def campus_region(name: str):
    """括号里的校区城市优先于本部城市：哈工大(威海)→山东。"""
    m = re.search(r"[（(]([^）)]*)[)）]", name)
    if m:
        inner = m.group(1)
        if not re.search(r"高校专项|地方专项|中外|预科|定向|委培|民族班|只招|裸分", inner):
            for prov, pat in PROVINCE_PATTERNS:
                if re.search(pat, inner):
                    return prov
    return None


def school_region(name: str) -> str:
    b = base_name(name)
    if name in REGION_EXACT:
        return REGION_EXACT[name]
    cam = campus_region(name)
    if cam:
        return cam
    if name in REGION_OVERRIDE:
        return REGION_OVERRIDE[name]
    for prov, pat in PROVINCE_PATTERNS:
        if re.search(pat, name):
            return prov
    if b in REGION_OVERRIDE:
        return REGION_OVERRIDE[b]
    return "其他"


def school_type(name: str) -> str:
    b = base_name(name)
    if name in TYPE_OVERRIDE:
        return TYPE_OVERRIDE[name]
    if b in TYPE_OVERRIDE:
        return TYPE_OVERRIDE[b]
    for label, pat in TYPE_RULES:
        if re.search(pat, b):
            return label
    return "综合"


def school_tier(name: str) -> str:
    b = base_name(name)
    if b in TIER_985:
        return "985"
    if b in TIER_211:
        return "211"
    if b in TIER_DOUBLE_FIRST:
        return "双一流"
    return "普通"


# ---------------------------------------------------------------- 解析函数 ----

def ensure_source(kind: str, year: int, do_download: bool) -> str:
    fname = ("" if kind == "td" else "f1_") + f"{year}.xls"
    path = os.path.join(SRC_DIR, fname)
    if not os.path.exists(path) and do_download:
        import urllib.request
        os.makedirs(SRC_DIR, exist_ok=True)
        url = SOURCES[kind][year]
        print(f"  下载 {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
            f.write(r.read())
    if not os.path.exists(path):
        sys.exit(f"缺少 {path}（可用 --download 从 sdzk.cn 获取）")
    return path


def find_header(df):
    for i in range(min(6, len(df))):
        cells = [str(c) for c in df.iloc[i].tolist() if c is not None and not (isinstance(c, float) and c != c)]
        joined = " ".join(cells)
        if "院校" in joined and "专业" in joined:
            row = [str(c) if c is not None and not (isinstance(c, float) and c != c) else "" for c in df.iloc[i].tolist()]
            return i, row
    sys.exit("找不到表头行（应包含「专业」「院校」列名）")


def map_cols(header_row):
    col = {}
    for i, h in enumerate(header_row):
        h = h.strip()
        if not h:
            continue
        if "专业" in h and "major" not in col:
            col["major"] = i
        elif "院校" in h and "school" not in col:
            col["school"] = i
        elif "计划" in h:
            col["plan"] = i
        elif "位次" in h:
            col["rank"] = i
        elif "选考" in h:
            col["xk"] = i
    if "major" not in col or "school" not in col or "rank" not in col:
        sys.exit(f"表头列不全: {header_row}")
    return col


SCHOOL_RE = re.compile(r"^([0-9A-Za-z]{2,6})([\u3400-\u9fff].*)$")
MAJOR_RE = re.compile(r"^([0-9A-Za-z]{1,3})\s*([\u3400-\u9fff].*)$")


def parse_td(year: int):
    """解析投档表，返回 [(school_code, school_name, major_code, major_name, plan, rank, xk)]"""
    import pandas as pd
    path = ensure_source("td", year, DOWNLOAD)
    df = pd.ExcelFile(path).parse(pd.ExcelFile(path).sheet_names[0], header=None)
    hdr_i, header_row = find_header(df)
    col = map_cols(header_row)
    out, skipped = [], []
    for r in range(hdr_i + 1, len(df)):
        s_raw = df.iat[r, col["school"]] if col["school"] < df.shape[1] else None
        m_raw = df.iat[r, col["major"]] if col["major"] < df.shape[1] else None
        if s_raw is None or m_raw is None:
            continue
        s_str, m_str = str(s_raw).strip(), str(m_raw).strip()
        if not s_str or s_str in ("nan", "None"):
            continue
        sm = SCHOOL_RE.match(s_str)
        mm = MAJOR_RE.match(m_str)
        if not sm or not mm:
            skipped.append((r, s_str, m_str))
            continue
        rank = pd.to_numeric(df.iat[r, col["rank"]], errors="coerce") if col["rank"] < df.shape[1] else None
        if (rank is None or (isinstance(rank, float) and rank != rank)) and col["rank"] < df.shape[1]:
            # 官方个别专业只公布「前50」「前50名」这类上限位次
            m = re.match(r"^前\s*(\d{1,4})\s*名?$", str(df.iat[r, col["rank"]]).strip())
            if m:
                rank = float(m.group(1))
        plan = pd.to_numeric(df.iat[r, col["plan"]], errors="coerce") if col.get("plan") is not None and col["plan"] < df.shape[1] else None
        xk = ""
        if col.get("xk") is not None and col["xk"] < df.shape[1]:
            v = df.iat[r, col["xk"]]
            xk = "" if v is None or (isinstance(v, float) and v != v) else str(v).strip()
        if rank is None or (isinstance(rank, float) and rank != rank):
            skipped.append((r, s_str, m_str))
            continue
        out.append((
            sm.group(1).upper(), sm.group(2).strip().replace("\u3000", " ").strip(),
            mm.group(1).upper(), mm.group(2).strip().replace("\u3000", " ").strip(),
            None if plan is None or (isinstance(plan, float) and plan != plan) else int(plan),
            int(rank), xk,
        ))
    if skipped:
        print(f"  {year}: 跳过 {len(skipped)} 行（表尾注释或无法解析）")
        for s in skipped[:5]:
            print("    例:", s)
    return out


def parse_band(year: int):
    """解析一分一段表，返回 [[score, cum], ...] 按分数降序（全体）。"""
    import pandas as pd
    path = ensure_source("band", year, DOWNLOAD)
    xl = pd.ExcelFile(path)
    df = None
    for s in xl.sheet_names:
        d = xl.parse(s, header=None)
        if d.shape[0] > 300:
            df = d
            break
    if df is None:
        sys.exit(f"{year} 一分一段表解析失败")
    rows = []
    for r in range(len(df)):
        v0, v1, v2 = df.iat[r, 0], df.iat[r, 1], df.iat[r, 2]
        try:
            score = int(float(v0))
            cum = int(float(v2))
        except (TypeError, ValueError):
            continue
        if 100 <= score <= 750 and cum > 0:
            rows.append([score, cum])
    rows.sort(key=lambda x: -x[0])
    # 累计人数应随分数下降单调不减；官方表个别段可能重复/乱序，做一遍净洗
    cleaned, last = [], 0
    for score, cum in rows:
        if cum > last:
            cleaned.append([score, cum])
            last = cum
    return cleaned


def rank_to_score(bands, rank: int):
    """位次 → 分数：累计人数 ≥ 位次的最高分段。"""
    lo, hi = 0, len(bands) - 1
    if rank > bands[-1][1]:
        return bands[-1][0]  # 超出表尾，取最低段
    if rank <= bands[0][1]:
        return bands[0][0]
    while lo < hi - 1:
        mid = (lo + hi) // 2
        if bands[mid][1] >= rank:
            hi = mid
        else:
            lo = mid
    return bands[hi][0]


def clean_name(name: str) -> str:
    """统一专业/院校名称：去多余空白、全角空格、结尾省略号。"""
    name = name.replace("\u3000", " ").strip()
    name = re.sub(r"\s*\.{3,}\s*$", "", name).strip()
    name = re.sub(r"\s{2,}", " ", name)
    return name


def norm_key(name: str) -> str:
    """专业名归一化连接键：去掉空格与各类标点（官方各年标点不统一）。"""
    return re.sub(r"[^0-9A-Za-z\u3400-\u9fff]", "", name)


SITE_SCOPE = re.compile(r"提前批|公费师范|优师|马院|委培师范|师范类")
SITE_EXCLUDE = re.compile(r"高校专项|地方专项|中外合作|综合评价|定向西藏|体育类|艺术类")


def load_site_files(main_keys):
    """读取 scripts/data/gaokao/site/*.json（高校官网补充数据，提前批等），
    与常规批主数据按（年份+专业名）去重后返回 GAOKAO_SITE 结构。"""
    site_dir = os.path.join(SRC_DIR, "site")
    if not os.path.isdir(site_dir):
        return {}
    out = {}
    for fn in sorted(os.listdir(site_dir)):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(site_dir, fn), encoding="utf-8") as f:
            d = json.load(f)
        school = d.get("school", "").strip()
        if not school:
            continue
        keys = main_keys.get(school, set())
        rows, skipped, dropped_scope = [], 0, 0
        for r in d.get("records", []):
            try:
                row = [
                    int(r["y"]), r.get("major", ""), r.get("type", ""),
                    r.get("batch", ""), r.get("campus", ""),
                    int(r["min"]), int(r["minRank"]),
                    r.get("plan"), r.get("avg"), r.get("max"), r.get("xk", ""),
                    r.get("adm"),
                ]
            except (KeyError, TypeError, ValueError):
                skipped += 1
                continue
            y, major, typ, batch = row[0], row[1], row[2], row[3]
            # 官网补充只收「提前批 + 师范类」口径：公费师范/优师专项/重点马院/委培师范/师范类。
            # 各校招生网同一页往往也挂常规批、高校专项、中外合作、综合评价与艺体类，
            # 那些要么主数据已有，要么位次口径不可比（艺体按综合分），这里统一挡掉。
            scope = typ + batch
            if not SITE_SCOPE.search(scope) or SITE_EXCLUDE.search(scope):
                dropped_scope += 1
                continue
            # 只按「专业+类型」判重：提前批的公费师范常常与常规批同名专业并存，
            # 那是两条不同的投档线，不能按专业名并掉。
            k_typed = (str(y), norm_key(major) + norm_key(typ))
            if k_typed in keys:
                skipped += 1
                continue
            keys.add(k_typed)
            rows.append(row)
        rows.sort(key=lambda x: (-x[0], x[6]))
        out[school] = {
            "src": d.get("src", ""), "srcUrl": d.get("srcUrl", ""),
            "fetched": d.get("fetched", ""), "note": d.get("note", ""),
            "rows": rows,
        }
        print(f"官网补充 {school}: 收录 {len(rows)} 条（跳过与主数据重复 {skipped} 条"
              + (f"，挡掉口径外 {dropped_scope} 条" if dropped_scope else "") + "）")
    return out


def main():
    global DOWNLOAD
    DOWNLOAD = "--download" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)
    updated = datetime.date.today().isoformat()

    # 1) 一分一段表
    bands = {}
    for y in YEARS:
        bands[str(y)] = parse_band(y)
        print(f"{y} 一分一段表: {len(bands[str(y)])} 段，最高分 {bands[str(y)][0][0]}，末段 {bands[str(y)][-1]}")

    # 2) 投档表
    td = {}
    schools = {}
    for y in YEARS:
        rows = parse_td(y)
        per_school = {}
        for sc, sn, mc, mn, plan, rank, xk in rows:
            sn, mn = clean_name(sn), clean_name(mn)
            if sc not in schools:
                schools[sc] = sn
            else:
                # 同代码不同名：保留较长/较新的名称
                if y == max(YEARS) or len(sn) > len(schools[sc]):
                    schools[sc] = sn
            per_school.setdefault(sc, []).append([mc, mn, rank, None if plan is None else plan, None, xk] if xk
                                                else [mc, mn, rank, None if plan is None else plan, None, ""])
        # 位次 → 分数
        b = bands[str(y)]
        n = 0
        for sc in per_school:
            for item in per_school[sc]:
                item[4] = rank_to_score(b, item[2])
                n += 1
        td[str(y)] = per_school
        print(f"{y} 投档表: {len(per_school)} 所院校 / {n} 条院校专业")

    # 3) 院校元数据
    meta_schools = {}
    unresolved = []
    for sc, sn in schools.items():
        prov = school_region(sn)
        if prov == "其他":
            unresolved.append(sn)
        sd = 1 if (prov == "山东" or base_name(sn) in SD_SCHOOLS) else 0
        meta_schools[sc] = {
            "n": sn, "tier": school_tier(sn), "type": school_type(sn),
            "prov": prov, "sd": sd,
        }
    if unresolved:
        print(f"未识别省份的院校 {len(unresolved)} 所:", "、".join(sorted(set(unresolved))[:40]))

    # 3.5) 高校官网补充数据（提前批等），与主数据去重
    main_keys = {}
    for y in YEARS:
        for sc, rows in td[str(y)].items():
            sn = schools[sc]
            mk = main_keys.setdefault(sn, set())
            for item in rows:
                mk.add((str(y), norm_key(item[1])))
    site = load_site_files(main_keys)

    # 4) 输出
    meta = {
        "updated": updated,
        "years": YEARS,
        "bands": bands,
        "schools": meta_schools,
    }
    with open(os.path.join(OUT_DIR, "meta.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 scripts/build_gaokao_data.py 自动生成，不要手改。数据来源：山东省教育招生考试院。 */\n")
        f.write("window.GAOKAO_META = ")
        f.write(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    for y in YEARS:
        with open(os.path.join(OUT_DIR, f"td{y}.js"), "w", encoding="utf-8") as f:
            f.write(f"/* 由 scripts/build_gaokao_data.py 自动生成，不要手改。 */\n")
            f.write('window.GAOKAO_TD = window.GAOKAO_TD || {};\n')
            f.write(f'window.GAOKAO_TD["{y}"] = ')
            f.write(json.dumps(td[str(y)], ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")
        size = os.path.getsize(os.path.join(OUT_DIR, f"td{y}.js"))
        print(f"写出 td{y}.js: {size/1024:.0f} KB")

    with open(os.path.join(OUT_DIR, "site.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 scripts/build_gaokao_data.py 自动生成，不要手改。来源：各校本科招生网。 */\n")
        f.write("window.GAOKAO_SITE = ")
        f.write(json.dumps(site, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print(f"写出 site.js: {len(site)} 所院校的官网补充数据")

    total = sum(len(v) for d in td.values() for v in d.values())
    print(f"合计 {len(schools)} 所院校 / {total} 条院校专业记录 → {OUT_DIR}")


if __name__ == "__main__":
    main()
