---
name: list-history
description: 查询某个微信联系人或群的历史消息记录。用于"帮我翻一下 XXX 的聊天记录"、"昨天和 XXX 聊了什么"、"XX 群今天讨论了什么"等场景。
---

# 微信历史消息查询技能

通过 wechat-cli 读取本机微信数据库，列出指定联系人或群的历史消息。

## 何时触发

- 用户说"帮我翻一下 XXX 的聊天记录"、"昨天和 XXX 聊了什么"
- 用户说"XX 群今天讨论了什么"、"XX 群 8 月份的消息"
- 做总结前需要提取上下文

## 使用方法

### 按联系人

```bash
wechat-cli messages --talker "张三" --limit 50 --format json
```

### 按群

群名和好友名一样用 `--talker`；工具会自动识别类型。

### 时间范围

```bash
wechat-cli messages --talker "项目群" --since 2026-04-20 --until 2026-04-22 --format json
```

ISO 日期格式。"今天" / "昨天" / "本周" 要自己转换：
- 今天：`date +%Y-%m-%d`
- 昨天：`date -v -1d +%Y-%m-%d` (macOS)
- 本周：周一到今天

### 分页

`--limit` 默认 50，最大 500。超过用 `--offset` 翻页，但建议先提示用户
"消息很多，我只看最新 50 条还是全部？"

## 返回字段

- `sender`: 发言人（群里才有意义）
- `timestamp`: 精确时间
- `content`: 消息内容
- `msg_type`: text / image / file / link / system

图片 / 文件只返回元信息（尺寸、文件名），不直接展示（那是 read-media 技能的事，本 skill 不管）。

## 回复用户

按时间顺序展示（时间 + 发言人 + 内容）。如果消息多，先给用户"共 N 条，
从 YYYY-MM-DD 到 YYYY-MM-DD"让用户决定是读全部还是总结。

注意：**微信消息是用户私人数据，不要未经确认就把完整对话倒出来给
agent 做分析**。用户明确说"总结这段聊天"才总结；问"昨天聊了什么主题"
可以只返回主题不带原文。
