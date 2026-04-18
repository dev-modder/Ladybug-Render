# 🐞 Ladybug Bot — Render.com Deployer

One-click deployment wrapper for [Ladybug Bot Mini](https://github.com/dev-modder/Ladybug-Mini) on [Render.com](https://render.com).

## How it works

1. Render clones **this** repo and runs `node start.js`
2. The launcher automatically clones the latest Ladybug Bot source
3. It patches `config.js` with your environment variables (SESSION_ID, owner number, etc.)
4. Installs all dependencies and starts the bot
5. A tiny health-check HTTP server keeps Render from shutting the service down
6. If the bot crashes, it automatically restarts after 5 seconds

---

## 🚀 Deploy on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Step 1 — Get your Session ID

Go to **[https://knight-bot-paircode.onrender.com/](https://knight-bot-paircode.onrender.com/)**, enter your WhatsApp number, scan the QR or enter the pair code, and copy the session string that starts with `LadybugBot!...`

### Step 2 — Deploy

1. Fork this repo to your GitHub account
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub account and select this repo
4. Set the following **Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `SESSION_ID` | ✅ Yes | Your `LadybugBot!...` session string |
| `OWNER_NUMBER` | Recommended | Your WhatsApp number(s), comma-separated, no `+` (e.g. `263786831091`) |
| `OWNER_NAME` | Optional | Your name(s), comma-separated |
| `BOT_NAME` | Optional | Custom bot display name (default: `Ladybug Bot V5`) |
| `PREFIX` | Optional | Command prefix (default: `.`) |
| `BOT_REPO` | Optional | Override the bot repo URL (for custom forks) |

5. Click **Create Web Service** — Render will build and start the bot automatically.

---

## 🔁 Using a custom fork

If you've forked Ladybug Bot Mini and customized it, just set:

```
BOT_REPO=https://github.com/YOUR_USERNAME/YOUR_FORK.git
```

The launcher will clone your fork instead.

---

## 📋 Notes

- Render's **free tier** spins down after 15 minutes of inactivity — the health check endpoint (`/`) prevents this on paid plans. On the free plan, use [UptimeRobot](https://uptimerobot.com) to ping the URL every 5 minutes.
- Session data is stored in `/bot/session/` inside the Render container. It is NOT persistent across deploys on the free plan — keep your `SESSION_ID` env var set.
- This launcher does **not** modify the upstream Ladybug Bot source — it only patches `config.js` values from env vars.

---

Made with ❤️ by dev-modder
