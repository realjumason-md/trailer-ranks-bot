# TRAILER LIERS — WhatsApp MD Bot

A clean, stable Baileys MD WhatsApp bot built with Node.js. Logs in via pairing code (no QR) and runs 24/7.

## Features

- Pairing-code login (set `OWNER_NUMBER` and link from your phone — no QR scanner needed)
- AI auto-reply with conversation memory (`.aion` / `.aioff`)
- Anti-call, anti-delete, auto-react, auto-read, auto-typing, auto-status, PM blocker
- Custom auto-replies (`.addreply`, `.delreply`, `.listreplies`)
- Custom commands (`.setcmd`, `.delcmd`)
- Broadcast to groups and DMs
- Group join/leave, mention all, profile bio/pp
- Rent / sudo system, public/private mode, maintenance mode
- 40+ commands — type `.menu` in chat for the full list

## Configuration (`bot/lib/config.js`)

```js
BOT_NAME      = "TRAILER LIERS"
OWNER_NUMBER  = "256706106326"
PREFIXES      = ["😀", ".", "!"]
TIME_ZONE     = "Africa/Kampala"
```

## Environment variables

| Name             | Required | Purpose |
|------------------|----------|---------|
| `SESSION_ID`     | optional | Base64 creds string from a session generator. If unset, the bot prints a pairing code on first boot. |
| `OPENAI_API_KEY` | optional | Enables `.aion` AI auto-reply. |

## Run locally

```bash
npm install
node index.js
```

Watch the logs for the pairing code, then on your phone:
**WhatsApp → Linked Devices → Link a device → Link with phone number** → enter the 8-character code.

The session is saved to `bot/sessions/` after pairing and reused on every restart.

## Deploy on Railway (one click)

After pushing this folder to a GitHub repo (e.g. `realjumason-md/trailer-liers-bot`), use this badge in your repo README to let anyone deploy with one click:

```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/realjumason-md/trailer-liers-bot)
```

Or do it manually:
1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app), create a new project → **Deploy from GitHub repo**.
3. Set env vars in Railway: `OPENAI_API_KEY` (optional), and optionally `SESSION_ID` if you generated one.
4. Railway picks up `railway.json` and `Procfile` automatically. The bot starts and prints the pairing code in the deployment logs — open them and link your phone within 60 seconds.

## Free always-on hosts (Mega-MD style)

| Host | Free tier | Notes |
|---|---|---|
| **Koyeb** | Free worker, always-on | Simplest — Worker service type, GitHub deploy |
| **Railway** | $5 free credit/month | Pre-configured here (`railway.json`) |
| **Render** | Free background worker | Sleeps after inactivity on free web tier — use Worker |
| **Fly.io** | Free shared VM | `fly launch` from this folder |
| **Bot-Hosting.net** | Free, designed for WA bots | Easiest if you don't want CLI work |

The session is persisted to `bot/sessions/creds.json` after pairing. As long as that folder survives restarts (use a Railway volume / Fly volume), the bot stays linked forever.

## Deploy on Render / Fly.io / Heroku

The included `Procfile` makes it work on any Procfile-based host. The start command is `node index.js`.

## File layout

```
bot/
├── index.js           # entrypoint + connection + event handlers
├── package.json
├── Procfile
├── railway.json
├── .gitignore
├── lib/
│   ├── config.js      # bot config + runtime state
│   ├── session.js     # SESSION_ID decoding & session dir
│   ├── utils.js       # helpers (parsing, owner check, etc.)
│   └── ai.js          # OpenAI client + chat memory
├── commands/
│   └── index.js       # all command handlers
└── sessions/          # auth state (gitignored)
```
