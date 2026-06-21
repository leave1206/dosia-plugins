---
name: lark-shared
version: 1.1.0
description: "飞书/Lark CLI 共享基础：应用配置初始化、认证登录（auth login）、身份切换（--as user/bot）、权限与 scope 管理、Permission denied 错误处理、安全规则。当用户需要第一次配置(`lark-cli config init`)、使用登录授权(`lark-cli auth login`)、遇到权限不足、切换 user/bot 身份、配置 scope、或首次使用 lark-cli 时触发。"
---

# lark-cli 共享规则

本技能指导你如何通过lark-cli操作飞书资源, 以及有哪些注意事项。

## 配置初始化

首次使用需运行 `lark-cli config init` 完成应用配置。

当你帮用户初始化配置时，使用background方式使用下面的命令发起配置应用流程，启动后读取输出，从中提取授权链接并发给用户：

```bash
# 发起配置（该命令会阻塞直到用户打开链接并完成操作或过期）
lark-cli config init --new
```

## 初次配置：全量授权（推荐）

首次使用 lark-cli 时，建议一次性申请全量权限，覆盖所有 lark-* skill 的日常场景：

```bash
# 通过 DOSIA Settings → 飞书关联 完成（推荐）
# 或手动执行（agent 代理发起，使用 --no-wait 立即返回授权链接）：
lark-cli auth login --domain all --no-wait
```

`--domain all` 涵盖的域：`base`（多维表格）、`calendar`（日历）、`contact`（通讯录）、
`docs`（文档）、`drive`（云空间）、`event`（事件订阅）、`im`（即时消息）、`mail`（邮件）、
`minutes`（会议纪要）、`sheets`（电子表格）、`task`（任务）、`vc`（视频会议）、`wiki`（知识库）。

> **注意**：如已有部分授权，再次执行 auth login 会增量追加新 scope，不会影响已有授权。

> **⚠ `--domain` 的 scope 映射不完整**：`--domain contact` 只包含用户查询相关 scope，
> 不包含 `contact:department.base:readonly` 等部门权限。如需部门/组织架构 API，
> 必须用 `--scope` 精确指定：
> ```bash
> lark-cli auth login --scope "contact:department.base:readonly contact:contact.base:readonly contact:user.department:readonly" --no-wait --json
> ```

---

## 认证

### 身份类型

两种身份类型，通过 `--as` 切换：

| 身份 | 标识 | 获取方式 | 适用场景 |
|------|------|---------|---------|
| user 用户身份 | `--as user` | `lark-cli auth login` 等 | 访问用户自己的资源（日历、云空间等） |
| bot 应用身份 | `--as bot` | 自动，只需 appId + appSecret | 应用级操作,访问bot自己的资源 |

### 身份选择原则

输出的 `[identity: bot/user]` 代表当前身份。bot 与 user 表现差异很大，需确认身份符合目标需求：

- **Bot 看不到用户资源**：无法访问用户的日历、云空间文档、邮箱等个人资源。例如 `--as bot` 查日程返回 bot 自己的（空）日历
- **Bot 无法代表用户操作**：发消息以应用名义发送，创建文档归属 bot
- **Bot 权限**：只需在飞书开发者后台开通 scope，无需 `auth login`
- **User 权限**：后台开通 scope + 用户通过 `auth login` 授权，两层都要满足


### 权限不足处理

遇到权限相关错误时，**根据当前身份类型采取不同解决方案**。

错误响应中包含关键信息：
- `permission_violations`：列出缺失的 scope (N选1)
- `console_url`：飞书开发者后台的权限配置链接
- `hint`：建议的修复命令

#### Bot 身份（`--as bot`）

将错误中的 `console_url` 提供给用户，引导去后台开通 scope。**禁止**对 bot 执行 `auth login`。

#### User 身份（`--as user`）

```bash
lark-cli auth login --domain <domain> --no-wait --json   # 按业务域授权（推荐）
lark-cli auth login --scope "<missing_scope>" --no-wait --json  # 按具体 scope 授权
```

**规则**：
- auth login 必须指定范围（`--domain` 或 `--scope`）。多次 login 的 scope 会累积（增量授权）。
- 使用 `--no-wait --json` 立即返回授权链接，避免命令阻塞。
- 从 JSON 输出中提取 `verification_url` 发给用户，再用 `--device-code` 等待完成。

#### Agent 代理发起认证（推荐）

当你作为 AI agent 需要帮用户完成认证时，使用 `--no-wait` 立即获取授权链接，发给用户后
再用 `--device-code` 等待授权完成：

```bash
# 第一步：立即获取授权链接（JSON 输出包含 verification_url 和 device_code）
lark-cli auth login --domain all --no-wait --json

# 将 verification_url 发给用户在浏览器中完成授权

# 第二步：等待用户完成授权（阻塞直到授权完成或超时）
lark-cli auth login --device-code <device_code_from_step1>
```

**单域授权**（需要最小权限时）：
```bash
lark-cli auth login --domain calendar --no-wait --json
```


## 安全规则

- **禁止输出密钥**（appSecret、accessToken）到终端明文。
- **写入/删除操作前必须确认用户意图**。
- 用 `--dry-run` 预览危险请求。

## 操作结果诚实性（发送 / 创建必回读核验）

涉及"发送消息 / 创建文档 / 创建表格 / 上传文件 / 导入云空间"等**产生外部副作用的写操作**时，**绝不能凭命令"看起来跑完了"就宣称成功**：

- **强制 `--json` + 校验返回码**：写操作一律加 `--json`，读 `code`（0 才成功）/ `msg` / 业务数据（`message_id` / `spreadsheet_token` / `url`）。`code != 0`、stderr 有 error、或拿不到预期 id/链接 = **失败**，不是成功。
- **回读核验**：发完消息用 `im +messages-list` 确认消息真在目标会话里；创建完表格/文档用对应 get 确认对象真实存在、链接可访问，再向用户报"已发 / 已创建"。
- **失败如实报（amber 口径，不静默吞、不红色伪装）**：失败时如实告诉用户"这次没发出去 / 没创建成功" + 具体原因（权限不足 console_url / scope 缺失 / 身份不对），提议补齐或换方式。**严禁未核验就写"已发到飞书 ✅"**——曾发生"宣称已发，用户飞书零消息"。
- **身份送达陷阱**：`im +messages-send` 只支持 **bot 身份**，消息以应用名义发出、且只进 bot 在场的会话。**bot 不能替用户给"我自己"发消息**——想发给用户本人，先确认目标会话 bot 在场，否则用户根本收不到。别把"命令退出码 0"当成"用户收到了"。
