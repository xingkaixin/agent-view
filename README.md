# Agent View

一个用于可视化和浏览 AI Agent 会话的工具。

## 特性

- 📊 会话列表展示，支持搜索
- 💬 会话详情页，展示完整的对话时间线
- 🪙 显示 Token 使用量和成本统计
- 🔧 工具调用可视化，支持展开/折叠
- 💭 思考过程展示
- 🎨 根据 Agent 类型自动显示对应图标

## 支持 Agent

- OpenCode
- Claude Code
- Codex
- Kimi-Cli

## 目录结构

```
.
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js              # 核心逻辑
├── config.js           # 模型和 Agent 配置
├── data/
│   └── sessions/       # 会话数据目录
│       ├── index.json  # 会话索引
│       └── *.json      # 会话文件
└── icon/
    ├── agent/          # Agent 图标
    └── provider/       # 模型厂商图标
```

## 使用方法

1. 将会话 JSON 文件放入 `data/sessions/` 目录
2. 运行构建脚本生成索引：`bun run build:index`
3. 使用任意静态服务器运行：`bun run build`

## URL 路由

- `#` - 会话列表页
- `#opencode/<slug>` - 特定会话详情页
