---
name: proposal-review
description: >
  管理员审批知识库变更提案。扫描待审批队列，展示提案详情，支持批准/拒绝/修改操作。
  仅管理员角色可用。当用户说"查看待审批"、"审批提案"、"有待处理的提案吗"时触发。
allowed-tools: Read, Write, Glob, AskUserQuestion
---

# 提案审批（管理员专用）

> **权限检查**：从 system prompt「当前用户」部分确认角色为管理员（管理员/admin）。
> 如果当前用户不是管理员，回复"提案审批仅限管理员操作"并终止。

## Step 1: 扫描待审批队列

用 Glob 扫描待审批提案：

```
inc-knowledge/proposals/pending/*.md
```

如果没有待审批文件，回复"当前没有待审批的提案"并结束。

## Step 2: 汇总展示

读取每个 pending 文件的 frontmatter（提交人、提交时间、会议记录、提案数量），生成汇总列表：

```
📋 当前待审批提案：

1. {提交人} · {提交时间} · {会议名称} ({N} 条提案)
   - PROPOSAL-1: {标题} → {目标文档} [{变更类型}]
   - PROPOSAL-2: {标题} → {目标文档} [{变更类型}]

2. {提交人} · {提交时间} · {会议名称} ({N} 条提案)
   ...

请回复操作，例如：
- "查看 1 的详情"
- "批准 1 全部"
- "批准 1 的 PROPOSAL-1,2 拒绝 PROPOSAL-3: {理由}"
```

## Step 3: 查看详情

当用户要求查看某个提交的详情时：

1. 用 Read 读取对应的 pending 文件
2. 用 Read 读取关联的会议记录（frontmatter 中的 `会议记录` 字段），提供原始上下文
3. 展示每条 PROPOSAL 的完整内容（提议内容 + 变更理由 + 当前内容对比）

## Step 4: 执行审批决策

### 批准

对每条被批准的 PROPOSAL：

1. 读取目标 foundations/ 文件（如果是修改/删除）
2. 执行写入（新增/修改/删除/升级成熟度）
3. 在目标文件末尾追加 changelog：
   ```markdown
   ---
   ## Changelog
   - [{YYYY-MM-DD}] {变更类型}: {简述} (Source: {会议记录文件名}, PROPOSAL-N, 提交人: {提交人}, 审批人: {当前用户})
   ```

### 拒绝

不修改 foundations/ 文件。记录驳回理由到处理结果中。

### 修改

将用户的修改意见反馈写入处理结果，标记为"需修改"。
提交人下次可参考反馈重新提交。

## Step 5: 归档处理结果

审批完成后：

1. 读取原始 pending 文件
2. 在 frontmatter 中更新状态，添加审批信息：
   ```markdown
   ---
   提交人: {原提交人}
   提交时间: {原时间}
   会议记录: {原路径}
   提案数量: {N}
   状态: {已批准 / 已驳回 / 部分批准}
   审批人: {当前用户名}
   审批时间: {ISO 时间戳}
   ---
   ```
3. 在每条 PROPOSAL 标题后追加决策标记：
   - `✅ 已批准 — 已写入 {目标文档}`
   - `❌ 已驳回 — 理由: {驳回理由}`
   - `📝 需修改 — 反馈: {修改意见}`
4. 将文件从 `proposals/pending/` 移动到 `proposals/processed/`（Write 到 processed/ + 删除 pending/ 原文件）
5. 回复确认：
   ```
   ✅ 审批完成：
   - PROPOSAL-1: 已写入 foundations/{路径}
   - PROPOSAL-2: 已写入 foundations/{路径}
   - PROPOSAL-3: 已驳回（{理由}）

   处理记录已归档: proposals/processed/{文件名}
   ```

## 批量操作

支持一次处理多个提交人的提案：
- "全部批准" — 批准所有 pending 文件中的所有 PROPOSAL
- "批准 1,2 拒绝 3" — 按汇总列表中的序号操作
- "批准 1 的 PROPOSAL-1,3 拒绝 PROPOSAL-2: 理由不充分" — 精确到单条 PROPOSAL

## Changelog 格式

写入 foundations/ 文件时，始终追加到 Changelog 部分：

```markdown
- [{YYYY-MM-DD}] 新增: {描述} (Source: {会议记录}, PROPOSAL-N, 提交: {提交人}, 审批: {审批人})
- [{YYYY-MM-DD}] 修改: {描述} (Source: {会议记录}, PROPOSAL-N, 提交: {提交人}, 审批: {审批人})
- [{YYYY-MM-DD}] 升级: {条目} 从 [DRAFT] 到 [VALIDATED] (Source: {会议记录}, PROPOSAL-N)
```
