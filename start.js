/**
 * Render.com Launcher for Ladybug Bot Mini
 * ─────────────────────────────────────────
 * 1. Clones the bot repo into ./bot/
 * 2. Copies user config (SESSION_ID, ownerNumber, etc.) into config.js
 * 3. Installs npm dependencies
 * 4. Starts a tiny Express health-check server (keeps Render service alive)
 * 5. Spawns the bot process
 */

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');

// ─── Config from env ────────────────────────────────────────────────────────
const BOT_REPO      = process.env.BOT_REPO || 'https://github.com/dev-modder/Ladybug-Mini.git';
const SESSION_ID    = process.env.SESSION_ID    || '';
const OWNER_NUMBER  = process.env.OWNER_NUMBER  || '';
const OWNER_NAME    = process.env.OWNER_NAME    || 'Owner';
const BOT_NAME      = process.env.BOT_NAME      || 'Ladybug Bot V5';
const PREFIX        = process.env.PREFIX        || '.';
const PORT          = parseInt(process.env.PORT || '3000', 10);
const BOT_DIR       = path.join(__dirname, 'bot');

// ─── Health check server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'online',
    bot: BOT_NAME,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`✅ Health server listening on port ${PORT}`);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function patchConfig() {
  const configPath = path.join(BOT_DIR, 'config.js');
  let src = fs.readFileSync(configPath, 'utf8');

  // SESSION_ID
  if (SESSION_ID) {
    src = src.replace(
      /sessionID:\s*process\.env\.SESSION_ID\s*\|\|.*?,/,
      `sessionID: process.env.SESSION_ID || '${SESSION_ID}',`
    );
    // Also ensure process.env fallback is preserved cleanly
    src = src.replace(
      /sessionID:\s*'[^']*'/,
      `sessionID: process.env.SESSION_ID || '${SESSION_ID}'`
    );
  }

  // ownerNumber
  if (OWNER_NUMBER) {
    const numbers = OWNER_NUMBER.split(',').map(n => `'${n.trim()}'`).join(', ');
    src = src.replace(/ownerNumber:\s*\[.*?\]/, `ownerNumber: [${numbers}]`);
  }

  // ownerName
  if (OWNER_NAME) {
    const names = OWNER_NAME.split(',').map(n => `'${n.trim()}'`).join(', ');
    src = src.replace(/ownerName:\s*\[.*?\]/, `ownerName: [${names}]`);
  }

  // botName
  if (BOT_NAME) {
    src = src.replace(/botName:\s*'[^']*'/, `botName: '${BOT_NAME}'`);
  }

  // prefix
  if (PREFIX) {
    src = src.replace(/prefix:\s*'[^']*'/, `prefix: '${PREFIX}'`);
  }

  fs.writeFileSync(configPath, src, 'utf8');
  console.log('✅ config.js patched with your environment variables');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Clone or pull the bot repo
  if (!fs.existsSync(BOT_DIR)) {
    console.log(`\n📦 Cloning bot from ${BOT_REPO} …`);
    run(`git clone --depth 1 ${BOT_REPO} bot`);
  } else {
    console.log('\n🔄 Bot directory exists — pulling latest …');
    run('git pull --rebase', { cwd: BOT_DIR });
  }

  // 2. Patch config.js with user environment values
  console.log('\n⚙️  Patching config.js …');
  patchConfig();

  // 3. Install dependencies
  console.log('\n📥 Installing npm dependencies …');
  run('npm install --production --legacy-peer-deps', { cwd: BOT_DIR });

  // 4. Spawn the bot
  console.log('\n🤖 Starting bot …\n');
  const bot = spawn('node', ['index.js'], {
    cwd: BOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      SESSION_ID: SESSION_ID || process.env.SESSION_ID || ''
    }
  });

  bot.on('exit', (code, signal) => {
    console.log(`\n⚠️  Bot exited (code=${code}, signal=${signal}). Restarting in 5s …`);
    setTimeout(main, 5000);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot process error:', err.message);
    setTimeout(main, 5000);
  });
}

main().catch(err => {
  console.error('Fatal error in launcher:', err);
  process.exit(1);
});
