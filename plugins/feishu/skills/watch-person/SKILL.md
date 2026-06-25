---
name: watch-person
description: 盯着某个飞书群里某个特定人的发言，ta 一发言就提醒用户（近实时、本机长开期间持续守护）。触发：「盯着 X 群里张三说话就提醒我 / 谁在 Y 群发言告诉我 / 监控某人飞书消息 / 盯一下老板在群里有没有 @ / 群里某人发言通知我」。区别于盯整群重点（group-monitor）和固定时间摘要（cron）：watch-person 专盯「一个群 + 一个人」。
---

# /watch-person —— 盯飞书群里某个人的发言

帮用户建一个值守循环：每隔几分钟看一眼指定飞书群里**指定那个人**有没有新发言，有就在 DOSIA 里提醒用户。底层 = `/loop`（`start_loop`）+ `person-monitor-loop` agent，**轮询不订阅**、用**用户自己的飞书身份**只读不回复。

## 何时用（vs group-monitor vs cron）

| 用户说 | 用 |
|---|---|
| 「盯着项目群里**张三**说话就提醒我」「老板在群里发言告诉我」「谁 @ 我了通知我」（**一个群 + 一个人**）| **watch-person**（本 skill）|
| 「帮我盯**整个群**的重点 / @我 / 决策待办」（不限定某个人）| `group-monitor-scheduler`（盯整群重点）|
| 「每天 9 点把昨天群消息汇总发我」（固定时间摘要）| cron（`cron_manage`，见 cron-flow）|

判据：**只关心某一个特定人在某一个群说了什么** → watch-person。

## 创建前必须和用户确认 3 件事（逐条对话问，不出表单）

1. **盯哪个群**（群名）→ 解析成 `chatId`
2. **盯谁**（姓名）→ 解析成**当前应用**的 `ou_xxx` open_id
3. **多久看一次 + 怎么提醒**（默认每 5 分钟、V1 只提醒不自动回复）——一句话带过即可，别让用户纠结

> 用户画像是营销/运营/BD（非技术），别问 chatId/open_id 这种术语，问「哪个群」「盯谁」就行，解析你来做。

## 解析步骤（你调用的工具序列）

### ① 群名 → chatId
- 委派 `lark-im` skill 列出用户的群（按其当时指引，如 `lark-cli im +chat-list`），**`--page-all` 完整分页**，按用户说的群名模糊匹配。
- 命中多个 / 不确定 → 把候选群名列给用户确认，**不要**只看首页就报「找不到这个群」（分页假阴性，见 person-monitor-loop 的 CRITICAL）。

### ② 姓名 → 当前应用 open_id（关键，别跳过）
- 委派 `lark-contact` skill 调 `lark-cli contact +search-user --query "<姓名>"`，取**当前应用命名空间**的 `ou_xxx`（**不要**用通讯录缓存里 deprecated 的裸 openId——异应用 open_id 会让监控静默零命中）。
- 重名 / 多个候选 → 列出（带部门/邮箱等可辨识信息）让用户确认是哪一个。

### ③ 频率 / 强度
- 默认 `firstDelaySeconds: 300`（每 5 分钟看一次）。用户说「盯紧点」可缩到 60–120，说「不急」可拉长。
- V1 **只提醒**，不自动回复、不转发（这些是后续档，本 skill 不做）。

## 确认齐了 → 调 start_loop

```
start_loop({
  name: "盯·张三·项目群",
  goal: "监控群 oc_xxxxxx(项目群) 里 ou_yyyyyy(张三) 的新消息，有就提醒用户",
  stopCondition: "（持续守护，用户喊停为止）",
  firstPrompt: "首轮：只建立 cursor 基线（记录该群当前最新消息时间），不要把历史消息推成提醒；之后每轮拉 cursor 之后 ou_yyyyyy 的新消息，有就 alert",
  firstDelaySeconds: 300,
  maxIterations: 200,
  agent: "person-monitor-loop"
})
```

- `name` 与监控 agent 的 `alert.title` 前缀都用 `盯·<人名>·<群名>` 格式（内部「·」无空格）——这是 DOSIA 通知按来源分组的组名来源，别改格式。
- `goal` 必须自包含 `chatId`、`senderOpenId`、可读的群名/人名（每轮是全新会话，只看得到 goal + 状态）。
- `agent: "person-monitor-loop"` 把每轮逻辑交给监控 agent，别把长逻辑塞进 firstPrompt。
- 长守护把 `maxIterations` 调大（如 200），并顺嘴提醒用户「DOSIA 开着才会按时醒来盯」。

建好后用一句话告诉用户：盯的谁、哪个群、多久看一次、在哪看提醒（提灯人「消息」面板）、怎么停。

## 管理已有监控

- **看 / 暂停 / 停止**：在提灯人「排期」面板能看到这条 loop 卡（盯着谁、第几轮、下次几点醒），一键暂停/停止。
- 用户说「别盯张三了」→ 用 `cron_manage`（list 找到对应 loopId → remove），或引导用户去排期面板点停止。

## 边界

- **近实时，非秒级**：轮询最快约 1 分钟一轮，提醒会有一轮间隔的延迟——如实告诉用户「大约几分钟内」，别承诺「立刻」。
- **DOSIA 开着才盯得住**：值守跑在本机，关机/退出就停（同 /loop / cron）。
- 解析不到群 / 人时**别武断报「不存在」**：列候选让用户确认，或降级「直接试，让飞书报错」。
- V1 只提醒；自动起草回复 / 转发是后续能力，本 skill 不承诺。
