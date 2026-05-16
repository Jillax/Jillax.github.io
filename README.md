# Jillax.github.io

个人主页 · 书影音清单 · 译制作品 · 随笔博客

暖色调归档风格的个人网站，托管于 GitHub Pages。

---

## 站点结构

| 页面 | 说明 |
|------|------|
| `index.html` | 个人主页：关于我、笔墨项目、快捷导航 |
| `portfolio.html` | 投资组合（Chart.js 可视化） |
| `contact.html` | 联系方式：GitHub / Bilibili / 豆瓣 / 知乎 / 邮箱 |
| `share.html` | 文件分享（GitHub API 文件列表） |
| `translations.html` | 译制作品清单 |
| `bookshelf.html` | 书影音清单（豆瓣数据自动同步） |
| `blog.html` | 随笔博客（Markdown 渲染） |

## 设计

暖色调归档风格，灵感来自旧纸张与藏书印。

- **双主题**：支持明暗主题切换，偏好保存在 `localStorage`
- **CSS 变量驱动**：统一的设计令牌系统（颜色、字体、间距）
- **字体**：英文衬线 `Fraunces` / `Spectral`，中文衬线 `Noto Serif SC`
- **响应式**：适配桌面端与移动端

### 色彩系统

| 令牌 | 暗色 | 亮色 |
|------|------|------|
| 背景 `--bg` | `#181410` 暖黑 | `#f5f0e8` 米白 |
| 文字 `--text` | `#e4dbcc` 暖白 | `#2c2824` 暖黑 |
| 金色 `--gold` | `#c4a35a` | `#c4a35a` |
| 橄榄绿 `--olive` | `#7a8b6e` | `#6b8f71` |

## 技术栈

- **纯静态**：HTML / CSS / JavaScript，无构建工具
- **托管**：GitHub Pages
- **自动化**：GitHub Actions 定时任务
- **博客**：`marked.js` Markdown 渲染
- **图表**：`Chart.js` 投资组合可视化
- **统计**：不蒜子访问统计

## 豆瓣书影音同步

`bookshelf.html` 页面展示书籍、电影、音乐的收藏清单，数据每日自动从豆瓣同步。

### 工作原理

1. GitHub Actions 每天 UTC 6:00（北京时间 14:00）自动运行
2. Python 脚本通过 Cookie 登录豆瓣，抓取用户标记为"已完成"的条目
3. 数据保存到 `data/bookshelf.json`，页面读取该 JSON 渲染

### 设置方法

1. 登录豆瓣网页版，从浏览器开发者工具中复制 Cookie
2. 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：
   - **Secret**：`DOUBAN_COOKIE` → 你的豆瓣登录 Cookie
   - **Variable**（可选）：`DOUBAN_USER_ID` → 豆瓣用户 ID（默认 `233706855`）
3. 手动触发一次工作流验证：Actions → 同步豆瓣书影音数据 → Run workflow

> 不设置 Cookie 也能工作，但只会抓取用户主页上最近约 10 条条目。

### 数据格式

```json
{
  "updated": "2026-05-16T06:00:00Z",
  "books": [
    {
      "id": "1234567",
      "title": "书名",
      "author": "作者",
      "cover": "https://...",
      "url": "https://book.douban.com/subject/1234567/",
      "rating": 4,
      "tags": ["女性主义", "社会学"],
      "comment": "短评",
      "date": "2026-05-15",
      "status": "collect"
    }
  ],
  "movies": [...],
  "music": [...]
}
```

## 博客系统

`blog.html` 从 `data/posts/` 目录读取 Markdown 文件，通过 `marked.js` 渲染为 HTML 页面。文章列表索引保存在 `data/posts.json`。

## 本地开发

项目为纯静态文件，无需构建工具。直接在浏览器中打开 HTML 文件即可预览。

```bash
# 克隆仓库
git clone https://github.com/Jillax/Jillax.github.io.git

# 直接打开页面
open index.html
```

> 注意：豆瓣数据同步需要 Python 环境，仅在 GitHub Actions 中运行。本地测试可手动运行 `scripts/fetch_douban.py`。

## 部署

推送到 `main` 分支后，GitHub Pages 自动部署。同步工作流也监听该分支。

```bash
git push origin main
```

## 许可

© 2026 Jillax