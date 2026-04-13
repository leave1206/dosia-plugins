---
name: xhs-web-fetch
description: |
  通过小红书官网获取完整笔记数据（标题、正文、图片、评论、互动数据）。
  输入: 小红书链接（xhslink.com 短链或 xiaohongshu.com）。
  输出: 结构化笔记数据 + 图片保存到本地。
  委派 browser-operator 执行。
  触发词: 小红书笔记、抓取笔记、xhs 链接、获取红书内容
---

# xhs-web-fetch — 小红书官网笔记获取

委派 **browser-operator** sub-agent，传入小红书链接和保存目录。

## 参数解析

- **链接**: xhslink.com 短链会自动跳转到 xiaohongshu.com，无需预处理
- **保存目录**: 用户指定 或 默认 `~/Downloads/xhs/{笔记ID}/`

## 执行流程

### Step 1: 打开笔记页面

```
navigate_page → 小红书链接
wait_for → 笔记标题元素出现（超时 10s）
```

短链跳转可能较慢，等待跳转完成后再继续。

### Step 2: 处理登录弹窗

小红书 PC 端经常弹出登录弹窗遮挡内容。

```
take_snapshot → 检查页面是否有登录弹窗/遮罩层
如果有:
  press_key Escape → 尝试关闭
  take_snapshot → 确认是否关闭成功
如果仍被遮挡:
  → 返回错误: "小红书需要登录，请在 Chrome 中打开 xiaohongshu.com 登录后重试"
```

### Step 3: 获取笔记文本内容

```
take_snapshot → 获取 a11y 树，提取:
  - 标题
  - 正文全文
  - 作者昵称
  - 发布时间
  - 点赞数、收藏数、评论数
  - 标签/话题（#xxx）
```

如果 snapshot 内容不完整，用 `evaluate_script` 补充提取 DOM 数据。

### Step 4: 获取所有图片

```
evaluate_script → 提取所有图片的 CDN URL（通常是 sns-webpic-qc.xhscdn.com 域名）
```

多图笔记需要翻页:
```
循环:
  记录当前图片 URL
  click → 右箭头/下一张按钮
  wait_for → 图片切换完成
  evaluate_script → 获取新图片 URL
  直到回到第一张或无更多图片
```

下载图片:
```
Bash → curl -o ~/Downloads/xhs/{笔记ID}/img_01.jpg "{CDN_URL}"
对每张图片重复
```

### Step 5: 获取评论

```
take_snapshot → 获取已加载的评论列表
提取每条评论:
  - 评论者昵称
  - 评论内容
  - 点赞数
  - 时间
```

如需加载更多评论:
```
evaluate_script → 滚动评论区到底部触发加载
wait_for → 新评论出现
重复直到无更多或达到合理上限（50 条）
```

### Step 6: 结构化输出

返回完整数据:

```
标题: xxx
作者: xxx
发布时间: xxx
正文: xxx
标签: [#话题1, #话题2]
互动: { 点赞: N, 收藏: N, 评论: N }
图片: [~/Downloads/xhs/.../img_01.jpg, img_02.jpg, ...]
评论: [{ 作者, 内容, 点赞数 }, ...]
```

## 常见异常

| 异常 | 处理 |
|------|------|
| 登录弹窗无法关闭 | 返回提示用户手动登录 |
| 笔记已删除/不存在 | 从页面状态判断，返回明确错误 |
| 图片 CDN 403 | 尝试添加 Referer header: `curl -H "Referer: https://www.xiaohongshu.com/"` |
| 评论加载失败 | 返回已获取的评论，标注"可能不完整" |
