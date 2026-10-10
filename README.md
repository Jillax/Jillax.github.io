# Jillax.github.io

个人主页 · 书影音游清单 · 译制作品 · 随笔博客 · AI 文本

归档风格的个人网站，托管于 GitHub Pages。100% 由 AI Agent 构筑。

---

## 站点结构

| 页面 | 说明 |
|------|------|
| `index.html` | 个人主页：Jillax 介绍、名言轮播、快捷导航 |
| `about.html` | 关于：个人简介、技能树、时间线、项目展示 |
| `portfolio.html` | 投资组合：Chart.js 可视化（总资产走势、资产配置、持仓明细） |
| `contact.html` | 联系方式：GitHub / Bilibili / 豆瓣 / 知乎 / 邮箱 |
| `share.html` | 画廊：AI 生成图像与数字创作，清单由 `assets/Image-Share/index.json` 驱动 |
| `projects.html` | 项目清单：各类个人项目展示 |
| `translations.html` | 译制作品清单：Bilibili 视频译制作品管理与展示 |
| `bookshelf.html` | 书影音游清单：豆瓣数据自动同步，含累计趋势折线图 |
| `anki-web/` | Anki Web：基于 IndexedDB 的浏览器端记忆卡复习（含中国历史卡组） |
| `history-projects/` | 教学工具子应用：时间线生成、战役推演、随堂投票等 |

### 博客页面（blog.html）

四个标签页：

| 标签 | 内容 | 说明 |
|------|------|------|
| 知乎想法 | 同步的知乎想法 | 官方 CLI 抓取，含时间、图片、互动数据 |
| 知乎文章 | 同步的知乎文章 | 官方 CLI 抓取，页内阅读全文 |
| AI 文本 | 深度分析文档 | 从 `thesis/` 读取，本地 Markdown |
| AI 摘录 | 对话摘录 | 从 `data/excerpts.json` 读取，本地 Markdown |

**特色功能：**
- 🔍 **全文搜索**：跨所有标签页实时搜索内容
- 📖 **阅读进度条**：阅读文章时顶部金色进度指示器
- 📷 **图片灯箱**：点击想法图片放大查看

## 书影音游（bookshelf.html）

展示书籍、电影、音乐、游戏的收藏清单，数据每日自动从豆瓣同步。

### 功能

- **四个分类标签**：书籍 / 电影 / 音乐 / 游戏
- **累计趋势折线图**：Chart.js 实现，展示分类下收藏量的累计增长曲线
- **评分分布**：各评分等级的柱状分布
- **评分筛选**：按 3★ / 4★ / 5★ 精确匹配
- **豆瓣封面代理**：通过 images.weserv.nl 代理加载豆瓣封面，解决防盗链问题

### 工作原理

1. GitHub Actions 每天 UTC 11:00（北京时间 19:00）自动运行
2. Python 脚本通过 Cookie 登录豆瓣，抓取用户标记为"已完成"的条目
3. 数据保存到 `data/bookshelf.json`，页面读取该 JSON 渲染

## 投资组合（portfolio.html）

使用 Chart.js 展示投资组合数据。

- **总资产走势折线图**：每次更新组合时新增时间点
- **资产配置环形图**：现金类 / 债券类 / 权益类 分布
- **持仓明细表**：分类展示各投资品种的成本、现值、盈亏、收益率
- **可展开子项**：点击品类展开查看各公司/基金明细

## 知乎同步

文本页的「知乎想法」「知乎文章」由知乎官方 CLI 同步。AI 文本和 AI 摘录仍是仓库里的本地 Markdown，不从知乎抓取。

### 同步内容

- **想法（Pins）**：`me contents --type pin`，正文、发布时间、图片、点赞和评论数
- **文章（Articles）**：`me contents --type article`，列表摘要加上 `me content` 补到的全文

已有全文会保留。只有本次拉到完整列表、且条数没有骤降时，才会把接口里消失的想法标成「已屏蔽」。空结果不会覆盖存档。

### 配置知乎 CLI

