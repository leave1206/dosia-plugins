---
name: x-web-fetch
description: |
  通过 X 官网获取完整推文数据（正文、图片、视频、评论、互动数据）。
  输入: 推文链接（x.com/user/status/xxx）。
  输出: 结构化推文数据 + 媒体保存到本地。
  委派 browser-operator 执行。
  触发词: 推文、tweet、x.com、twitter、获取推特内容
---

# x-web-fetch — X 官网推文获取

委派 **browser-operator** sub-agent，传入推文链接和保存目录。

## 参数解析

- **链接**: 支持 x.com 和 twitter.com，两者等价
- **保存目录**: 用户指定 或 默认 `~/Downloads/x/{推文ID}/`

## 执行流程

### Step 1: 打开推文页面

```
navigate_page → 推文链接
wait_for → 推文正文元素出现（超时 15s）
```

X 是 SPA，首次加载可能较慢。如果遇到登录墙，先检查是否已登录。

### Step 2: 获取推文内容

X 的 a11y 树结构较好，优先用 snapshot:

```
take_snapshot → 获取 a11y 树，提取:
  - 推文正文全文
  - 作者昵称 + @handle
  - 发布时间
  - 互动数据（回复数、转发数、点赞数、浏览量）
```

如果是引用推文（Quote Tweet），一并提取被引用的推文内容。

### Step 3: 获取图片

```
evaluate_script → 提取 pbs.twimg.com 图片 URL
```

获取高清原图:
```
将 URL 中的 name=small 或 name=medium 替换为 name=orig
例: https://pbs.twimg.com/media/xxx?format=jpg&name=orig
```

下载:
```
Bash → curl -o ~/Downloads/x/{推文ID}/img_01.jpg "{高清URL}"
```

### Step 4: 获取视频

X 的视频是 blob URL，无法直接从页面提取下载链接。

```
检查推文是否包含视频（snapshot 中有 video 元素）
如果有:
  Bash → yt-dlp "{推文链接}" -o "~/Downloads/x/{推文ID}/video.%(ext)s"

  如果 yt-dlp 未安装:
    → 返回提示: "推文含视频，需安装 yt-dlp: brew install yt-dlp"
```

### Step 5: 获取 Thread（串联推文）

如果推文是 thread 的一部分:

```
take_snapshot → 检查是否有 "Show this thread" 或前续推文
如果是 thread:
  向上滚动获取完整 thread
  对每条推文重复 Step 2-4 的提取
  按时间顺序排列
```

### Step 6: 获取回复

```
take_snapshot → 获取推文下方的回复列表
提取每条回复:
  - 作者 @handle
  - 回复内容
  - 互动数据
  - 是否是作者自己的回复
```

默认获取前 20 条回复。用户要求更多时继续滚动加载。

### Step 7: 结构化输出

返回完整数据:

```
作者: @handle (昵称)
发布时间: xxx
正文: xxx
互动: { 回复: N, 转发: N, 点赞: N, 浏览: N }
引用推文: { 作者, 正文 } 或 null
图片: [~/Downloads/x/.../img_01.jpg, ...]
视频: ~/Downloads/x/.../video.mp4 或 null
Thread: [{ 正文, 时间 }, ...] 或 null
回复: [{ 作者, 内容, 互动 }, ...]
```

## 常见异常

| 异常 | 处理 |
|------|------|
| 未登录/登录墙 | 返回提示用户在 Chrome 中登录 x.com |
| 推文已删除 | 从页面状态判断，返回明确错误 |
| 推文设为私密 | 返回 "该推文不可公开访问" |
| yt-dlp 下载失败 | 返回推文数据（不含视频），附带手动下载提示 |
| 速率限制 | 等待 5s 后重试一次，仍失败则返回已获取内容 |
