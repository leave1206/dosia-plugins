---
name: wechat-publish
description: |
  将 Markdown 文章发布到微信公众号。自动完成 MD→微信富文本转换、图片上传、内容填写。
  发布前截图确认，用户确认后才执行。
  输入: Markdown 文件路径。输出: 预览截图 + 发布状态。
  委派 browser-operator 执行。
  触发词: 公众号、发文章、微信发布、mp.weixin
---

# wechat-publish — 公众号文章发布

委派 **browser-operator** sub-agent，传入 Markdown 文件路径。

## 参数解析

- **Markdown 文件**: 绝对路径，必须是 .md 文件
- **作者名**: 用户指定 或 从文件 frontmatter 提取 或 留空

## 执行流程

### Step 1: 读取 Markdown

```
Read → 读取 .md 文件
解析:
  - 标题: 第一个 # 标题
  - 正文: 标题之后的全部内容
  - 本地图片: 文中引用的图片路径（![](./path/to/image.jpg)）
```

### Step 2: MD → 微信富文本

公众号编辑器不支持 Markdown，需要先转换为微信兼容的富文本 HTML。

```
navigate_page → https://agent.01lb.com.cn/md/
wait_for → 编辑器加载完成
```

清空编辑器并粘贴 Markdown:
```
click → 左侧编辑区
evaluate_script → 选中全部内容并清空
type_text 或 evaluate_script → 粘贴 Markdown 源码
wait_for → 右侧预览渲染完成
```

提取转换后的 HTML:
```
evaluate_script → 获取右侧预览区的 innerHTML
```

### Step 3: 打开公众号编辑器

```
navigate_page → https://mp.weixin.qq.com/
take_snapshot → 检查登录状态
```

未登录:
```
→ 返回错误: "请在 Chrome 中打开 mp.weixin.qq.com 扫码登录后重试"
```

已登录:
```
navigate_page → https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit
或: click "新建图文" 按钮
wait_for → 编辑器加载完成
```

### Step 4: 填写内容

标题:
```
click → 标题输入框
fill → 输入标题文本
```

作者（如有）:
```
click → 作者输入框
fill → 输入作者名
```

正文（关键步骤 — 公众号编辑器是 contenteditable div）:
```
click → 正文编辑区
evaluate_script → 将步骤 2 获取的富文本 HTML 注入编辑区:
  document.querySelector('#edui_editor_0 .rich_media_content')
    .innerHTML = richHtml;
```

注意: 公众号编辑器的选择器可能变化，如果注入失败，尝试:
```
evaluate_script → 查找 contenteditable 元素:
  document.querySelector('[contenteditable="true"]')
```

### Step 5: 上传图片

公众号不允许外部图片 URL，必须通过编辑器上传:

```
对每张本地图片:
  click → 编辑器工具栏的图片按钮
  upload_file → 选择本地图片文件
  wait_for → 上传完成（进度条消失 / 图片出现在编辑区）
```

如果正文中的图片已通过 HTML 注入（外部 URL），公众号预览时会显示断裂。需要逐张替换为上传后的图片。

### Step 6: 预览确认

```
take_screenshot → 截取完整编辑器页面（包含标题、正文预览）
```

**返回截图路径给主 Agent，附带消息: "文章已填写完毕，请确认内容。确认后回复'发布'保存草稿，或告知需要修改的内容。"**

**此处停止，等待主 Agent 转达用户指令。**

### Step 7: 执行发布

收到确认指令后:

保存草稿（默认安全选项）:
```
click → "保存草稿" 按钮
wait_for → 保存成功提示
take_screenshot → 截取成功状态
```

或直接发布（用户明确要求时）:
```
click → "发布" 按钮
wait_for → 发布确认弹窗
click → 确认发布
wait_for → 发布成功
take_screenshot → 截取成功状态
```

返回发布状态。

## 常见异常

| 异常 | 处理 |
|------|------|
| 公众号未登录 | 返回提示扫码登录 |
| Doocs 编辑器不可用 | 直接在公众号编辑器中用 type_text 逐段输入纯文本（降级方案，无格式） |
| 图片上传失败 | 记录失败图片，继续其他步骤，在预览确认时说明哪些图片缺失 |
| 富文本注入失败 | take_screenshot 记录编辑器状态，报告具体错误 |
| 编辑器选择器变化 | 用 take_snapshot 定位当前页面的 contenteditable 元素 |

## 写作风格参考

如果用户在创作阶段需要写作建议，参考 `/Users/K/Documents/workspace/表达/写作风格标准.md`。
本 Skill 不负责创作，只负责将已完成的 Markdown 发布到公众号。
