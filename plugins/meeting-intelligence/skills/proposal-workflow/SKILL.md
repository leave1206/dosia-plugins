---
name: proposal-workflow
description: >
  Handle user approval/rejection of PROPOSAL items generated during meeting analysis.
  Use when user replies with approve/reject/modify commands after meeting analysis.
allowed-tools: Read, Write, Glob
---

# Proposal Workflow — Step 9

> Handle user approval/rejection of PROPOSAL items generated during meeting analysis.

## 权限检查

从 system prompt「当前用户」部分读取角色信息：
- **管理员**（角色 = 管理员 / admin）→ 可直接审批，走「Approve / Reject / Modify / Skip」流程
- **非管理员** → 无权直接写入 foundations/，走「Submit to Admin」流程

## Trigger

When user replies with approval/rejection commands after meeting analysis:
- "批准 1,2,3" / "Approve all" / "全部批准"
- "拒绝 2" / "Reject PROPOSAL-2"
- "修改 3: [意见]" / "Modify PROPOSAL-3: [feedback]"
- "暂不处理" / "Skip"

## 管理员流程

### Approve

1. Parse which PROPOSAL numbers are approved
2. For each approved proposal:
   - Read the target foundations/ file
   - Apply the proposed change (add/modify/delete/upgrade maturity)
   - Add a changelog entry at the bottom of the file:
     ```
     ---
     ## Changelog
     - [YYYY-MM-DD] [Change Type]: [Brief description] (Source: [Meeting Name], Approved by [user])
     ```
3. Confirm each write with the file path and change summary

### Reject

1. Mark the proposal as `[REJECTED]` in the meeting record
2. No file modifications
3. Confirm rejection

### Modify

1. Parse the user's modification feedback
2. Revise the proposal content accordingly
3. Re-present the modified proposal for approval
4. Do NOT write to foundations/ until the revised proposal is explicitly approved

### Skip

1. Proposals remain in the meeting record as `[PENDING]`
2. User can revisit them later by referencing the meeting record

## 非管理员流程（Submit to Admin）

当非管理员用户尝试批准或操作提案时：

1. **提示无权限**：回复"foundations/ 变更需要管理员审批，正在为您提交审批申请"
2. **提取 PROPOSAL**：从当前会议记录中提取所有 PROPOSAL 内容
3. **写入审批队列**：
   - 路径: `inc-knowledge/proposals/pending/{YYYY-MM-DD}-{HHMM}-{用户名}-{会议概述}.md`
   - 格式: 含 frontmatter（提交人、时间、会议记录路径、状态: 待审批）+ 所有 PROPOSAL 完整内容
4. **确认提交**：
   ```
   📤 已提交管理员审批：proposals/pending/{文件名}
   审批结果将由管理员处理，您可以稍后询问"我的提案审批了吗"查看进度。
   ```

> 如果用户在 meeting-analysis Step 9 中已被路径 B 自动提交过，不要重复提交。
> 用 Glob 检查 `proposals/pending/` 中是否已存在同名文件。

## Write Permissions

| Target | Permission | Role | Notes |
|--------|-----------|------|-------|
| `foundations/` | **requireConfirm** | 管理员 | 必须明确批准后才写入 |
| `foundations/` | **denied** | 非管理员 | 提交审批队列，不直接写入 |
| `proposals/` | **autoApprove** | 全员 | 提交和归档审批件 |
| `knowledge-base/` | **autoApprove** | 全员 | 事实性内容可直接追加 |
| `meetings/` | **autoApprove** | 全员 | 会议记录自由写入 |

## Changelog Format

When writing to foundations/ files, always append to the Changelog section:

```markdown
- [YYYY-MM-DD] Added: [description] (Source: [meeting file], PROPOSAL-N, 提交: [submitter], 审批: [approver])
- [YYYY-MM-DD] Modified: [description] (Source: [meeting file], PROPOSAL-N, 提交: [submitter], 审批: [approver])
- [YYYY-MM-DD] Upgraded: [item] from [DRAFT] to [VALIDATED] (Source: [meeting file], PROPOSAL-N)
```
