# Jillax.github.io

个人主页 · 作品 · 阅读与译制 · 随笔

赛博朋克风格的个人网站，托管于 GitHub Pages。100% 由 AI Agent 构筑。

---

## 站点结构

主导航是五条通道，写在 `js/components.js`。

| 通道 | 入口 | 说明 |
|------|------|------|
| 首页 | `index.html` | 短介绍、三张首页作品、最近一条随笔或译制 |
| 关于 | `about.html` | 个人简介、画像；页底链到联系 |
| 作品 | `projects.html` | 卡片来自 `data/projects.json`。首页默认展示 `featured: true` 的三条可视化 |
| 阅读与译制 | `reading.html` | 总览，链到书影音和译制。这两页仍各自保留 |
| 随笔 / 联系 | `blog.html` | 随笔页和 `contact.html` 共用这一条导航 |

作品数据在 `data/projects.json`。加一个对象就会出现在作品页；把 `featured` 设为 `true` 会放到首页。

| 页面 | 说明 |
|------|------|
| `congress-portfolios/` | 申报上的美国：国会、总统、州长公开财产申报 |
| `dsa/` | 帐篷里的派系：美国民主社会主义者的架构与内部派系 |
| `sovereign-funds/` | 披露上的国家资本：各国主权基金公开持仓 |
| `ai-investment/` | 账本上的中美 AI：私人资本与国家资本 |
| `portfolio.html` | 投资组合：Chart.js 可视化（总资产走势、资产配置、持仓明细）。从作品页进入，不占顶栏 |
| `translations.html` | 译制作品清单：Bilibili 视频译制作品管理与展示 |
| `bookshelf.html` | 书影音游清单：豆瓣数据自动同步，含累计趋势折线图 |
| `contact.html` | 联系方式：GitHub / Bilibili / 豆瓣 / 知乎 / 邮箱 |

### 博客页面（blog.html）

四个标签页：

| 标签 | 内容 | 说明 |
|------|------|------|
| 文章 | 本地 Markdown 博客 | 从 `data/posts/` 读取，marked.js 渲染，支持全文阅读 |
| 知乎想法 | 同步的知乎想法 | 自动抓取展示，含时间/图片/互动数据 |
| 知乎文章 | 同步的知乎文章 | 自动抓取展示，含内联全文阅读器 |
| AI 文本 | 深度分析文档 | 从 `thesis/` 读取的 AI 生成分析报告 |

**特色功能：**
- 🔍 **全文搜索**：跨所有标签页实时搜索内容
- 📖 **阅读进度条**：阅读文章时顶部紫色进度指示器
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

通过 Playwright + Chromium 自动抓取知乎想法和文章。

### 同步内容

- **想法（Pins）**：最多 500 条，含正文、发布时间、图片、点赞/评论数
- **文章（Articles）**：自动抓取文章列表及完整正文

### 工作流程

1. GitHub Actions 每天 UTC 6:00（北京时间 14:00）运行
2. 使用 Playwright 无头浏览器加载知乎页面
3. DOM 提取想法数据（含时间从卡片文字中解析）
4. 知乎 API 获取文章列表
5. 逐篇通过专栏 API 获取完整正文
6. 数据保存到 `data/zhihu.json`（每次完全替换，不累积旧数据）

## 译制作品（translations.html）

管理 Bilibili 视频译制作品清单。

- 展示已完成/译制中的作品
- 统计面板：总作品数、已发布数、总播放量、平均播放
- 搜索、排序（按时间/播放量）
- 标签筛选（已完成/译制中）

## 设计

VA-11 Hall-A 式赛博朋克：深色底、霓虹紫与品红点缀。

- **CSS 变量驱动**：统一的设计令牌系统（颜色、字体、间距），见 `css/variables.css`
- **字体**：展示体 `Orbitron`，正文 `Rajdhani` / `Noto Sans SC`，等宽 `Share Tech Mono`，中文衬线 `Noto Serif SC`
- **响应式**：适配桌面端与移动端
- **页面过渡动画**：页面间切换淡入淡出效果
- **滚动浮现动画**：内容进入视口时渐入

### 色彩

| 令牌 | 色值 |
|------|------|
| 背景 `--bg` | `#0d0a1a` |
| 文字 `--text` | `#d4c8ef` |
| 主色 `--purple` | `#9b59ff` |
| 点缀 `--neon-pink` / `--neon-cyan` | `#ff4da6` / `#00e5ff` |

## 技术栈

- **纯静态**：HTML / CSS / JavaScript，无构建工具
- **托管**：GitHub Pages
- **自动化**：GitHub Actions 定时任务（支持 Token 远程触发）
- **博客渲染**：`marked.js` Markdown 渲染
- **图表可视化**：`Chart.js`（投资组合、累计趋势）
- **浏览器自动化**：`Playwright`（知乎内容抓取）
- **数据抓取**：`Python` + `requests` + `BeautifulSoup`（豆瓣）
- **统计**：不蒜子访问统计

## GitHub Actions 工作流

| 工作流 | 触发方式 | 说明 |
|--------|---------|------|
| 同步豆瓣书影音数据 | 定时 (UTC 11:00) / 手动 | 抓取豆瓣书籍/电影/音乐/游戏收藏 |
| 同步知乎想法 | 定时 (UTC 6:00) / 手动 | 抓取知乎想法（含正文+图片+时间+互动数据）和文章（含正文） |
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

> 注意：豆瓣数据同步需要 Python 环境（requests + beautifulsoup4），知乎同步需要 Node.js + Playwright。数据抓取脚本仅在 GitHub Actions 中自动运行。

## 部署

推送到 `main` 分支后，GitHub Pages 自动部署。同步工作流也监听该分支。

```bash
git push origin main
```

## 许可

© 2026 Jillax