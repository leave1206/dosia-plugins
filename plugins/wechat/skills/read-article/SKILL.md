---
name: read-article
description: 获取一篇微信公众号文章的完整内容——正文 + 文章里的图片。用于"把刚才那篇文章的全文给我"、"这个公众号链接讲了什么，连图一起"、"读一下这篇 mp.weixin.qq.com 文章"等场景。配合 read-link-card（它给你文章 URL）使用。
---

# 微信公众号文章全文读取

把一篇公众号文章（`mp.weixin.qq.com/s?...`）的**完整正文 + 图片**取出来。
文章 URL 一般来自 `read-link-card`（本地聊天里的链接卡片只给标题/摘要，
全文和图在腾讯服务器上）。

## ⚠️ 必须用真浏览器，不能用 fetch（实测）

- ❌ 服务端 `fetch` / WebFetch 文章 URL → 被拦：「环境异常，完成验证后即可继续访问」。
- ✅ **用真浏览器打开**（chrome-devtools MCP / DOSIA 浏览器采集能力）→ 正常渲染。

## 何时触发

- "把刚才那篇（公众号）文章的全文给我 / 连图一起"
- "这个 mp.weixin.qq.com 链接讲了什么"
- read-link-card 给出文章链接后，用户要看全文

## 使用方法

### 1) 在浏览器里打开文章 URL

用浏览器工具（如 chrome-devtools 的 `new_page`）打开 `mp.weixin.qq.com/s?...`。
**视频号卡片**（read-link-card 里 appmsg_type=51）的 URL 是升级提示页、**没有正文**，遇到直接说明。

### 2) 从 DOM 取正文 + 图片 URL（无需滚动）

正文和图片 URL 都在初始 DOM 里，`evaluate_script` 一次取出：

```js
() => {
  const title = (document.querySelector('#activity-name')||{}).innerText?.trim() || document.title;
  const body  = (document.querySelector('#js_content')||document.body).innerText.trim();
  const imgs  = [...document.querySelectorAll('#js_content img')]
                  .map(i => i.getAttribute('data-src') || i.src).filter(Boolean);
  const blocked = /环境异常|完成验证|该内容已被发布者删除|参数错误/.test(document.body.innerText||'');
  return JSON.stringify({ title, blocked, body, imgs });
}
```

- `blocked:true` → 是验证页/已删除，如实告诉用户，别编内容。
- 图片 URL 是 `data-src`（懒加载），**不用滚动**就能拿到全部。

### 3) 要图片本体就直接下载（无需 referer、无需滚动）

mmbiz.qpic.cn 的图直接下载即可（实测 200 + 合法 JPEG，连 referer 都不用）：

```bash
curl -sL -o "<out>/<n>.jpg" "<图片URL>"
```

把图下到 DOSIA 已授权可读的目录（如 `${TMPDIR:-/tmp}/dosia-image-url-cache`），
再用 **Read** 工具查看 / 给用户。

> 只想要"渲染版截图"（图文混排）才需要先**滚动到底触发懒加载**再整页截图；
> 大多数情况"正文文本 + 下载的图片"已经够用，不必滚动截图。

## 回复用户

给标题 + 正文（可适当分段）+ 关键图片（已下载的用 Read 展示）。文章很长就先给
摘要 + 标题，问用户要不要全文。

## 隐私 / 边界

- 公开公众号文章是公开内容，可读可引用。
- 已删除 / 仅粉丝可见 / 付费 → 取不到，如实说明，不编造。
