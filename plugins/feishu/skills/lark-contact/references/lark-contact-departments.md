
# 部门与组织架构 API

> **前置条件：** 先阅读 [`../lark-shared/SKILL.md`](../../lark-shared/SKILL.md) 了解认证、全局参数和安全规则。

部门操作通过 `lark-cli api` 直接调用飞书 Open API（尚无 shortcut 封装）。

## 权限要求

需要以下 scope（`--domain contact` 不包含，必须用 `--scope` 单独授权）：

| scope | 说明 |
|-------|------|
| `contact:department.base:readonly` | 部门基础信息读取 |
| `contact:contact.base:readonly` | 通讯录基础读取 |
| `contact:user.department:readonly` | 用户的部门信息读取 |

```bash
# 授权命令
lark-cli auth login --scope "contact:department.base:readonly contact:contact.base:readonly contact:user.department:readonly" --no-wait --json
```

## API 列表

### 1. 获取子部门列表

从指定部门获取直属子部门。根部门 ID 为 `"0"`，从根开始递归可构建完整组织架构树。

```bash
# 获取一级部门
lark-cli api GET /open-apis/contact/v3/departments/0/children --as user \
  --params '{"department_id_type":"open_department_id","page_size":50}'

# 获取某部门的子部门
lark-cli api GET /open-apis/contact/v3/departments/<open_department_id>/children --as user \
  --params '{"department_id_type":"open_department_id","page_size":50}'

# 自动翻页获取所有子部门
lark-cli api GET /open-apis/contact/v3/departments/0/children --as user \
  --params '{"department_id_type":"open_department_id"}' --page-all
```

**参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `department_id_type` | 否 | `open_department_id`（推荐）/ `department_id` |
| `page_size` | 否 | 每页条数，最大 50 |
| `page_token` | 否 | 分页标记 |

**返回字段：** `department_id`, `open_department_id`, `name`, `i18n_name`, `status`, `leaders`

### 2. 获取部门详情

```bash
lark-cli api GET /open-apis/contact/v3/departments/<open_department_id> --as user \
  --params '{"department_id_type":"open_department_id"}'
```

### 3. 获取部门下的成员

```bash
lark-cli api GET /open-apis/contact/v3/users --as user \
  --params '{"department_id":"<open_department_id>","department_id_type":"open_department_id","page_size":50}'

# 自动翻页
lark-cli api GET /open-apis/contact/v3/users --as user \
  --params '{"department_id":"<open_department_id>","department_id_type":"open_department_id"}' --page-all
```

**返回字段：** `name`, `open_id`, `union_id`, `department_ids`, `avatar`, `orders`（含主部门标记）

## 构建完整组织架构树

从根部门递归获取所有部门和成员：

```bash
# 第一步：获取一级部门
lark-cli api GET /open-apis/contact/v3/departments/0/children --as user \
  --params '{"department_id_type":"open_department_id"}' --page-all

# 第二步：对每个部门递归获取子部门
lark-cli api GET /open-apis/contact/v3/departments/<dept_id>/children --as user \
  --params '{"department_id_type":"open_department_id"}' --page-all

# 第三步：获取每个叶子部门的成员
lark-cli api GET /open-apis/contact/v3/users --as user \
  --params '{"department_id":"<dept_id>","department_id_type":"open_department_id"}' --page-all
```

## 限制

- 使用 `user_access_token` 时，可见数据受企业管理员配置的**组织架构可见范围**限制
- 递归查询上限 **1000 个部门**
- 每页最多 50 个部门 / 100 个用户
- 频率限制：1000 次/分钟
- 错误码 `41050` = 组织架构可见范围受限，需管理员调整

## 参考

- [lark-contact-get-user](lark-contact-get-user.md) — 获取单个用户详情
- [lark-contact-search-user](lark-contact-search-user.md) — 按关键词搜索用户
- [lark-shared](../../lark-shared/SKILL.md) — 认证和全局参数
