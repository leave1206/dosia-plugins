---
name: watch-person
version: 1.1.0
description: "飞书群盯人：盯着某个飞书群里某个特定人的发言，ta 一发言就提醒用户（近实时、本机长开期间持续守护）。触发：「盯着 X 群里张三说话就提醒我 / 谁在 Y 群发言告诉我 / 监控某人飞书消息 / 盯一下老板在群里有没有 @ / 群里某人发言通知我」。区别于盯整群重点（group-monitor）和固定时间摘要（cron）：watch-person 专盯「一个群 + 一个人」。"
metadata:
  requires:
    bins: ["lark-cli"]
---

# watch-person —— 盯飞书群里某个人的发言

帮用户建一个**自包含的值守循环**：每隔几分钟看一眼指定飞书群里**指定那个人**有没有新发言，有就在 DOSIA 里提醒用户。底层 = `/loop`（`start_loop`），**轮询不订阅**、用**用户自己的飞书身份**只读不回复。

> **自包含**：本 skill 不依赖任何独立 sub-agent。每轮的监控流程整段写进 `start_loop` 的 `goal`（loop 每轮把 `goal` 原样注入全新会话），`agent` 参数**不传**。

## 何时用（vs group-monitor vs cron）

| 用户说 | 用 |
|---|---|
| 「盯着项目群里**张三**说话就提醒我」「老板在群里发言告诉我」「谁 @ 我了通知我」（**一个群 + 一个人**）| **watch-person**（本 skill）|
| 「帮我盯**整个群**的重点 / @我 / 决策待办」（不限定某个人）| `group-monitor-scheduler`（盯整群重点）|
| 「每天 9 点把昨天群消息汇总发我」（固定时间摘要）| cron（`cron_manage`，见 cron-flow）|

判据：**只关心某一个特定人在某一个群说了什么** → watch-person。

## 第一步：和用户确认 3 件事（逐条对话问，不出表单）

1. **盯哪个群**（群名）→ 你来解析成 `chatId`
2. **盯谁**（姓名）→ 你来解析成**当前应用**的 `ou_xxx` open_id
3. **多久看一次**（默认每 5 分钟、只提醒不自动回复）——一句话带过即可

> 用户画像是营销/运营/BD（非技术）：只问「哪个群」「盯谁」，chatId/open_id 由你解析，别问术语。

## 第二步：解析 chatId 和 open_id

### 群名 → chatId
- 委派 `lark-im` skill 列群（按其当时指引，如 `lark-cli im +chat-list`），**`--page-all` 完整分页**，按群名模糊匹配。多个候选 → 列给用户确认。**不要只看首页就报「找不到」**（分页假阴性）。

### 姓名 → 当前应用 open_id（关键，别跳过）
- 委派 `lark-contact` skill 调 `lark-cli contact +search-user --query "<姓名>"`，取**当前应用命名空间**的 `ou_xxx`。
- ⚠️ **open_id 按飞书应用命名空间隔离**——别用通讯录缓存里 deprecated 的裸 / 异应用 openId，否则后续按它比对群消息 sender 会**静默零命中**（监控形同失效）。重名 → 列候选（带部门/邮箱）让用户确认。

## 第三步：调 start_loop（goal 内嵌完整每轮流程，不传 agent）

把下面 `goal` 模板里的 `<群名>`/`<chatId>`/`<人名>`/`<senderOpenId>` 填实后调用：

```
start_loop({
  name: "盯·<人名>·<群名>",
  goal: "<见下方『goal 模板』，把占位符填实>",
  stopCondition: "（持续守护，用户喊停为止）",
  firstPrompt: "首轮：只建立 cursor 基线——委派 lark-im skill 拉本群最近一条消息的 create_time 作 cursor（拿不到就用当前时间），不发任何 alert（否则启动即把历史消息炸成提醒），schedule_wakeup 写回 stateUpdate.lastObservation=\"cursor=<该毫秒>; alerted=[]\"。",
  firstDelaySeconds: 300,
  maxIterations: 200
})
```

