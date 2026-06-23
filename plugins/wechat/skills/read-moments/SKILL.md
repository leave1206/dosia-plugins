---
name: read-moments
description: 读本机微信缓存的朋友圈（正文 + 图片/视频媒体 + 位置）。用于"看看最近的朋友圈"、"XXX 最近发了什么朋友圈"、"把这周朋友圈整理一下"等场景。
---

# 微信朋友圈读取技能

用 `wechat-rich-cli` 读已解密的 `sns.db`（`SnsTimeLine` 表），解析每条朋友圈
的 `TimelineObject`，给出正文、作者、媒体、位置。**本地只读、不外传。**

## 何时触发

- "看看最近的朋友圈 / 朋友圈有什么新的"
- "XXX 最近发了什么朋友圈"
- "把这周 / 今天的朋友圈整理一下"

## 使用方法

```bash
wechat-rich-cli moments --limit 30
```

返回 JSON：`{ account, count, moments: [{ author, text, time_iso, location, media: [{ type, url, thumb }] }] }`。

- `text`：朋友圈正文。
- `media`：`type=2` 图片、`type=6` 视频；`url`/`thumb` 是微信 CDN 链接
  （加密资源，当前版本只给链接/缩略图元信息，不内联解码）。
- `time_iso`：发布时间（UTC，给用户时换算本地时区）。
- 按最近插入顺序（rowid）倒序。

## 范围说明

本机朋友圈缓存通常**比较稀疏**（只缓存浏览过的）。按真实返回的条数说话，
别承诺"全部朋友圈"。`author` 多为 wxid，必要时配合 `wechat-cli contacts`
查真实昵称。

## 密钥过期

若输出有 `stale_keys`（微信滚了新分片、最近朋友圈读不到）：先跑 `wechat-rich-cli refresh`，
成功就重试；若返回 `needs_authorization`，让用户跑一次 `sudo wechat-cli init`。

## 隐私

朋友圈是用户及其好友的私人数据。只在用户明确要看时调用；问"最近朋友圈
有什么"可以给主题/摘要，不要不经确认就把好友隐私内容大段倒出。