1. 打开 [知乎开放平台个人中心](https://developer.zhihu.com/profile)，登录后申请 Access Secret
2. 本地安装官方 CLI 后执行：

```bash
ZHIHU_ACCESS_SECRET="你的 Access Secret" node scripts/fetch-zhihu.mjs
```

3. GitHub Actions 使用仓库 Secret `ZHIHU_ACCESS_SECRET`。Actions 没有系统密钥链，Secret 只通过环境变量注入，不写入仓库

每次运行最多补拉 30 条缺失全文（`ZHIHU_DETAIL_BUDGET` 可改）。全文计入开放平台「创作能力」额度。

### 工作流程

1. GitHub Actions 每天 UTC 6:00（北京时间 14:00）运行
2. 从官方发布清单安装 `zhihu-cli`
3. 分页读取当前 Access Secret 所属账号的想法和文章
4. 按链接或发布时间对齐 `data/zhihu.json`，缺全文的条目再补拉
5. 有变化时提交 `data/zhihu.json`

## 译制作品（translations.html）

管理 Bilibili 视频译制作品清单。

- 展示已完成/译制中的作品
- 统计面板：总作品数、已发布数、总播放量、平均播放
- 搜索、排序（按时间/播放量）
- 标签筛选（已完成/译制中）

## 画廊（share.html）

展示 AI 生成图像与数字创作。**图片一律以 WebP 发布，原始 PNG/JPG 只保留在本地**，
不进版本控制（见 `.gitignore`）。

新增图片后重建索引即可，无需改动页面代码：

```bash
python scripts/build_gallery_index.py            # 仅重建 index.json
python scripts/build_gallery_index.py --convert  # 先把 PNG/JPG 转 WebP（需 Pillow），再重建
```

## 设计

暖色调归档风格，灵感来自旧纸张与藏书印。

- **双主题**：支持明暗主题切换，偏好保存在 `localStorage`
- **CSS 变量驱动**：统一的设计令牌系统（颜色、字体、间距）
- **字体**：英文衬线 `Fraunces` / `Spectral`，中文衬线 `Noto Serif SC`
- **响应式**：适配桌面端与移动端
- **页面过渡动画**：页面间切换淡入淡出效果
- **滚动浮现动画**：内容进入视口时渐入

### 色彩系统

| 令牌 | 暗色 | 亮色 |
|------|------|------|
| 背景 `--bg` | `#1a1714` 暖黑 | `#e6dfd4` 米白 |
| 文字 `--text` | `#ddd3c4` 暖白 | `#2b221a` 暖黑 |
| 金色 `--gold` | `#c4a35a` | `#b8963e` |
| 背景噪点 | SVG 颗粒纹理覆盖 | 同左 |

## 技术栈

- **纯静态**：HTML / CSS / JavaScript，无构建工具
- **托管**：GitHub Pages
- **自动化**：GitHub Actions 定时任务（支持 Token 远程触发）
- **博客渲染**：`marked.js` Markdown 渲染
- **图表可视化**：`Chart.js`（投资组合、累计趋势）
- **知乎同步**：官方 `zhihu-cli`（想法与文章）
- **数据抓取**：`Python` + `requests` + `BeautifulSoup`（豆瓣）
- **统计**：不蒜子访问统计
- **双主题**：深色暖黑与亮色米白双主题切换（`localStorage` 持久化）

## GitHub Actions 工作流

| 工作流 | 触发方式 | 说明 |
|--------|---------|------|
| 同步豆瓣书影音数据 | 定时 (UTC 11:00) / 手动 | 抓取豆瓣书籍/电影/音乐/游戏收藏 |
| 同步知乎想法 | 定时 (UTC 6:00) / 手动 | 用知乎官方 CLI 抓取想法和文章 |
| 同步译制作品数据 | 手动 | 更新 Bilibili 译制作品列表 |

## AI 文本（thesis/）

存放 AI 生成的深度分析文档，支持完整 Markdown 渲染阅读。

- 自动生成文档索引（`thesis/index.json`）
- 最新文档排在列表顶部
- 支持标签分类

## 本地开发

项目为纯静态文件，无需构建工具。直接在浏览器中打开 HTML 文件即可预览。

```bash
# 克隆仓库
git clone https://github.com/Jillax/Jillax.github.io.git

# 直接打开页面
open index.html
```

> 注意：豆瓣数据同步需要 Python 环境（requests + beautifulsoup4）。知乎同步需要 Node.js 和官方 `zhihu-cli`，凭证用 `ZHIHU_ACCESS_SECRET`。数据抓取脚本在 GitHub Actions 中自动运行。

## 部署

推送到 `main` 分支后，GitHub Pages 自动部署。同步工作流也监听该分支。

```bash
git push origin main
```

## 许可

© 2026 Jillax