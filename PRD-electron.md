# ClipHistory - Electron 剪贴板历史桌面工具

## 概述
一个 Electron 桌面小工具，自动监控剪贴板变化，保存历史记录，支持搜索/收藏/拖动。启动后自动在桌面左上角显示一个浮动窗口。

## 风格参考
类似 VPN 客户端的风格：
- 浅灰/白色背景
- 绿色作为强调色
- 圆角卡片设计 (8-12px radius)
- 无衬线字体
- 扁平化图标
- 简洁干净，信息层级清晰

## 技术栈
- Electron (主进程 + 渲染进程)
- 原生 JavaScript/HTML/CSS (不需要 React/Vue, 简单应用保持轻量)
- electron-store 或 nedb 做本地存储

## 窗口规格
- 宽度: 420px
- 高度: 600px
- 无边框窗口 (frameless: true)
- 始终置顶 (alwaysOnTop: true)
- 启动时定位在桌面左上角 (x: 0, y: 30)
- 可拖动 (通过 HTML 拖拽区域实现)

## 核心功能

### 1. 剪贴板监控
- 使用 Electron 的 clipboard 模块定期检查 (每 500ms)
- 检测到新内容时自动保存
- 去重：相同内容不重复保存
- 忽略自身复制操作

### 2. 界面布局 (从上到下)
```
┌──────────────────────────────────┐
│ 🔍 搜索框 (placeholder: "搜索历史...") │
│──────────────────────────────────│
│ 📋 最新记录 (按时间倒序)            │
│   [时间] 内容预览...     ★         │
│   [时间] 内容预览...     ★         │
│   [时间] 内容预览...               │
│   ...                             │
│──────────────────────────────────│
│  底部: 共 N 条记录 | 🗑 清空      │
└──────────────────────────────────┘
```

### 3. 搜索框
- 实时过滤：输入即搜索
- 输入 `!` 前缀只显示星标项

### 4. 每条记录显示
- 左侧：时间戳 (如 "14:30" 或 "06-01 14:30")
- 中间：内容预览 (多行文本截断前1行)
- 右侧：星标按钮 (★/☆)
- 点击记录：复制内容到剪贴板 + 短暂提示"已复制"

### 5. 系统托盘 (Tray)
- 右键菜单：显示窗口 / 暂停监控 / 清空历史 / 退出
- 左键点击：切换窗口显示/隐藏

### 6. 快捷键
- Ctrl+Shift+V：切换窗口显示/隐藏

## 存储
- electron-store 或 nedb
- 字段: id, content, contentType(text/url), createdAt, isFavorite
- 自动清理 7 天前的记录

## 目录结构
```
clip-history-electron/
├── package.json
├── main.js          # Electron 主进程
├── renderer/
│   ├── index.html   # 主界面
│   ├── style.css    # 样式
│   └── app.js       # 界面逻辑
└── preload.js       # 预加载脚本 (安全通信)
```

## 编译
```bash
npm install
# 开发模式
npm start
# 打包成 exe
npm run build  # 使用 electron-builder
```

## 交付物
- ClipHistory Setup.exe (安装包) 放在 C:\Users\Todd\AppData\Local\clip-history\
- 或者提供 npm start 命令让用户启动
