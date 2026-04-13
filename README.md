# DOSIA Official Plugins

DOSIA 官方插件市场 — 9 个产品自带的插件，可通过 DOSIA 桌面应用的"插件市场"一键安装。

## 包含的插件

| 插件 | 说明 |
|------|------|
| **feishu** | 飞书集成（19 个 skill），通过 lark-cli 操作消息、文档、表格、任务、日历、邮件、会议、知识库 |
| **browser-automation** | Chrome 浏览器自动化，跨平台内容获取与发布 |
| **audio-processing** | 音频转写（腾讯云 COS + 火山引擎 ASR） |
| **content-analysis** | 小红书笔记多维度拆解与评分 |
| **meeting-intelligence** | 会议智能分析、结构化记录、提案审批 |
| **team-knowledge** | 团队知识库（公司价值观、SOP、方法论） |
| **personal-knowledge** | 个人知识库（多领域沉淀、成长追踪） |
| **gstack-strategy** | YC Office Hours + CEO Plan Review |
| **traffic-query** | 聚光投放数据查询（9 种报表类型） |

## 在 DOSIA 中使用

打开 DOSIA → Settings → 插件 → 插件市场 → DOSIA Official → 一键安装

或单独安装某个插件。

## 在 Claude Code 中使用

兼容 Claude Code 的 marketplace.json 格式，可通过以下方式添加：

```
/plugin marketplace add leave1206/dosia-plugins
/plugin install <plugin-name>@dosia-official
```

## 仓库结构

```
.claude-plugin/
  marketplace.json    # 市场清单
plugins/
  feishu/
  browser-automation/
  ...
```

每个插件目录都是独立的 SDK 原生插件包（`.claude-plugin/plugin.json` + `agents/` + `skills/` + `hooks/`）。

## License

MIT
