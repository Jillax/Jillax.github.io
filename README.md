# Jillax.github.io

个人主页 · 作品 · 阅读与译制 · 随笔

历史学师范生的个人站，托管于 GitHub Pages。作品是公开数据可视化；阅读与译制收书影音和字幕；随笔与联系在同一条通道。全站暗底未来风：主站壳是 VA-11 气质，作品页共用同一片紫黑底、按题材保留自己的强调色。100% 由 AI Agent 构筑。

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
| `women/` | 世界的一半：60 国女性发展指标，世界银行 19 个可比指标，地图 + 五章拆解 |
| `dota/` | Dota 2 数据战报：OpenDota 个人战绩，英雄池 / 作息热力图 / 开黑搭子 / 聊天词云，每周自动同步 |
| `portfolio.html` | 投资组合：Chart.js 可视化（总资产走势、资产配置、持仓明细）。从作品页进入，不占顶栏 |
| `translations.html` | 译制作品清单：Bilibili 视频译制作品管理与展示 |
| `bookshelf.html` | 书影音游清单：豆瓣数据自动同步，含累计趋势折线图 |
| `contact.html` | 联系方式：GitHub / Bilibili / 豆瓣 / 知乎 / 邮箱 |

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

## Dota 2 数据战报（dota/）

把 OpenDota 上的个人战绩摊开：生涯总览、英雄池与绝活榜、逐月战况与作息热力图、最近 20 场、开黑搭子、聊天词云。纯静态：页面用原生 ESM（`analysis.js` 算指标、`charts.js` 画 SVG），不依赖第三方图表库。

- **数据**：`scripts/fetch_dota.mjs` 抓取 OpenDota 公开 API，产出 `data/dota/snapshot.json`（全部对局，含快速模式；英雄中文名与图标来自 Valve 数据接口与 Steam CDN）
- **更新**：GitHub Actions 每周一 UTC 03:17 自动同步，也可本地 `node scripts/fetch_dota.mjs`
- **测试**：`node dota/analysis.test.mjs`、`node dota/charts.test.mjs`
- **页面**：`dota/index.html` + `dota.css` + `dota.js`（控制器）+ `analysis.js`（纯函数分析）+ `charts.js`（纯函数 SVG 图表）

## 世界的一半（women/）

60 个主要国家的女性发展指标对比：教育、经济、政治、健康与安全、数字五个维度，19 个世界银行可比指标，1997 年到最新年份。首屏是可切指标的世界地图，往下每章一张排名图加三到四张读数卡。纯静态，图表全部是原生 SVG。

- **数据**：`scripts/fetch-women.mjs` 抓世界银行公开 API（无需 Key），产出 `women/data.js`；地图路径同脚本预投影成 SVG path 写入 `women/world.js`（Equal Earth 投影，无运行时依赖）
- **口径**：每个国家取指标定义窗口内最新的一年，页面上把年份一并标出；缺数不补、不插值、不自建合成指数
- **更新**：GitHub Actions 每月 5 日 UTC 04:00 只重跑数据；`node scripts/fetch-women.mjs`（加 `--data-only` / `--map-only`）可本地跑
- **页面**：`women/index.html` + `women.css` + `women/app.js`

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

## 设计

VA-11 Hall-A 式赛博朋克：深色底、霓虹紫与品红点缀。作品子页共用同一片紫黑底，但按题材保留自己的强调色族与排版。

- **两套令牌，同一种暗底**：主站壳用 `css/variables.css`；各作品页自包含，页内 `:root` 只保留 `--paper: #0d0a1a` / `--sheet: #16112b` / `--ink: #efe7ff` 这套暗底，语义色（党派红蓝、区域、章节颜料）保色相、只提亮到暗底可读
- **CSS 变量驱动**：统一的设计令牌系统（颜色、字体、间距），见 `css/variables.css`
- **字体**：展示体 `Orbitron`，正文 `Rajdhani` / `Noto Sans SC`，等宽 `Share Tech Mono`，中文衬线 `Noto Serif SC`
- **打印回退**：`shandong-fiscal/` 与 `women/` 在 `@media print` 里把令牌退回纸面油墨值，暗色不影响出纸
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
- **知乎同步**：官方 `zhihu-cli`（想法与文章）
- **数据抓取**：`Python` + `requests` + `BeautifulSoup`（豆瓣）
- **统计**：不蒜子访问统计

## GitHub Actions 工作流

| 工作流 | 触发方式 | 说明 |
|--------|---------|------|
| 同步豆瓣书影音数据 | 定时 (UTC 11:00) / 手动 | 抓取豆瓣书籍/电影/音乐/游戏收藏 |
| 同步知乎想法 | 定时 (UTC 6:00) / 手动 | 用知乎官方 CLI 抓取想法和文章 |
| 同步译制作品数据 | 手动 | 更新 Bilibili 译制作品列表 |
| 同步 Dota 2 数据 | 定时 (周一 UTC 03:17) / 手动 | 用 OpenDota 公开 API 抓取个人战绩快照 |
| 同步女性指标数据 | 定时 (每月 5 日 UTC 04:00) / 手动 | 用世界银行公开 API 更新 `women/data.js` |

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