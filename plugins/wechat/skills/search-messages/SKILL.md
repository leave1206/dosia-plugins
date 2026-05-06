---
name: search-messages
description: 全局搜索微信消息内容，找特定关键词/人名/链接。用于"搜一下 XXX 相关的微信"、"谁发过 YY 链接"、"XX 的报价记录"等场景。
---

# 微信消息搜索技能

通过 wechat-cli 在本机微信数据库中做全文搜索。

## 何时触发

- 用户说"搜一下 XX 相关的微信"、"谁发过 YY 的链接"
- 用户找某次对话但记不清在哪个会话里："XX 报价的消息在哪"
- 用户整理某主题的所有相关消息

## 使用方法

```bash
wechat-cli search --query "关键词" --limit 50 --format json
```

### 进阶过滤

- `--talker "张三"`：限定发起人（注意：是 talker 会话方，不是 sender）
- `--msg-type text|link|image|file`：消息类型过滤
- `--since 2026-04-01`：时间范围
- `--contact "群名"`：限定某个群内搜

组合例子：
```bash
wechat-cli search --query "报价" --contact "销售群" --msg-type text \
  --since 2026-04-01 --format json
```

## 返回字段

- `talker`: 会话方（群或好友名）
- `sender`: 实际发言人
- `timestamp`: 时间
- `content`: 完整消息
- `context_match`: 匹配位置（高亮用）

## 回复用户

按相关度 / 时间倒序列出匹配结果：
- 会话 / 发言人 / 时间
- 匹配的消息片段（关键词前后 20 字）

超过 20 条提示"找到 N 条，先列最相关 10 条"。

**隐私边界**：如果用户搜索的关键词看起来是他自己想找自己的信息，正常
返回。如果是在找"XXX 给谁发过什么"这种查第三方关系的查询，主动确认
"你要查看 XXX 发给其他人的消息 — 这是你有权限看到的吗？"再执行。
