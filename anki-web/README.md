# 🧠 Anki-Web

> 浏览器端间隔重复记忆卡片应用，基于 SM-2 算法

[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue)](https://jillax.github.io/anki-web)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## ✨ 功能特性

- 🃏 **牌组管理** - 创建、编辑、删除牌组
- 📝 **卡片管理** - 创建、编辑、标星、标签分类
- 🔄 **SM-2 间隔重复算法** - 和 Anki 一样的核心算法
- 📊 **学习统计** - 复习热力图、卡片状态分布
- ⌨️ **快捷键** - 空格翻转，1-4 评分
- 📤 **导入/导出** - JSON 格式数据备份
- 📦 **预制牌组** - 内置中国历史知识卡片
- 💾 **IndexedDB 存储** - 关闭浏览器不丢数据
- 🌙 **暗色主题** - 护眼设计
- 📱 **响应式布局** - 手机端也能用

## 🚀 在线使用

直接访问：**https://jillax.github.io/anki-web**

## 🛠️ 本地运行

```bash
# 克隆仓库
git clone https://github.com/Jillax/anki-web.git
cd anki-web

# 用任意 HTTP 服务器启动（因为需要 fetch JSON）
python -m http.server 8080
# 或
npx serve .
```

然后打开 `http://localhost:8080`

## 📖 使用方法

1. 点击 **加载示例牌组** 或 **创建新牌组**
2. 添加卡片（正面=问题，背面=答案）
3. 点击 **开始学习**
4. 看到问题后回忆答案，点击翻转
5. 根据记忆程度评分：
   - **忘了(1)** - 完全忘记，1天后重来
   - **模糊(2)** - 有印象但不确定
   - **记住(3)** - 想起来了
   - **简单(4)** - 非常轻松

## ⌨️ 快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 翻转卡片 |
| `1` | 忘了 |
| `2` | 模糊 |
| `3` | 记住 |
| `4` | 简单 |

## 🧮 SM-2 算法

本应用使用 SuperMemo 2 算法来计算最佳复习间隔：

```
ease_factor = max(1.3, ease + 0.1 - (5-q) × (0.08 + (5-q) × 0.02))

Again(1): interval = 1天
Hard(2):  interval = 上次 × 1.2
Good(3):  interval = 上次 × ease_factor
Easy(4):  interval = 上次 × ease_factor × 1.3
```

## 📁 项目结构

```
anki-web/
├── index.html          # 主页面（SPA）
├── css/
│   └── style.css       # 样式
├── js/
│   ├── sm2.js          # SM-2 算法
│   ├── db.js           # IndexedDB 存储
│   └── app.js          # 应用逻辑
└── data/
    └── china-history.json  # 预制历史卡片
```

## 📄 License

MIT © [Jillax](https://github.com/Jillax)