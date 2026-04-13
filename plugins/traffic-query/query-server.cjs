#!/usr/bin/env node
/**
 * Traffic Query MCP Server
 *
 * 流量项目监控数据查询 — 只读 MongoDB 查询
 * 支持 9 种报表类型，覆盖 6 个核心集合。
 *
 * 4 Tools:
 *   list_traffic_tasks       — 列出所有流量项目配置
 *   query_realtime_report    — 查询实时报表 (rt_account/rt_creative/rt_campaign/rt_ube_note/rt_ube_group)
 *   query_note_consumption   — 查询笔记消耗聚合 (noteConsumption)
 *   query_offline_report     — 查询离线日报 (ol_account/ol_note/ol_ube_note)
 *
 * 运行模式:
 *   stdio (默认，本机开发):  node query-server.cjs
 *   HTTP  (迁移到另一台 Mac): HTTP_MODE=1 PORT=8080 node query-server.cjs
 *
 * 环境变量:
 *   MONGODB_URI   — 必填，MongoDB 连接串
 *   HTTP_MODE     — 可选，设为 1 启动 HTTP 模式
 *   PORT          — HTTP 模式端口，默认 8080
 *   SERVICE_TOKEN — HTTP 模式鉴权 token
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const readline = require('readline');

// ─── Config ───────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'admin';
const HTTP_MODE = process.env.HTTP_MODE === '1';
const PORT = parseInt(process.env.PORT || '8080', 10);
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;

if (!MONGODB_URI) {
  process.stderr.write('[traffic-query] ERROR: MONGODB_URI 未设置。请在 ~/.zshrc 中添加:\n');
  process.stderr.write('  export MONGODB_URI="mongodb://admin:xxx@159.75.246.143:27017/admin?authSource=admin"\n');
  process.exit(1);
}

// ─── MongoDB 连接池 ────────────────────────────────────────────────────────────

const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 3,           // 保守设置，避免压垮生产 DB
  minPoolSize: 1,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 10000,
});

let db = null;

async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db(DB_NAME);
    process.stderr.write('[traffic-query] MongoDB 连接成功\n');
  }
  return db;
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function todayBJ() {
  // 北京时间 (UTC+8)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function yesterdayBJ() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000 - 86400000);
  return now.toISOString().slice(0, 10);
}

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    throw new Error(`无效的 taskId: "${id}"，请从 list_traffic_tasks 获取正确的 ID`);
  }
}

function serializeDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(serializeDoc);
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v instanceof ObjectId) out[k] = v.toString();
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (v && typeof v === 'object') out[k] = serializeDoc(v);
    else out[k] = v;
  }
  return out;
}

// ─── Tool 定义 ─────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_traffic_tasks',
    description: '列出所有流量项目配置。返回项目名称、ID、广告主账户数、飞书链接等信息。查询其他报表前先调此工具获取 taskId。',
    inputSchema: {
      type: 'object',
      properties: {
        env: {
          type: 'string',
          description: '环境筛选：production（线上）/ test（测试），不传返回全部',
          enum: ['production', 'test'],
        },
      },
    },
  },
  {
    name: 'query_realtime_report',
    description: [
      '查询聚光实时报表数据。支持 5 种维度：',
      '  rt_account  — 子账户消耗实时报表（小时级）',
      '  rt_creative — 创意消耗实时报表（top 500）',
      '  rt_campaign — 计划消耗实时报表（top 500）',
      '  rt_ube_note — UBE 笔记消耗实时报表',
      '  rt_ube_group— UBE 分组消耗实时报表',
      '数据来自 raw_report_data 集合（dtos 字段展开），按消耗降序排列。',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          description: '报表类型',
          enum: ['rt_account', 'rt_creative', 'rt_campaign', 'rt_ube_note', 'rt_ube_group'],
        },
        taskId: {
          type: 'string',
          description: '流量项目 ID（24位十六进制，从 list_traffic_tasks 的 id 字段获取）',
        },
        date: {
          type: 'string',
          description: '查询日期 YYYY-MM-DD，不传默认今天（北京时间）',
        },
        hour: {
          type: 'number',
          description: '指定小时 0-23。不传则汇总当天所有小时（取每个维度最新一小时的累计值）',
        },
        limit: {
          type: 'number',
          description: '返回条数上限，默认 50，最大 200',
        },
      },
      required: ['reportType', 'taskId'],
    },
  },
  {
    name: 'query_note_consumption',
    description: [
      '查询笔记消耗聚合数据（noteConsumption 类型）。',
      '由 rt_creative + rt_ube_note 聚合生成，展示每条笔记的小时消耗汇总。',
      '适合查询"哪些笔记今天消耗最高"、"笔记消耗排行"等场景。',
      '数据来自 report_aggregations 集合。',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '流量项目 ID',
        },
        date: {
          type: 'string',
          description: '查询日期 YYYY-MM-DD，不传默认今天（北京时间）',
        },
        topN: {
          type: 'number',
          description: '返回消耗最高的 N 条笔记，默认 20，最大 100',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'query_offline_report',
    description: [
      '查询离线日报数据。数据每天 10:10（北京时间）更新前一天数据（T+1）。',
      '支持 3 种类型：',
      '  ol_account — 子账户消耗离线日报（来自 projectofflinereports）',
      '  ol_note    — 笔记消耗离线日报（标准，来自 noteofflinereports）',
      '  ol_ube_note— UBE 笔记离线日报（简单投放，来自 noteofflinereports）',
      '注意：10:10 前查询当天最新 = 前天数据。',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          description: '报表类型',
          enum: ['ol_account', 'ol_note', 'ol_ube_note'],
        },
        taskId: {
          type: 'string',
          description: '流量项目 ID',
        },
        date: {
          type: 'string',
          description: '查询日期 YYYY-MM-DD，不传默认昨天（T-1，北京时间）',
        },
        limit: {
          type: 'number',
          description: '返回条数，默认 50，最大 200',
        },
      },
      required: ['reportType', 'taskId'],
    },
  },
];

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

async function handleListTrafficTasks({ env } = {}) {
  const database = await getDb();
  const query = {};
  if (env) query.env = env;

  const tasks = await database.collection('consumptionmonitortasks')
    .find(query, {
      projection: { name: 1, advertisers: 1, feishuLinks: 1, env: 1, createdAt: 1 },
    })
    .sort({ createdAt: -1 })
    .toArray();

  return {
    total: tasks.length,
    tasks: tasks.map(t => ({
      id: t._id.toString(),
      name: t.name,
      env: t.env || 'production',
      advertiserCount: Array.isArray(t.advertisers) ? t.advertisers.length : 0,
      advertisers: t.advertisers,
      feishuLinks: t.feishuLinks,
    })),
  };
}

async function handleQueryRealtimeReport({ reportType, taskId, date, hour, limit = 50 } = {}) {
  const database = await getDb();
  const queryDate = date || todayBJ();
  const maxLimit = Math.min(limit, 200);

  const match = {
    reportType,
    taskId: toObjectId(taskId),
    date: queryDate,
  };
  if (hour !== undefined && hour !== null) match.hour = hour;

  const pipeline = [
    { $match: match },
    { $unwind: '$dtos' },
    { $sort: { 'dtos.fee': -1 } },
    { $limit: maxLimit },
    {
      $project: {
        _id: 0,
        advertiserId: 1,
        date: 1,
        hour: 1,
        chunkIndex: 1,
        data: '$dtos',
      },
    },
  ];

  const rows = await database.collection('raw_report_data')
    .aggregate(pipeline, { allowDiskUse: true })
    .toArray();

  // 取最新小时号（便于用户了解数据新鲜度）
  const hourSet = [...new Set(rows.map(r => r.hour))].sort((a, b) => b - a);

  return {
    reportType,
    taskId,
    date: queryDate,
    latestHour: hourSet[0] ?? null,
    hoursIncluded: hourSet,
    rowCount: rows.length,
    note: rows.length === maxLimit ? `已达返回上限 ${maxLimit} 条，可调大 limit 参数` : undefined,
    rows: rows.map(serializeDoc),
  };
}

async function handleQueryNoteConsumption({ taskId, date, topN = 20 } = {}) {
  const database = await getDb();
  const queryDate = date || todayBJ();
  const maxTopN = Math.min(topN, 100);

  const pipeline = [
    {
      $match: {
        reportType: 'noteConsumption',
        taskId: toObjectId(taskId),
        date: queryDate,
      },
    },
    { $unwind: '$rows' },
    { $sort: { 'rows.fee': -1 } },
    { $limit: maxTopN },
    {
      $project: {
        _id: 0,
        date: 1,
        hour: 1,
        note: '$rows',
      },
    },
  ];

  const rows = await database.collection('report_aggregations')
    .aggregate(pipeline, { allowDiskUse: true })
    .toArray();

  return {
    reportType: 'noteConsumption',
    taskId,
    date: queryDate,
    topN: maxTopN,
    rowCount: rows.length,
    rows: rows.map(serializeDoc),
  };
}

async function handleQueryOfflineReport({ reportType, taskId, date, limit = 50 } = {}) {
  const database = await getDb();
  const queryDate = date || yesterdayBJ();
  const maxLimit = Math.min(limit, 200);

  let collectionName;
  const query = { taskId: toObjectId(taskId), date: queryDate };

  if (reportType === 'ol_account') {
    collectionName = 'projectofflinereports';
  } else {
    // ol_note, ol_ube_note → noteofflinereports
    collectionName = 'noteofflinereports';
    query.reportType = reportType;
  }

  const rows = await database.collection(collectionName)
    .find(query)
    .sort({ fee: -1, totalFee: -1 })
    .limit(maxLimit)
    .toArray();

  return {
    reportType,
    collection: collectionName,
    taskId,
    date: queryDate,
    rowCount: rows.length,
    note: rows.length === 0
      ? `未找到数据。提示：离线报表每天 10:10 更新，10:10 前查询最新 = ${yesterdayBJ()} 的数据`
      : undefined,
    rows: rows.map(serializeDoc),
  };
}

// ─── Tool Dispatch ─────────────────────────────────────────────────────────────

async function executeTool(name, args) {
  switch (name) {
    case 'list_traffic_tasks':     return await handleListTrafficTasks(args);
    case 'query_realtime_report':  return await handleQueryRealtimeReport(args);
    case 'query_note_consumption': return await handleQueryNoteConsumption(args);
    case 'query_offline_report':   return await handleQueryOfflineReport(args);
    default: throw new Error(`未知工具: ${name}`);
  }
}

// ─── MCP Protocol Handler ──────────────────────────────────────────────────────

async function handleMcpRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'traffic-query', version: '1.0.0' },
      },
    };
  }

  if (method === 'notifications/initialized') return null;

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {};
    try {
      const result = await executeTool(name, args);
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
      };
    } catch (err) {
      process.stderr.write(`[traffic-query] Tool error: ${err.message}\n`);
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: `查询失败: ${err.message}` }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

// ─── 模式 A: stdio (本机开发) ─────────────────────────────────────────────────

function startStdioMode() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req;
    try { req = JSON.parse(trimmed); } catch { return; }

    const resp = await handleMcpRequest(req);
    if (resp !== null) {
      process.stdout.write(JSON.stringify(resp) + '\n');
    }
  });

  rl.on('close', async () => {
    await client.close().catch(() => {});
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await client.close().catch(() => {});
    process.exit(0);
  });

  process.stderr.write('[traffic-query] 启动 stdio 模式（本机开发）\n');
}

// ─── 模式 B: HTTP (迁移到另一台 Mac 后使用) ───────────────────────────────────

function startHttpMode() {
  const http = require('http');

  const server = http.createServer(async (req, res) => {
    // 鉴权
    if (SERVICE_TOKEN) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${SERVICE_TOKEN}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404);
      res.end();
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let mcpReq;
      try { mcpReq = JSON.parse(body); } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const resp = await handleMcpRequest(mcpReq);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resp));
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    process.stderr.write(`[traffic-query] 启动 HTTP 模式，监听 0.0.0.0:${PORT}/mcp\n`);
    if (!SERVICE_TOKEN) {
      process.stderr.write('[traffic-query] 警告: SERVICE_TOKEN 未设置，接口无鉴权保护\n');
    }
  });

  process.on('SIGTERM', async () => {
    server.close();
    await client.close().catch(() => {});
    process.exit(0);
  });
}

// ─── 启动 ──────────────────────────────────────────────────────────────────────

if (HTTP_MODE) {
  startHttpMode();
} else {
  startStdioMode();
}
