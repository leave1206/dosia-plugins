---
name: traffic-report
description: "聚光流量投放数据查询 — 实时报表、离线日报、笔记消耗。所有查询通过 traffic-analyst 处理。"
allowed-tools: Agent
---

# 聚光流量数据查询

## 核心规则

**主 agent 没有任何数据库查询工具。** 所有流量数据查询必须委派给 `traffic-analyst`。

## 触发场景

用户提到以下任意关键词时委派：

| 关键词 | 报表类型 |
|--------|---------|
| 账户消耗、账户报表、子账户 | `rt_account` |
| 创意消耗、创意报表 | `rt_creative` |
| 计划消耗、计划报表 | `rt_campaign` |
| UBE笔记、笔记实时 | `rt_ube_note` |
| UBE分组、分组实时 | `rt_ube_group` |
| 笔记消耗、笔记排行、哪些笔记 | `noteConsumption` |
| 离线日报、昨天数据、T+1 | `ol_account` / `ol_note` / `ol_ube_note` |
| 流量项目、有哪些项目 | `list_traffic_tasks` |

## 日期规则

- 不指定日期 → 不传 date，让 agent 自动用今天/昨天
- 用户说"昨天" → date 传昨天
- 用户说"上周X" → 计算对应日期传入
- 离线报表 10:10 前查"今天" → 实际最新是昨天，提醒用户

## 委派方式

将用户的完整查询意图传给 `traffic-analyst`，包括：
- 项目名称（如果用户提了）
- 时间范围
- 报表维度（账户/创意/计划/笔记）
- 具体需求（Top N、看某个账户等）

查询操作**不需要** background，即时返回。
