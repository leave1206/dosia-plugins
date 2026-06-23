---
name: read-image
description: 只把某个微信会话里的图片挑出来解密查看，用于"看看 XXX 发的图片"、"把和 XX 的聊天图片导出来"、"这个群最近的图都给我看看"等只要图片、不要文字的场景。微信图片本地是加密 .dat，本技能解密后让你直接看到。
---

# 微信图片读取（只要图片）

**只要某会话的图片**这一类场景：把图片集中解密出来看，不夹杂文字。
（要按顺序读完整对话用 `list-history`；那里图片也会内联出现。）

底层 `wechat-rich-cli history --types image`：定位该会话的图片消息 → 磁盘推导
密钥解密 .dat → 输出可看图片路径。**不关 SIP、本地只读、不外传。**

## 何时触发

- "看看 XXX 发的图片 / 刚才那张图"
- "把和 XX 的聊天图片导出来 / 这个群最近的图给我看看"
- 拆解某人发的图片素材

## 使用方法

```bash
wechat-rich-cli history --talker "张三" --types image --limit 50 \
  --out "${TMPDIR:-/tmp}/dosia-image-url-cache"
```

返回的 `messages` 全是 `type:"image"` 的消息（按时间）：

- `ok:true` → `image_path` 是解码好的可看图片，**用 Read 工具逐个查看**（DOSIA 会作为图片喂给你）。
- `ok:false` → 本地未缓存或该账号密钥推导失败，如实告诉用户这几张看不到，不要编内容。

`--out` 指向 DOSIA 已授权可读的图片缓存目录，Read 才能直接读到。

## 降级

某些账号/微信版本图片密钥推导会失败（`ok:false` + 原因）；`wxgf` 表情图跳过。
如实反馈，别假装看到了。

**看不到"最近"的图**：若输出有 `stale_keys`（微信滚了新分片），最近的图在解不开的新库里
——先跑 `wechat-rich-cli refresh`，成功就重试；若提示 `needs_authorization`，让用户跑一次
`sudo wechat-cli init`。另外微信只在你那台 Mac **点开过原图**后才会把原图缓存下来，没点开过的
只有缩略图甚至取不到——这种如实说明。

## 隐私

只解用户明确要看的会话/范围的图片，不要把整库图片批量导出。
