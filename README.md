# Mnemo

本地优先的桌面间隔记忆规划器，基于艾宾浩斯遗忘曲线。Electron + React + TypeScript。

## 功能

- **多计划管理** — 创建学习计划或事项计划，自定义起始日期、天数、复习间隔（默认 1/2/4/7/15/30 天）和配色
- **自动排程** — 添加知识点时自动按间隔生成复习排程，逾期条目自动顺延不丢失
- **今日任务** — 勾选完成、反馈记忆状态（记住/模糊/遗忘）、延期、跳过；模糊和遗忘自动生成补救条目
- **笔记系统** — 每个知识点绑定 TipTap Markdown 编辑器，支持 GFM 语法，可导出为 Markdown 文件
- **月历视图** — 按日历查看所有计划的新增与复习安排
- **薄弱追踪** — 遗忘或模糊的知识点自动标记"薄弱"，进度页集中查看和复习
- **标签筛选** — 笔记页按标签组织和搜索，支持批量导出
- **外观主题** — 内置霜灰、墨蓝、炭墨、茶白四套配色方案，计划独立配色
- **数据备份** — JSON 格式导出/导入，含计划、知识点、笔记、完成状态
- **系统托盘** — 支持最小化到托盘、开机自启

## 环境

Node.js ≥ 22

## 开发

```bash
npm install
npm run desktop        # Electron 开发模式（完整功能）
npm run dev            # 仅浏览器（无备份、托盘等 IPC 功能）
npm test               # 单元测试
```

## 打包

```bash
npm run pack           # 输出 NSIS 安装包到 release/
```

## 旧版数据迁移

0.1.x 及更早版本把数据保存在 Chromium localStorage（上限约 10 MB），新版本改用 `<userData>/state.json`（无上限，原子写）。升级后如果发现数据没有出现，在关闭 Mnemo 后执行一次：

```bash
npm run migrate-legacy                             # 默认 userData 路径
npm run migrate-legacy -- --userData "<自定义路径>"  # 便携版请传 release/win-unpacked/user-data
```

脚本会临时启动一个无界面的 Electron 进程，从 localStorage 读出旧数据并写入 `state.json`，现有 `state.json` 会备份为 `state.json.pre-migration-<时间戳>`。

## 技术栈

Electron · React 19 · Vite · TypeScript · TipTap · Vitest

## 许可

[MIT](LICENSE) · 第三方依赖见 [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)
