---
name: list-history
description: 读某个微信联系人或群的完整聊天记录——文字、图片、链接卡片、文件等多种消息按时间顺序交错呈现。用于"帮我翻一下 XXX 的聊天记录"、"昨天和 XXX 聊了什么"、"XX 群今天讨论了什么"、做总结/拆解前提取完整上下文。
---

# 微信聊天记录（完整·富类型）

读某个会话从头到尾的**完整 transcript**：文字、图片、链接、文件、语音、视频
按时间**交错**排好，一次拿全，顺序天然正确。底层 `wechat-rich-cli` 直接读
已解密的消息库，**不关 SIP、本地只读**。

> 这是「读对话」的主场景。只想要图片 → `read-image`；只想要链接 →
> `read-link-card`；看朋友圈 → `read-moments`。

## 何时触发

- "帮我翻一下和 XXX 的聊天记录" / "昨天和 XXX 聊了什么"
- "XX 群今天讨论了什么" / "把 XX 群这段聊天总结一下"
- 拆解 / 总结前需要完整上下文（含其中的图片和链接）

## 使用方法

```bash
wechat-rich-cli history --talker "张三" --limit 50
```

- `--talker`：联系人备注/昵称 或 群名（自动解析为 wxid → 会话表）。也可 `--wxid <wxid>`。
- `--limit`：默认 50、最大 1000，取最近 N 条，按时间**正序**返回（老→新，便于阅读）。
- `--types text,image,link,file`：可选，只看某几类。
- `--out DIR`：解码图片的落盘目录，默认 DOSIA 已授权的图片缓存目录（直接可 Read）。

## 返回结构

```jsonc
{ "chat": {"name":"张三","is_group":false}, "count": 50,
  "messages": [
    {"type":"text","sender":"张三","time_iso":"…","text":"在吗"},
    {"type":"image","sender":"我","image_path":"/…/x.jpg","ok":true},
    {"type":"link","sender":"张三","title":"…","url":"https://…","description":"…"},
    {"type":"file","sender":"张三","file_name":"合同.pdf"},
    {"type":"quote","sender":"我","text":"引用的话"},
    {"type":"voice|video|sticker|system|location|other", "sender":"…"}
  ] }
```

- **图片**：`ok:true` 的 `image_path` 用 **Read** 工具查看；本地未缓存的图 `ok:false`（用 `read-image` 走更全的解析）。
- **sender**：1:1 会话里自己显示「我」；群里走真实昵称反查。

## 密钥过期（看不到最近消息时）

若输出里有 `stale_keys`（微信滚了新分片、最近消息/图读不到）：先跑
`wechat-rich-cli refresh` 刷新密钥，成功就重试本次查询；若 refresh 返回
`needs_authorization`，告诉用户跑一次 `sudo wechat-cli init`（之后日常会自动免授权）。
**别在缺 stale_keys 提示时假装"最近没消息"。**

## 隐私

微信聊天是用户私人数据。问"昨天聊了什么主题"只给主题，不倒原文；用户明确说
"总结这段对话"才展开。不要未经确认就把整段对话（尤其含图片/隐私）全量倒出。
