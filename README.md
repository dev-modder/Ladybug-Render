<div align="center">

# 🐞 Ladybug Bot — Render Deployer v2.0

**The best one-click VPS wrapper for [Ladybug Bot Mini](https://github.com/dev-modder/Ladybug-Mini) on [Render.com](https://render.com)**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/dev-modder/Ladybug-Render)

*by [dev-modder](https://github.com/dev-modder)*

</div>

---

## ✨ What's included

| Feature | Description |
|---|---|
| 🤖 **Auto-clone & deploy** | Clones Ladybug Bot from GitHub automatically on every deploy |
| ⚙️ **Config auto-patching** | Injects `SESSION_ID`, owner number, bot name, prefix from env vars — zero manual editing |
| 🔄 **Smart auto-restart** | Exponential backoff crash recovery (3s → 6s → 12s → ... up to 60s) |
| 📊 **Live dashboard** | Beautiful web dashboard with real-time status, uptime, memory, restart count |
| 📡 **WebSocket log stream** | Logs stream live to the browser via WebSocket |
| 🔌 **REST API** | `/api/status` and `/api/logs` endpoints |
| 🔁 **Auto-update** | Pulls latest bot code from GitHub on every restart (configurable) |
| 🛑 **Graceful shutdown** | Handles SIGTERM/SIGINT cleanly so WhatsApp doesn't flag the session |
| 🐞 **Pairing website** | Your own branded session generator — no QR scan, just phone number + pair code |

---

## 🚀 Quick Deploy (2 minutes)

### Step 1 — Get your Session ID

Deploy the **pairing site** first (it's a separate Render service):

1. Click **Deploy to Render** above
2. Render will create TWO services: the bot AND the pairing site
3. Open your `ladybug-pairing` service URL
4. Enter your WhatsApp number
5. Open WhatsApp → **Linked Devices** → **Link a device** → **Link with phone number**
6. Enter the pair code shown on screen
7. Your `SESSION_ID` appears — copy it

### Step 2 — Set environment variables

In your `ladybug-bot` Render service → **Environment**:

| Variable | Required | Value |
|---|---|---|
| `SESSION_ID` | ✅ | Your `LadybugBot!...` string from pairing site |
| `OWNER_NUMBER` | ✅ | Your number without `+` e.g. `263786831091` |
| `OWNER_NAME` | Optional | Your name |
| `BOT_NAME` | Optional | Custom bot name (default: `Ladybug Bot V5`) |
| `PREFIX` | Optional | Command prefix (default: `.`) |
| `BOT_REPO` | Optional | Override with your fork URL |
| `BOT_BRANCH` | Optional | Git branch to use (default: `main`) |
| `AUTO_UPDATE` | Optional | `true`/`false` — pull latest code on restart (default: `true`) |
| `OPENAI_API_KEY` | Optional | For AI features in the bot |

### Step 3 — Done

Your bot is live. Visit your service URL to see the dashboard.

---

## 📊 Dashboard

Every deployment gets a live dashboard at your Render service URL:

- **Status** — running / crashed / restarting
- **Uptime** — how long since last start
- **Restarts** — crash counter
- **Memory** — RSS usage
- **Live logs** — streaming via WebSocket

API endpoints:
- `GET /api/status` — JSON status + last 100 log lines
- `GET /api/logs` — JSON full log history

---

## 🐞 Pairing Site

Your own session generator at `ladybug-pairing.onrender.com`:

- Enter phone number → get pair code → enter on WhatsApp → session ID appears
- Beautiful dark UI with animated ladybug
- Sessions encoded in `LadybugBot!` format compatible with the bot
- Auto-cleans sessions after 10 minutes
- Works with any Baileys-based bot

---

## 🔧 Using your own fork

Just set:
```
BOT_REPO=https://github.com/YOUR_USERNAME/YOUR_FORK.git
```

The launcher will clone your fork instead of the original.

---

## 💡 Tips

- **Free plan on Render** spins down after 15 min of inactivity. Use [UptimeRobot](https://uptimerobot.com) to ping your URL every 5 minutes.
- Session data is rebuilt from `SESSION_ID` env var on every deploy — no persistent disk needed.
- Set `AUTO_UPDATE=false` if you've pinned a specific bot version.
- Multiple bots = deploy multiple instances, each with their own `SESSION_ID`.

---

## 📁 Project structure

```
Ladybug-Render/
├── start.js              ← Enhanced VPS launcher with dashboard
├── package.json
├── render.yaml           ← Render Blueprint (both services)
├── .gitignore
├── README.md
└── pairing-site/
    ├── server.js         ← Express + Baileys pairing backend
    ├── package.json
    └── public/
        └── index.html    ← Beautiful pairing UI
```

---

<div align="center">
Made with ❤️ by <a href="https://github.com/dev-modder">dev-modder</a> ·
<a href="https://github.com/dev-modder/Ladybug-Mini">Ladybug Bot Mini</a>
</div>