**注意：不传 `agent` 参数**——每轮逻辑由 `goal` 自带，loop 直接跑。

### goal 模板（每轮全新会话只看得到这段 + [上轮观察]，必须自包含）

> 持续监控飞书群 `<chatId>`（`<群名>`）里 `<senderOpenId>`（`<人名>`）的新发言，有新消息就提醒用户。**只读、不回复、不发消息、不撤回、不调 cron_manage。** 每轮（全新会话）按下面流程做完，二选一收尾（继续盯 → `schedule_wakeup`；用户已喊停 → `stop_loop`）：
>
> 1. 解析 `[上轮观察]`（约定单行 `cursor=<消息 create_time 毫秒>; alerted=[mid,...]`）。若无 `[上轮观察]` = 还没建基线，按 firstPrompt 建基线即可。
> 2. 委派 `lark-im` skill 列群消息（`lark-cli im +chat-messages-list --chat-id <chatId>`，时间窗起点 = `cursor`，`--sort` 升序、`--page-all`；**按 lark-im skill 当时指引拼 flag，不硬编码**），输出 JSON。
> 3. 本地只保留 `sender 的 open_id == <senderOpenId>` 的消息（列消息接口不支持服务端按 sender 过滤，必须客户端筛）。
> 4. 丢弃 `messageId ∈ alerted` 的（双去重，容忍 cursor 边界同毫秒抖动）。
> 5. **有新消息（过滤+去重后 ≥1 条）** → `schedule_wakeup` 带 `alert`：
>    - `title` = `盯·<人名>·<群名> · N 条新消息`（前缀「盯·人名·群名」内部「·」**无空格**；与计数之间用「 · 」**两侧带空格**分隔——DOSIA 通知按 ` · ` 切前缀做分组组名，别破坏格式）
>    - `message` = 前 3 条 `发言人：内容前~40字`，多于 3 条结尾「…等 N 条」，≤120 字
>    - `link` = `https://applink.feishu.cn/client/chat/open?openChatId=<chatId>`
>    - `stateUpdate.lastObservation` = `cursor=<本轮最大 create_time 毫秒>; alerted=[本轮新 messageId 并入，滚动只留最近约 20 个]`
> 6. **无新消息** → `schedule_wakeup` 不带 `alert`，`lastObservation` 的 cursor 推进/原样。**别把「没新消息」也推提醒。**
> 7. `delaySeconds` 默认 300（群活跃可缩到 60–120，很安静可拉长，范围 60–3600）。
> 8. **open_id 防呆**：若连续多轮「零命中」但用户确信那人在发言，怀疑 open_id 跨应用 → 用 `lark-cli contact +search-user --query "<人名>"` 在当前应用重解析一次再比对（**不要自建 resolver / 手写凭证解密**）。
> 9. **群/成员归属**：判断群是否存在、人是否在群，列表查询必须**完整分页**，**禁止只看首页**就报「不在群/群不存在」（首页缺失是分页假阴性）；拿不准就直接拉取并捕获被拒，让飞书后端给权威答复。

建好后用一句话告诉用户：盯的谁、哪个群、多久看一次、在哪看提醒（提灯人「消息」面板）、怎么停。

## 管理已有监控

- **看 / 暂停 / 停止**：提灯人「排期」面板能看到这条 loop 卡（盯着谁、第几轮、下次几点醒），一键暂停/停止。
- 用户说「别盯张三了」→ `cron_manage`（list 找到 loopId → remove），或引导用户去排期面板点停止。

## 边界

- **近实时，非秒级**：轮询最快约 1 分钟一轮，提醒有一轮间隔的延迟——如实说「大约几分钟内」，别承诺「立刻」。
- **DOSIA 开着才盯得住**：值守跑在本机，关机/退出就停（同 /loop / cron）。失败语义：飞书 token 失效/无权限 → 连续 5 次失败自动暂停（amber 不报红）。
- V1 **只提醒**；自动起草回复 / 转发是后续能力，本 skill 不承诺。
