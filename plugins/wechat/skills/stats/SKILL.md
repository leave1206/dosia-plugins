---
name: stats
description: 统计微信消息数据，含活跃度、发送/接收比例、按人/群/时间分布。用于"我这周发了多少微信"、"XX 群有多活跃"、"我跟谁聊得最多"等场景。
---

# 微信使用统计技能

通过 wechat-cli 聚合本机微信数据，输出统计数据。

## 何时触发

- 用户说"我这周发了多少微信"、"XX 群有多活跃"、"我跟谁聊得最多"
- 用户做年终 / 月度总结
- 分析微信使用习惯

## 使用方法

### 总体统计

```bash
wechat-cli stats --since 2026-04-15 --until 2026-04-22 --format json
```

返回：
- `total_sent`: 发送总数
- `total_received`: 接收总数
- `by_talker`: `[{talker, count}]` 按会话聚合
- `by_day`: `[{date, sent, received}]` 按日分布
- `by_hour`: `[{hour, count}]` 按小时分布（看"深夜消息"占比）

### 单会话统计

```bash
wechat-cli stats --talker "张三" --since ... --until ... --format json
```

### Top N 会话

```bash
wechat-cli stats --top 10 --sort by_sent --since ... --format json
```

sort 选项：`by_sent` / `by_received` / `by_total`

## 回复用户

数字优先，图表文字化：

```
📊 本周微信总览 (4/15 - 4/22)

发出 256 条，收到 483 条
最活跃群：「项目群」(158 条)
最常聊好友：张三 (42 条)
深夜消息 (23:00-02:00)：12 条 → 占 2.5%
```

不要把每条消息内容列出来（那是 list-history 的职责，stats 只给数字）。
用户要看内容再单独调。

**隐私边界**：个人统计数据不敏感；但涉及"和某人聊了多少"在多人共用
同机场景可能尴尬（比如公用 iMac 的家庭）。如果用户问的是其他家庭成员
的统计，礼貌提示"这些数据属于当前登录微信账号，不区分使用者"。
