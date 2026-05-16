# Jillax.github.io

个人主页 · 书影音清单 · 译制作品 · 随笔博客

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

## 豆瓣数据同步

书影音页面通过 GitHub Actions 每日自动从豆瓣同步数据：

1. 在 GitHub 仓库添加 `DOUBAN_COOKIE` Secret（你的豆瓣登录 Cookie）
2. 工作流每天 UTC 6:00 自动运行
3. 数据保存到 `data/bookshelf.json`

也可在 Actions 页面手动触发同步。

## 技术栈

- 纯静态 HTML / CSS / JavaScript
- GitHub Pages 托管
- GitHub Actions 定时任务
- marked.js Markdown 渲染
- Chart.js 数据可视化
- 不蒜子访问统计

## 设计

暖色调归档风格，支持明暗主题切换，CSS 变量驱动设计系统。