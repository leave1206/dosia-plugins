---
name: lark-contact
version: 1.1.0
description: "飞书通讯录：查询组织架构、部门层级、人员信息和搜索员工。获取当前用户或指定用户的详细信息、通过关键词搜索员工（姓名/邮箱/手机号）、获取部门列表和子部门、查询部门下的成员。当用户需要查看个人信息、查找同事、查询部门结构、浏览组织架构树时使用。"
metadata:
  requires:
    bins: ["lark-cli"]
  cliHelp: "lark-cli contact --help"
---

# contact (v1)

**CRITICAL — 开始前 MUST 先用 Read 工具读取 [`../lark-shared/SKILL.md`](../lark-shared/SKILL.md)，其中包含认证、权限处理**

## Shortcuts（推荐优先使用）

Shortcut 是对常用操作的高级封装（`lark-cli contact +<verb> [flags]`）。有 Shortcut 的操作优先使用。

| Shortcut | 说明 |
|----------|------|
| [`+search-user`](references/lark-contact-search-user.md) | Search users (results sorted by relevance) |
| [`+get-user`](references/lark-contact-get-user.md) | Get user info (omit user_id for self; provide user_id for specific user) |

## 部门与组织架构（通过 `lark-cli api` 调用）

lark-cli 尚未为部门操作提供 shortcut，需通过 `lark-cli api` 直接调用飞书 Open API。

详见 [`references/lark-contact-departments.md`](references/lark-contact-departments.md)。

### 快速参考

```bash
# 获取一级部门（根部门 ID 为 "0"）
lark-cli api GET /open-apis/contact/v3/departments/0/children --as user \
  --params '{"department_id_type":"open_department_id","page_size":50}'

# 获取子部门
lark-cli api GET /open-apis/contact/v3/departments/<open_department_id>/children --as user \
  --params '{"department_id_type":"open_department_id","page_size":50}'

# 获取部门详情
lark-cli api GET /open-apis/contact/v3/departments/<open_department_id> --as user \
  --params '{"department_id_type":"open_department_id"}'

# 获取部门下的成员
lark-cli api GET /open-apis/contact/v3/users --as user \
  --params '{"department_id":"<open_department_id>","department_id_type":"open_department_id","page_size":50}'
```

### 权限要求

部门 API 需要额外的 scope，`--domain contact` 不包含这些 scope，必须用 `--scope` 精确指定：

```bash
lark-cli auth login --scope "contact:department.base:readonly contact:contact.base:readonly contact:user.department:readonly" --no-wait --json
```

