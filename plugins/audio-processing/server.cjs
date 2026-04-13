#!/usr/bin/env node
/**
 * Audio Transcribe MCP Server
 *
 * 链路: 本地文件 → COS 上传 → 火山引擎 Big Model API → 转写文本
 *
 * 可独立运行测试:
 *   node server.js --test "/path/to/audio.mp3"
 *
 * 作为 MCP Server (stdio):
 *   注册到 Claude Code: claude mcp add audio-transcribe node /path/to/server.js
 *   注册到 DOSIA: SessionConfig.mcpServers
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const COS = require('cos-nodejs-sdk-v5');

// ── 加载 .env（多路径回退）──
const ENV_CANDIDATES = [
  process.env.DOSIA_ENV_PATH,                                    // 显式指定
  path.resolve(__dirname, '../../../media-backend/server/.env'),  // monorepo 布局
  path.resolve(__dirname, '../../.env'),                          // plugin 上两级
];
for (const envPath of ENV_CANDIDATES) {
  if (envPath && fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key && !process.env[key]) process.env[key] = val;
      }
    });
    break;
  }
}

// ── 配置 ──
const VOLC = {
  appId: process.env.VOLC_APP_ID,
  accessToken: process.env.VOLC_ACCESS_TOKEN,
  submitUrl: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit',
  queryUrl: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query',
  resourceId: 'volc.bigasr.auc',
  pollInterval: 5000,
  maxPollTime: 60 * 60 * 1000, // 1 小时
};

const COS_CONFIG = {
  Bucket: process.env.COS_BUCKET,
  Region: process.env.COS_REGION || 'ap-guangzhou',
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
};

const cos = new COS({ SecretId: COS_CONFIG.SecretId, SecretKey: COS_CONFIG.SecretKey });

const SUPPORTED_EXT = new Set(['.m4a', '.mp3', '.wav', '.webm', '.ogg', '.flac', '.aac', '.mp4']);

// ── COS 上传 ──
async function uploadToCos(filePath) {
  const key = `dosia-audio/${Date.now()}_${path.basename(filePath)}`;

  log(`📤 上传到 COS: ${key} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)}MB)`);

  const data = await cos.uploadFile({
    Bucket: COS_CONFIG.Bucket,
    Region: COS_CONFIG.Region,
    Key: key,
    FilePath: filePath,
    SliceSize: 1024 * 1024 * 5,
    onProgress: (p) => {
      if (p.percent) log(`   上传进度: ${(p.percent * 100).toFixed(0)}%`);
    },
  });

  const url = 'https://' + data.Location;
  log(`✅ 上传完成: ${url.substring(0, 80)}...`);
  return url;
}

// ── 火山引擎提交 ──
async function submitTask(taskId, audioUrl, language = 'zh-CN') {
  const format = audioUrl.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'mp3';
  log(`📤 提交火山引擎任务: ${taskId}, 格式: ${format}, 语言: ${language}`);

  const resp = await axios.post(VOLC.submitUrl, {
    user: { uid: `dosia_${Date.now()}` },
    audio: { format, url: audioUrl },
    request: { model_name: 'bigmodel', enable_itn: true, language },
  }, {
    headers: {
      'Content-Type': 'application/json',
      'X-Api-App-Key': VOLC.appId,
      'X-Api-Access-Key': VOLC.accessToken,
      'X-Api-Resource-Id': VOLC.resourceId,
      'X-Api-Request-Id': taskId,
    },
    timeout: 30000,
  });

  const code = resp.headers['x-api-status-code'];
  if (code !== '20000000') {
    throw new Error(`提交失败: ${resp.headers['x-api-message'] || code}`);
  }
  log('✅ 任务已提交');
}

// ── 轮询结果 ──
async function pollResult(taskId) {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < VOLC.maxPollTime) {
    attempt++;
    const elapsed = Math.round((Date.now() - start) / 1000);

    try {
      const resp = await axios.post(VOLC.queryUrl, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-App-Key': VOLC.appId,
          'X-Api-Access-Key': VOLC.accessToken,
          'X-Api-Resource-Id': VOLC.resourceId,
          'X-Api-Request-Id': taskId,
        },
        timeout: 15000,
      });

      const code = resp.headers['x-api-status-code'];
      const data = resp.data;
      const duration = data?.audio_info?.duration;
      const durStr = duration ? `${Math.round(duration / 1000)}s` : '?';

      if (code === '20000000' && data?.result) {
        log(`\n✅ 转写完成 (耗时 ${elapsed}s, 音频 ${durStr})`);
        return {
          text: data.result.text || '',
          utterances: data.result.utterances || [],
          duration: duration ? duration / 1000 : 0,
        };
      }
      if (code === '20000003') throw new Error('静音音频，无法提取文本');

      const labels = { '20000001': '⏳ 处理中', '20000002': '📋 队列等待' };
      log(`\r${labels[code] || code} | #${attempt} | ${elapsed}s | 音频 ${durStr}   `);

      await sleep(code?.startsWith('55') ? VOLC.pollInterval * 2 : VOLC.pollInterval);
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        log(`⚠️ 网络超时，重试... (#${attempt})`);
        await sleep(VOLC.pollInterval);
        continue;
      }
      throw err;
    }
  }
  throw new Error('轮询超时');
}

// ── 核心: 转写（本地文件或在线 URL） ──
async function transcribe({ filePath, url, language = 'zh-CN' }) {
  // 验证凭证
  if (!VOLC.appId || !VOLC.accessToken) {
    throw new Error('未配置 VOLC_APP_ID / VOLC_ACCESS_TOKEN (检查 media-backend/server/.env)');
  }

  let audioUrl;
  let sourceLabel;

  if (url) {
    // 场景 B: 已有音频直链，跳过 COS 上传
    audioUrl = url;
    sourceLabel = url.length > 80 ? url.substring(0, 80) + '...' : url;
    log(`\n🎙️  音频转写 (URL): ${sourceLabel}`);
  } else if (filePath) {
    // 场景 A: 本地文件，需要 COS 上传
    if (!COS_CONFIG.SecretId || !COS_CONFIG.SecretKey || !COS_CONFIG.Bucket) {
      throw new Error('未配置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET (检查 .env)');
    }
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) throw new Error(`文件不存在: ${absPath}`);
    const ext = path.extname(absPath).toLowerCase();
    if (!SUPPORTED_EXT.has(ext)) throw new Error(`不支持的格式: ${ext}`);

    const sizeMB = (fs.statSync(absPath).size / 1024 / 1024).toFixed(1);
    sourceLabel = `${path.basename(absPath)} (${sizeMB}MB)`;
    log(`\n🎙️  音频转写 (本地): ${sourceLabel}`);

    audioUrl = await uploadToCos(absPath);
  } else {
    throw new Error('必须提供 filePath（本地文件路径）或 url（音频直链）之一');
  }

  // 火山引擎提交 + 轮询
  const taskId = generateUUID();
  await submitTask(taskId, audioUrl, language);
  const result = await pollResult(taskId);

  log(`📊 时长: ${Math.round(result.duration / 60)}分钟, 文本: ${result.text.length}字, 语句: ${result.utterances.length}条`);
  return { ...result, sourceLabel };
}

// ── MCP Server (stdio) ──
async function runMcpServer() {
  let buffer = '';
  let processing = false;
  const queue = [];

  // Synchronous guard + async worker — eliminates TOCTOU race on `processing` flag
  function processQueue() {
    if (processing) return;
    processing = true;
    processQueueAsync().finally(() => { processing = false; });
  }

  async function processQueueAsync() {
    while (queue.length > 0) {
      const line = queue.shift();
      try {
        const msg = JSON.parse(line);
        const resp = await handleJsonRpc(msg);
        if (resp) {
          process.stdout.write(JSON.stringify(resp) + '\n');
        }
      } catch (e) {
        // JSON-RPC 2.0: parse error must return -32700 if id is recoverable
        try {
          const idMatch = line.match(/"id"\s*:\s*(\d+|"[^"]*")/);
          const errId = idMatch ? JSON.parse(idMatch[1]) : null;
          if (errId !== null) {
            process.stdout.write(JSON.stringify({
              jsonrpc: '2.0', id: errId,
              error: { code: -32700, message: 'Parse error' },
            }) + '\n');
          }
        } catch { /* truly unrecoverable */ }
      }
    }
  }

  process.stdin.setEncoding('utf-8');

  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.substring(0, newlineIdx).trim();
      buffer = buffer.substring(newlineIdx + 1);
      if (line) queue.push(line);
    }
    processQueue();
  });
}

