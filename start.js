/**
 * ╔══════════════════════════════════════════════╗
 *   🐞  LADYBUG BOT — RENDER.COM LAUNCHER  🐞
 *   Enhanced VPS Wrapper v2.0 by dev-modder
 * ╚══════════════════════════════════════════════╝
 *
 * Features:
 *  - Auto-clone & auto-update bot from GitHub
 *  - Config auto-patching from env vars
 *  - Smart crash recovery with exponential backoff
 *  - Live dashboard UI (status, uptime, logs)
 *  - WebSocket live log streaming
 *  - Memory monitoring
 *  - Graceful shutdown handler
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const crypto = require('crypto');

// ─── Environment ──────────────────────────────────────────────────────────────
const BOT_REPO     = process.env.BOT_REPO     || 'https://github.com/dev-modder/Ladybug-Mini.git';
const BOT_BRANCH   = process.env.BOT_BRANCH   || 'main';
const SESSION_ID   = process.env.SESSION_ID   || '';
const OWNER_NUMBER = process.env.OWNER_NUMBER || '';
const OWNER_NAME   = process.env.OWNER_NAME   || 'Owner';
const BOT_NAME     = process.env.BOT_NAME     || 'Ladybug Bot V5';
const PREFIX       = process.env.PREFIX       || '.';
const PORT         = parseInt(process.env.PORT || '3000', 10);
const AUTO_UPDATE  = process.env.AUTO_UPDATE  !== 'false';
const BOT_DIR      = path.join(__dirname, 'bot');
const LOG_FILE     = path.join(__dirname, 'launcher.log');
const MAX_LOGS     = 500;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  status:       'starting',
  startTime:    null,
  botPid:       null,
  restarts:     0,
  lastCrash:    null,
  lastCrashMsg: '',
  logs:         [],
  wsClients:    new Set(),
};

// ─── Logger ───────────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts   = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  console.log(line);
  state.logs.push({ ts, level, msg });
  if (state.logs.length > MAX_LOGS) state.logs.shift();
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
  broadcast({ type: 'log', ts, level, msg });
}

// ─── WebSocket broadcast ──────────────────────────────────────────────────────
function broadcast(data) {
  const json = JSON.stringify(data);
  for (const ws of state.wsClients) {
    try { ws.send(json); } catch (_) { state.wsClients.delete(ws); }
  }
}

// ─── Dashboard HTML ───────────────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>🐞 Ladybug Bot Dashboard</title>
<style>
:root{--red:#e53e3e;--green:#38a169;--yellow:#d69e2e;--blue:#3182ce;--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:20px 24px}
h1{font-size:1.5rem;margin-bottom:4px}
.sub{color:var(--muted);font-size:.85rem;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}
.card h3{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.card .val{font-size:1.4rem;font-weight:700}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;text-transform:uppercase}
.badge.running{background:#1a4731;color:#4ade80}
.badge.crashed{background:#450a0a;color:#f87171}
.badge.starting,.badge.restarting{background:#451a03;color:#fbbf24}
.badge.stopped{background:#1c1f26;color:var(--muted)}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.green{background:#4ade80;box-shadow:0 0 5px #4ade80}
.dot.red{background:#f87171}
.dot.yellow{background:#fbbf24;box-shadow:0 0 5px #fbbf24}
.logs-wrap h2{font-size:.95rem;color:var(--muted);margin-bottom:10px}
.logs-box{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;height:380px;overflow-y:auto;font-family:'Courier New',monospace;font-size:.76rem;line-height:1.6}
.log-line.error{color:#f87171}.log-line.warn{color:#fbbf24}.log-line.info{color:#93c5fd}.log-line.debug{color:var(--muted)}
.ts{color:var(--muted);margin-right:8px;user-select:none}
footer{margin-top:20px;text-align:center;color:var(--muted);font-size:.8rem}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<h1>🐞 Ladybug Bot — Dashboard</h1>
<p class="sub">Live monitoring · auto-refresh every 5s</p>
<div class="grid">
  <div class="card"><h3>Status</h3><div class="val" id="statusBadge">—</div></div>
  <div class="card"><h3>Uptime</h3><div class="val" id="uptime">—</div></div>
  <div class="card"><h3>Restarts</h3><div class="val" id="restarts">—</div></div>
  <div class="card"><h3>Memory</h3><div class="val" id="memory">—</div></div>
  <div class="card"><h3>Node</h3><div class="val" id="node">—</div></div>
  <div class="card"><h3>Bot</h3><div class="val" id="botName" style="font-size:.95rem;padding-top:4px">—</div></div>
</div>
<div class="logs-wrap">
  <h2>📋 Live Logs</h2>
  <div class="logs-box" id="logsBox"></div>
</div>
<footer style="margin-top:20px">
  Ladybug Bot Launcher v2.0 ·
  <a href="https://github.com/dev-modder/Ladybug-Render" target="_blank">GitHub</a> ·
  <a href="/api/status">API</a>
</footer>
<script>
const logsBox=document.getElementById('logsBox');
function fmtUptime(s){const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);return d>0?\`\${d}d \${h}h \${m}m\`:\`\${h}h \${m}m \${sec}s\`;}
function fmtMB(b){return (b/1024/1024).toFixed(1)+' MB';}
function appendLog({ts,level,msg}){
  const el=document.createElement('div');
  el.className='log-line '+(level||'info');
  el.innerHTML=\`<span class="ts">\${ts.slice(11,19)}</span>\${msg.replace(/</g,'&lt;')}\`;
  logsBox.appendChild(el);
  if(logsBox.children.length>400)logsBox.removeChild(logsBox.firstChild);
  logsBox.scrollTop=logsBox.scrollHeight;
}
function dotClass(s){return s==='running'?'green':s==='crashed'?'red':'yellow';}
function updateStatus(d){
  document.getElementById('statusBadge').innerHTML=\`<span class="badge \${d.status}"><span class="dot \${dotClass(d.status)}"></span>\${d.status}</span>\`;
  document.getElementById('uptime').textContent=d.startTime?fmtUptime((Date.now()-new Date(d.startTime))/1000):'—';
  document.getElementById('restarts').textContent=d.restarts;
  if(d.memory)document.getElementById('memory').textContent=fmtMB(d.memory.rss);
  document.getElementById('node').textContent=d.node||'—';
  document.getElementById('botName').textContent=d.botName||'—';
}
fetch('/api/status').then(r=>r.json()).then(d=>{updateStatus(d);(d.recentLogs||[]).forEach(appendLog);});
setInterval(()=>fetch('/api/status').then(r=>r.json()).then(updateStatus),5000);
try{
  const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
  ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='log')appendLog(d);else if(d.type==='status')updateStatus(d);};
}catch(e){}
</script>
</body>
</html>`;

// ─── WebSocket handshake ──────────────────────────────────────────────────────
function doWsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  const ws = {
    socket,
    send(data) {
      const buf = Buffer.from(data);
      const hdr = Buffer.alloc(buf.length < 126 ? 2 : 4);
      hdr[0] = 0x81;
      if (buf.length < 126) { hdr[1] = buf.length; }
      else { hdr[1] = 126; hdr.writeUInt16BE(buf.length, 2); }
      try { socket.write(Buffer.concat([hdr, buf])); } catch (_) {}
    }
  };
  state.wsClients.add(ws);
  socket.on('close', () => state.wsClients.delete(ws));
  socket.on('error', () => state.wsClients.delete(ws));
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({
      status:       state.status,
      startTime:    state.startTime,
      restarts:     state.restarts,
      lastCrash:    state.lastCrash,
      lastCrashMsg: state.lastCrashMsg,
      memory:       process.memoryUsage(),
      node:         process.version,
      botName:      BOT_NAME,
      botRepo:      BOT_REPO,
      recentLogs:   state.logs.slice(-100),
    }));
  }
  if (url === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ logs: state.logs }));
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(DASHBOARD_HTML);
});

server.on('upgrade', (req, socket) => {
  if (req.url === '/ws') doWsHandshake(req, socket);
  else socket.destroy();
});

server.listen(PORT, () => log('info', `✅ Dashboard live → port ${PORT}`));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  log('info', `▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function patchConfig() {
  const configPath = path.join(BOT_DIR, 'config.js');
  if (!fs.existsSync(configPath)) { log('warn', 'config.js not found — skip patch'); return; }
  let src = fs.readFileSync(configPath, 'utf8');

  // SESSION_ID — always defer to env var at runtime
  src = src.replace(
    /sessionID:\s*process\.env\.SESSION_ID\s*\|\|[^,\n]+/,
    `sessionID: process.env.SESSION_ID || '${SESSION_ID}'`
  );
  src = src.replace(/sessionID:\s*'[^']*'/, `sessionID: process.env.SESSION_ID || '${SESSION_ID}'`);

  if (OWNER_NUMBER) {
    const nums = OWNER_NUMBER.split(',').map(n => `'${n.trim()}'`).join(', ');
    src = src.replace(/ownerNumber:\s*\[[^\]]*\]/, `ownerNumber: [${nums}]`);
  }
  if (OWNER_NAME) {
    const names = OWNER_NAME.split(',').map(n => `'${n.trim()}'`).join(', ');
    src = src.replace(/ownerName:\s*\[[^\]]*\]/, `ownerName: [${names}]`);
  }
  if (BOT_NAME)  src = src.replace(/botName:\s*'[^']*'/, `botName: '${BOT_NAME}'`);
  if (PREFIX)    src = src.replace(/prefix:\s*'[^']*'/,  `prefix: '${PREFIX}'`);

  fs.writeFileSync(configPath, src, 'utf8');
  log('info', '✅ config.js patched');
}

// ─── Bot lifecycle ────────────────────────────────────────────────────────────
let botProcess   = null;
let restartDelay = 3000;

function setStatus(s) {
  state.status = s;
  broadcast({ type: 'status', status: s, startTime: state.startTime,
    restarts: state.restarts, memory: process.memoryUsage(),
    node: process.version, botName: BOT_NAME });
}

function spawnBot() {
  setStatus('starting');
  log('info', `🤖 Spawning bot [restart #${state.restarts}] …`);

  botProcess = spawn('node', ['index.js'], {
    cwd: BOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SESSION_ID, FORCE_COLOR: '1' },
  });

  state.botPid   = botProcess.pid;
  state.startTime = new Date().toISOString();
  setStatus('running');
  restartDelay   = 3000;

  botProcess.stdout.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => log('info', l)));
  botProcess.stderr.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => log('error', l)));

  botProcess.on('exit', (code, signal) => {
    state.lastCrash    = new Date().toISOString();
    state.lastCrashMsg = `code=${code}, signal=${signal}`;
    state.restarts++;
    setStatus('crashed');
    log('warn', `⚠️  Bot exited (${state.lastCrashMsg}). Restarting in ${restartDelay / 1000}s …`);
    setTimeout(() => { setStatus('restarting'); spawnBot(); }, restartDelay);
    restartDelay = Math.min(restartDelay * 2, 60000);
  });

  botProcess.on('error', err => log('error', `❌ Spawn error: ${err.message}`));
}

// ─── Repo setup ───────────────────────────────────────────────────────────────
function setupRepo() {
  if (!fs.existsSync(BOT_DIR)) {
    log('info', `📦 Cloning ${BOT_REPO} …`);
    run(`git clone --depth 1 --branch ${BOT_BRANCH} ${BOT_REPO} bot`);
  } else if (AUTO_UPDATE) {
    log('info', '🔄 Pulling latest updates …');
    try {
      run(`git -C bot fetch --depth 1 origin ${BOT_BRANCH}`);
      run(`git -C bot reset --hard origin/${BOT_BRANCH}`);
    } catch (e) {
      log('warn', `Pull failed (${e.message}) — using existing code`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('info', '╔══════════════════════════════════════╗');
  log('info', '  🐞  LADYBUG BOT LAUNCHER v2.0  🐞');
  log('info', '╚══════════════════════════════════════╝');
  log('info', `Bot: ${BOT_NAME} | Repo: ${BOT_REPO} | Branch: ${BOT_BRANCH}`);

  setupRepo();
  patchConfig();

  log('info', '📥 Installing dependencies …');
  run('npm install --production --legacy-peer-deps', { cwd: BOT_DIR });

  spawnBot();
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(sig) {
  log('info', `🛑 ${sig} received — shutting down …`);
  setStatus('stopped');
  if (botProcess) botProcess.kill('SIGTERM');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => log('error', `Uncaught: ${err.message}`));
process.on('unhandledRejection', r   => log('error', `Rejection: ${r}`));

main().catch(err => { log('error', `Fatal: ${err.message}`); process.exit(1); });
