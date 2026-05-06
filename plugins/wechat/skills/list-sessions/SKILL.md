---
name: list-sessions
description: 列出微信最近会话（和谁聊过、最后一条消息时间），按活跃度排序。用于"我最近跟谁聊过微信"、"谁最近给我发微信了"等场景。
---

# 微信会话列表技能

通过 wechat-cli 列出本机微信的近期会话。

## 何时触发

- 用户说"最近跟谁聊了微信"、"我有哪些微信群在活跃"
- 用户想找某段时间的微信但记不清联系人
- 用户说"列出最近 N 个会话"

## 使用方法

```bash
wechat-cli sessions --limit 20 --format json
```

返回字段：
- `talker`: 对方（联系人名或群名）
- `type`: "friend" | "group" | "official_account"
- `last_message_time`: 最后一条时间
- `unread_count`: 未读数
- `last_message_snippet`: 最后消息预览

## 参数识别

- `--limit N`：列几个，默认 20，用户说"前 5" / "最近 50" → 改
- `--type friend|group|official`：过滤类型
- `--since YYYY-MM-DD`：只显示这天之后有消息的会话

## 回复用户

按时间倒序列出：
- 对方 + 类型（群/好友）
- 最后消息时间（相对时间"2 小时前"）
- 未读数（> 0 才标红，其他不显示）
- 最后消息 snippet（不超过 20 字）

不暴露 wxid 或内部 ID 除非用户要在后续查历史时用。