async function handleJsonRpc(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'audio-transcribe', version: '1.0.0' },
      },
    };
  }

  // JSON-RPC 2.0: notifications (no id) must not receive a response
  if (id === undefined || id === null) return null;

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: {
        tools: [{
          name: 'transcribe',
          description: '将音频转写为带时间戳的文本（火山引擎 Big Model ASR）。接受本地文件路径（filePath）或音频直链 URL（url），二选一。本地文件会自动上传 COS 再转写；URL 直接转写。支持 mp3/m4a/wav/flac/aac/ogg/webm/mp4，无时长限制。长音频（>30分钟）需等待数分钟。注意：url 必须是音频文件直链，不是网页链接。',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: '本地音频文件的绝对路径（与 url 二选一）' },
              url: { type: 'string', description: '音频文件的直链 URL，如 https://xxx.cos.xxx/audio.mp3（与 filePath 二选一）' },
              language: { type: 'string', description: '语言代码 (zh-CN, en-US)，默认 zh-CN', default: 'zh-CN' },
              outputPath: { type: 'string', description: '可选：保存转写结果的 .md 文件路径' },
            },
            oneOf: [
              { required: ['filePath'] },
              { required: ['url'] },
            ],
          },
        }],
      },
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    if (name !== 'transcribe') {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    }

    try {
      const result = await transcribe({ filePath: args.filePath, url: args.url, language: args.language });
      const mdText = formatMarkdown(result);

      // 保存文件（限制写入目录防止路径遍历）
      if (args.outputPath) {
        const outPath = path.resolve(args.outputPath);
        const home = require('os').homedir();
        const allowed = [home, require('os').tmpdir()];
        if (!allowed.some(d => outPath.startsWith(d + path.sep) || outPath === d)) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `outputPath 必须在用户目录或临时目录下: ${outPath}` }], isError: true } };
        }
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, mdText, 'utf-8');
      }

      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: mdText }] } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `转写失败: ${err.message}` }], isError: true } };
    }
  }

  // Unknown method
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── 工具函数 ──
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { process.stderr.write(msg + '\n'); }

