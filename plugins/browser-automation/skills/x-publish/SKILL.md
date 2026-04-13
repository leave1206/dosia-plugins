---
name: x-publish
description: |
  在 X/Twitter 上发布推文。支持文本+图片，超长内容自动拆分为 Thread。
  发布前截图确认，用户确认后才执行。
  输入: 推文文本 + 可选图片/视频路径。输出: 预览截图 + 推文 URL。
  委派 browser-operator 执行。
  触发词: 发推、tweet、发推文、post to x
---

# x-publish — X/Twitter 发推

委派 **browser-operator** sub-agent，传入推文内容和可选媒体文件。

## 参数解析

- **文本**: 推文正文（单条 ≤ 280 字符）
- **图片**: 可选，最多 4 张，本地文件路径
- **视频**: 可选，最多 1 个，本地文件路径（与图片互斥）
- **Thread**: 文本超过 280 字符时自动拆分

## 内容准备

### 长度检查与 Thread 拆分

```
如果文本 ≤ 280 字符:
  → 单条推文

如果文本 > 280 字符:
  → 自动拆分为 Thread
  拆分规则:
    1. 按段落（双换行）拆分
    2. 单段超过 280 字符时按句号拆分
    3. 每条末尾预留编号空间（如 "1/5"）
    4. 图片附加到第一条
```

## 执行流程

### Step 1: 打开 X

```
navigate_page → https://x.com/compose/post
  或 navigate_page → https://x.com → click 发推按钮
wait_for → 推文编辑框出现
```

未登录:
```
take_snapshot → 检查是否在登录页面
→ 返回错误: "请在 Chrome 中登录 x.com 后重试"
```

### Step 2: 输入推文内容

```
click → 推文编辑框
type_text → 逐字输入推文文本
```

注意: 使用 `type_text` 而非 `fill`，因为 X 的编辑框是 contenteditable div，`fill` 可能不生效。

### Step 3: 上传媒体（如有）

图片:
```
click → 图片上传按钮（工具栏中的图片图标）
upload_file → 选择本地图片
wait_for → 图片缩略图出现
重复直到所有图片上传完成（最多 4 张）
```

视频:
```
click → 媒体上传按钮
upload_file → 选择本地视频
wait_for → 视频处理完成（可能需要较长时间）
```

### Step 4: Thread 处理（如需拆分）

```
输入第一条内容后:
  click → "+" 按钮（添加到 thread）
  wait_for → 新编辑框出现
  type_text → 输入第二条内容
  重复直到所有条目输入完成
```

### Step 5: 预览确认

```
take_screenshot → 截取发推编辑器完整内容
```

**返回截图给主 Agent: "推文已编辑完毕（共 N 条），请确认后回复'发布'。"**

**此处停止，等待确认。**

### Step 6: 发布

```
click → "Post" / "Post all" 按钮
wait_for → 发布完成（编辑框关闭 或 跳转到已发布推文）
take_screenshot → 截取已发布状态
```

如果能获取到推文 URL，一并返回。

## 常见异常

| 异常 | 处理 |
|------|------|
| 未登录 | 返回提示登录 |
| 字数超限 | 自动拆分 Thread（不截断句子） |
| 图片上传失败 | 报告错误，继续发布文本部分 |
| 视频处理超时 | wait_for 最多等待 60s，超时则报告 |
| 发布按钮灰色 | take_snapshot 检查原因（可能内容为空或违规提示） |
