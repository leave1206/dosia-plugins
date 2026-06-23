---
name: read-link-card
description: 只把微信里收发的链接 / 文章 / 小程序卡片挑出来，拿到真实可点 URL。用于"刚才那个链接是什么"、"把 XX 发的文章链接给我"、"今天群里分享的链接整理一下"、"最近收到哪些链接"等只要链接、不要全部聊天的场景。
---

# 微信链接卡片读取（只要链接）

`wechat-cli` 的历史只给链接卡片**标题**不给 URL。本技能用 `wechat-rich-cli`
解出 appmsg 卡片的真实链接。**只要链接**这一类场景；要按顺序读完整对话用
`list-history`（链接也会在其中内联出现）。

## 何时触发

- "刚才那个链接是什么 / 把链接发我"
- "把 XX / 群里今天分享的文章链接整理一下"
- "最近收到哪些链接 / 我收藏的那篇文章链接"

## 使用方法

### 某个会话的链接

```bash
wechat-rich-cli history --talker "项目群" --types link --limit 50
```

返回全是 `type:"link"` 的消息（按时间），字段 `title` / `url` / `description` / `source`。

### 跨所有会话最近的链接

```bash
wechat-rich-cli links --limit 30
```

返回 `{ count, links:[{ title, url, description, source, appmsg_type, time_iso, chat_hash }] }`，
按时间倒序。`appmsg_type`：`5`=链接/文章、`33/36`=小程序、`51`=视频号占位等。

## 回复用户

按时间给「标题 + 链接（+来源）」。多就先报"共 N 条"让用户挑。

## 密钥过期

若输出有 `stale_keys`（微信滚了新分片、最近链接读不到）：先跑 `wechat-rich-cli refresh`，
成功就重试；若返回 `needs_authorization`，让用户跑一次 `sudo wechat-cli init`。

## 隐私

只在用户明确要"链接/文章"时调用。`chat_hash` 是会话 md5，不要反推具体是谁，
除非用户问。
