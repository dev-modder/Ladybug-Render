/**
 * ╔══════════════════════════════════════════╗
 *   🐞  LADYBUG BOT — PAIRING SITE  🐞
 *   by dev-modder | v2.0
 * ╚══════════════════════════════════════════╝
 *
 * Generates a WhatsApp session string (LadybugBot! format)
 * using Baileys pair code. No QR scan needed.
 */

'use strict';

const express = require('express');
const pino    = require('pino');
const path    = require('path');
const fs      = require('fs');
const zlib    = require('zlib');
const os      = require('os');
const crypto  = require('crypto');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Session cleanup map ──────────────────────────────────────────────────────
// jobId -> { sock, tmpDir, status, result, createdAt }
const jobs = new Map();

function cleanTmpDir(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

// Auto-expire jobs after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 10 * 60 * 1000) {
      if (job.sock) { try { job.sock.end(undefined); } catch (_) {} }
      cleanTmpDir(job.tmpDir);
      jobs.delete(id);
    }
  }
}, 60_000);

// ─── Encode session to LadybugBot! format ────────────────────────────────────
function encodeSession(credsPath) {
  const raw  = fs.readFileSync(credsPath, 'utf8');
  const comp = zlib.gzipSync(Buffer.from(raw, 'utf8'));
  return 'LadybugBot!' + comp.toString('base64');
}

// ─── POST /api/pair — start pairing ──────────────────────────────────────────
app.post('/api/pair', async (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  // Normalise: strip +, spaces, dashes
  phone = phone.replace(/[^\d]/g, '');
  if (phone.length < 7) return res.status(400).json({ error: 'Invalid phone number' });

  const jobId  = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `lb_session_${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const job = { sock: null, tmpDir, status: 'pending', result: null, createdAt: Date.now() };
  jobs.set(jobId, job);

  // Async — don't await
  (async () => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(tmpDir);
      const { version }          = await fetchLatestBaileysVersion();

      const logger = pino({ level: 'silent' });

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        browser: ['Chrome (Linux)', 'Chrome', '121.0.6167.160'],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        syncFullHistory:     false,
        downloadHistory:     false,
        markOnlineOnConnect: false,
        getMessage:          async () => undefined,
      });

      job.sock = sock;

      // Request pair code
      await new Promise(r => setTimeout(r, 2000));
      let code;
      try {
        code = await sock.requestPairingCode(phone);
      } catch (e) {
        job.status = 'error';
        job.result = { error: e.message || 'Failed to generate pair code' };
        cleanTmpDir(tmpDir);
        return;
      }

      code = code?.match(/.{1,4}/g)?.join('-') || code;
      job.status = 'code_ready';
      job.result = { pairCode: code };

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          // Wait for creds to be written
          await new Promise(r => setTimeout(r, 2000));
          const credsFile = path.join(tmpDir, 'creds.json');
          if (fs.existsSync(credsFile)) {
            const sessionId = encodeSession(credsFile);
            job.status = 'success';
            job.result = { sessionId, pairCode: code };
          } else {
            job.status = 'error';
            job.result = { error: 'Session file not found after connection' };
          }
          try { sock.end(undefined); } catch (_) {}
          cleanTmpDir(tmpDir);
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (job.status !== 'success') {
            job.status = 'error';
            job.result = { error: `Connection closed (code ${code})` };
          }
          cleanTmpDir(tmpDir);
        }
      });

    } catch (err) {
      job.status = 'error';
      job.result = { error: err.message };
      cleanTmpDir(tmpDir);
    }
  })();

  res.json({ jobId, status: 'pending' });
});

// ─── GET /api/status/:jobId ───────────────────────────────────────────────────
app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json({ status: job.status, result: job.result });
});

// ─── Serve index for any other route ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🐞 Ladybug Pairing Site running on port ${PORT}`);
});