// ── 格式化结果为 Markdown ──
function formatMarkdown(result) {
  let md = `# 音频转写结果\n\n`;
  md += `- **来源**: ${result.sourceLabel}\n`;
  md += `- **时长**: ${Math.round(result.duration / 60)} 分钟\n`;
  md += `- **转写时间**: ${new Date().toLocaleString('zh-CN')}\n`;
  md += `- **引擎**: 火山引擎 Big Model ASR\n\n---\n\n`;

  if (result.utterances.length > 0) {
    for (const utt of result.utterances) {
      const sec = (utt.start_time || 0) / 1000;
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(Math.floor(sec % 60)).padStart(2, '0');
      md += `[${mm}:${ss}] ${utt.text}\n`;
    }
  } else {
    md += result.text;
  }
  return md;
}

// ── 入口 ──
if (process.argv.includes('--test')) {
  // 直接测试模式: node server.cjs --test <file-or-url> [--output <path>]
  const testIdx = process.argv.indexOf('--test') + 1;
  const input = process.argv[testIdx];
  const outputIdx = process.argv.indexOf('--output');
  const outputPath = outputIdx !== -1 ? process.argv[outputIdx + 1] : null;

  if (!input) { console.error('用法: node server.cjs --test <file-or-url> [--output <path>]'); process.exit(1); }

  const isUrl = input.startsWith('http://') || input.startsWith('https://');
  const args = isUrl ? { url: input } : { filePath: input };

  transcribe(args).then(result => {
    const mdText = formatMarkdown(result);
    const out = outputPath || path.join(require('os').homedir(), 'Downloads',
      `transcript-${new Date().toISOString().slice(0, 10)}.md`);
    fs.writeFileSync(out, mdText, 'utf-8');
    console.log(`\n💾 已保存: ${out}`);
  }).catch(err => {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  });
} else {
  // MCP Server 模式
  runMcpServer();
}
