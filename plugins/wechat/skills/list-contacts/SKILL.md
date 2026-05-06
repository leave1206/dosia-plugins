---
name: list-contacts
description: 列出本机微信的联系人和群，支持按备注、微信号、昵称模糊搜索。用于"XXX 的微信怎么搜"、"我有没有加 XX 的微信"等场景。
---

# 微信联系人列表技能

通过 wechat-cli 查询本机微信的联系人、群成员。

## 何时触发

- 用户说"XX 的微信怎么搜"、"我有没有加 XX 的微信"
- 发消息前需要确认对方是否在通讯录
- 用户说"列出我所有的微信群"

## 使用方法

### 搜索好友

```bash
wechat-cli contacts --query "张三" --format json
```

匹配字段：备注（remark）、昵称（nickname）、微信号（wxid）。

### 列所有群

```bash
wechat-cli contacts --type group --limit 100 --format json
```

### 列群成员

```bash
wechat-cli group-members --group "项目群" --format json
```

### 列公众号关注

```bash
wechat-cli contacts --type official_account --format json
```

## 返回字段

好友：
- `remark`: 备注（你给对方起的）
- `nickname`: 对方自己的昵称
- `wxid`: 微信号（内部 ID）
- `wechat_id`: 用户可见的微信号（可能为空）
- `region`: 地区

群：
- `group_name`: 群名
- `group_id`: 群 ID (wxid 类型)
- `member_count`: 成员数

## 回复用户

好友：备注优先显示，备注为空时用昵称。
群：群名 + 成员数。

隐私约束：**不主动把 wxid 透给用户**（那是内部 ID，对用户无意义且
可能被用于非法用途）。只在后续要发消息/查历史时 internal 使用。
