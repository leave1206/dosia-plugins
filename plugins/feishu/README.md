# Feishu Plugin — 飞书 Lark CLI 集成

基于 [larksuite/cli](https://github.com/larksuite/cli) 开源项目，通过 **Bash-in-Skill 模式**（不走 MCP）让 DOSIA Agent 操作飞书全量能力。

## 架构

```
用户: "帮我查下今天日程"
  → Agent 匹配 lark-calendar Skill
  → Agent 通过 Bash 执行: lark-cli calendar +agenda
  → 返回结果

不需要 MCP Server、不需要自定义代码。
CLI 无状态，跑完即退，凭证存在 OS keychain。
```

## 前置条件

### 安装 lark-cli

```bash
# 方式一：npm（推荐）
npm install -g @larksuite/cli

# 方式二：从 GitHub Release 下载
# https://github.com/larksuite/cli/releases
```

### 验证安装

```bash
lark-cli --version
# 预期: lark-cli version 1.0.0
```

## 首次使用

**无需手动配置。** 首次使用飞书功能时，Agent 会自动引导：

1. Agent 检测到未配置 → 执行 `lark-cli config init --new`
2. Agent 提取授权链接发给用户 → 用户点击完成应用配置
3. Agent 执行 `lark-cli auth login --recommend` → 一次性全量授权
4. 用户飞书扫码 → 授权完成 → 以后直接用

详见 `skills/lark-shared/SKILL.md` 中的"Agent 代理发起认证"章节。

## 能力清单（19 个 Skill）

| Skill | 能力 |
|-------|------|
| lark-shared | 认证/身份/安全（所有 Skill 前置依赖） |
| lark-im | 发消息、管群聊、搜索聊天记录 |
| lark-doc | 创建/更新/搜索文档（Markdown 输入） |
| lark-base | 多维表格全量操作（含公式/聚合/仪表盘/工作流） |
| lark-task | 任务/清单/子任务/提醒/成员分配 |
| lark-calendar | 日程/忙闲/时间建议 |
| lark-contact | 搜索用户、获取联系方式 |
| lark-drive | 上传下载文件、评论管理、权限管理 |
| lark-sheets | 电子表格读写追加查找导出 |
| lark-mail | 邮件全生命周期 |
| lark-vc | 会议搜索+纪要获取 |
| lark-minutes | 妙记元数据+AI产物 |
| lark-wiki | 知识空间节点管理 |
| lark-event | WebSocket 实时事件订阅 |
| lark-whiteboard | 画板 DSL/Mermaid 渲染 |
| lark-skill-maker | 元 Skill：创建新飞书 Skill |
| lark-openapi-explorer | 元 Skill：挖掘未覆盖 API |
| lark-workflow-meeting-summary | 会议纪要汇总工作流 |
| lark-workflow-standup-report | 日程待办摘要工作流 |

## 权限控制

四层叠加：

1. **Workspace pluginTags** — 角色是否加载 feishu Plugin（hr-finance 不加载）
2. **Skill disable-model-invocation** — 单个场景级开关
3. **OAuth scope** — 用户授权范围（`--recommend` 一次全量授权）
4. **飞书资源级** — 用户只能操作自己有权限的文档/群聊/日历

## Skill 来源

所有 19 个 Skill 从 [larksuite/cli](https://github.com/larksuite/cli) 官方仓库的 `skills/` 目录复制。更新时重新复制即可。
