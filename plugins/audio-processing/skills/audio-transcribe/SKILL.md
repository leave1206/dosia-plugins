---
name: audio-transcribe
description: "音频转写 — 本地文件/URL/播客链接转文字，支持会议录音"
---

# 音频转写编排

可用工具: `mcp__audio-transcribe__transcribe({ filePath?, url?, language?, outputPath? })`
返回带时间戳的 Markdown 文本。长音频（>30 分钟）需等待数分钟。

## 输入判断（收到请求后第一步）

### A: 本地文件路径

以 `/` 或 `~` 开头，或含音频扩展名（.mp3, .m4a, .wav, .flac, .aac, .ogg, .webm, .mp4）

→ `transcribe({ filePath: "路径" })`

### B: 音频直链 URL

URL 路径以音频扩展名结尾，或来自 CDN/对象存储域名（cos.ap-xxx, cdn.xxx, oss-xxx）

→ `transcribe({ url: "直链" })`

### C: 平台页面 URL（需先提取音频链接）

URL 是播客/音频平台页面，不是直接音频文件:
- 小宇宙: `xiaoyuzhoufm.com/episode/xxx`
- 喜马拉雅: `ximalaya.com/xxx`
- Apple Podcasts: `podcasts.apple.com/xxx`

步骤:
1. WebFetch 获取页面内容
2. 在 HTML/JSON 中找音频直链（`<audio src>`, `og:audio`, JSON-LD `contentUrl`, 或内嵌 `.mp3`/`.m4a` URL）
3. 找到后 → `transcribe({ url: "提取到的直链" })`
4. 找不到 → 告知用户无法自动提取，建议手动获取音频文件或直链

## 错误处理

- **文件不存在**: 确认路径拼写，检查文件是否在用户提到的位置
- **格式不支持**: 告知支持的格式列表，建议用 ffmpeg 转换
- **凭证未配置**: 提示检查 `media-backend/server/.env` 中的 VOLC 和 COS 配置
- **转写超时**: 长音频（>2小时）可能超过 1 小时轮询上限，建议拆分

## 输出处理

- 用户要求保存 → 传 `outputPath` 或将结果写入指定路径
- 用户要求分析 → 先转写，再结合 meeting-analyst 等技能分析内容
- 默认 → 直接展示转写结果
