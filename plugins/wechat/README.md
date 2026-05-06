# 微信 (WeChat) Plugin

DOSIA 官方微信集成插件。包装 [@canghe_ai/wechat-cli](https://www.npmjs.com/package/@canghe_ai/wechat-cli)
(Deprecated 上游)，通过本机微信内存扫描实现只读访问 — **数据永不离开本机**。

## 能力列表

| Skill | 用途 |
|---|---|
| `list-sessions` | 列近期会话（谁最近发过消息） |
| `list-history` | 查某会话的历史消息 |
| `search-messages` | 全文搜索聊天记录 |
| `list-contacts` | 查联系人 / 群 / 公众号 |
| `list-unread` | 按重要性分组的未读消息 |
| `stats` | 活跃度 / 对象分布 / 时间分布 |

## Platform 限制

仅支持 **macOS**（darwin-arm64 + darwin-x64）。wechat-cli 依赖读取
macOS 版微信客户端的内存数据结构，Windows / Linux 上不支持。

## Setup 流程

### 三步

1. **授予完全磁盘访问权限** (permission step)
   - DOSIA 打开 `系统设置 → 隐私与安全性 → 完全磁盘访问权限`
   - 你勾选 DOSIA 或 Terminal
2. **初始化微信密钥** (sudo-command step)
   - DOSIA 弹出嵌入式终端
   - 你在终端输入 macOS 登录密码（sudo）
   - wechat-cli 扫描微信进程内存，提取解密密钥 → 写 `~/.wechat-cli/all_keys.json`
3. **选择账号** (interactive-choice step, 如果你登过多个微信)
   - DOSIA 列出检测到的账号
   - 你选择要绑定的那个

### 前置条件

- 微信 for Mac 客户端正在运行
- 已经登录（wechat-cli 需要进程内存里的 session key）

## 数据边界

- 所有读取发生在本机内存 / 本地 SQLite 数据库
- wechat-cli 不发送任何数据到外网（`networkDomains: []`）
- DOSIA agent 使用微信数据时遵守 skill 里的隐私约定（见每个 skill.md）

## 信任级别

`official` — DOSIA 官方签名。sudo 初始化需要用户亲自在终端输入密码，
DOSIA 从不看到密码。

## 常见问题

- **"posix_spawnp failed"**：node-pty 执行位被 pnpm 剥离 — DOSIA 启动时
  自动修复（`scripts/fix-node-pty-perms.mjs`）
- **"密钥过期"**：微信客户端重启后 session key 变了，重跑 setup
- **"多账号检测不到"**：确保微信客户端登录了要绑定的账号
- **wechat-cli 作者标记 deprecated**：我们追踪一个 fork / 替代方案，
  短期内继续使用当前版本
