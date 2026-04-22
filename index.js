import qrcode from "qrcode-terminal";
import baileysPkg from "@whiskeysockets/baileys";
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = baileysPkg;
import fs from "fs";
import pino from "pino";
import { config, state } from "./lib/config.js";
import { ensureSessionFromEnv, SESSION_DIR } from "./lib/session.js";
import { getText, parseCommand, isOwner, jidToNumber } from "./lib/utils.js";
import { commands } from "./commands/index.js";
import { aiReply } from "./lib/ai.js";
import { rememberMessage, recallMessage } from "./lib/store.js";

const logger = pino({ level: "silent" });

async function start() {
  ensureSessionFromEnv();

  const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: authState,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  // Login: print BOTH a scannable QR and a pairing code on every QR rotation.
  // Use whichever works. Fresh code/QR auto-prints every ~60s.
  if (!sock.authState.creds.registered) {
    sock.__lastPairingAt = 0;
    sock.ev.on("connection.update", async (u) => {
      if (!u.qr) return;
      const now = Date.now();
      if (now - sock.__lastPairingAt < 25_000) return;
      sock.__lastPairingAt = now;

      // Print QR code (scan from Linked Devices)
      console.log("\n📷 SCAN THIS QR (WhatsApp → Linked Devices → Link a device):\n");
      qrcode.generate(u.qr, { small: true });

      // Print pairing code (alternative: type 8 characters)
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const code = await sock.requestPairingCode(config.OWNER_NUMBER);
        const pretty = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log("\n========================================");
        console.log(`🔗 OR TYPE THIS CODE: ${pretty}`);
        console.log(`   Number: +${config.OWNER_NUMBER}`);
        console.log("   WhatsApp → Linked Devices → Link with phone number");
        console.log("   This code expires in ~60s — a new one auto-prints.");
        console.log("========================================\n");
      } catch (e) {
        console.error("[pairing] failed:", e.message);
      }
    });
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      console.log("[connection] QR received but QR mode disabled. Provide SESSION_ID secret.");
    }
    if (connection === "open") {
      console.log(`[${config.BOT_NAME}] ✅ Connected as ${sock.user?.id}`);
      try {
        sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, {
          text: `🤖 *${config.BOT_NAME}* is online.\nMode: ${state.mode}\nPrefixes: ${config.PREFIXES.join(" ")}`,
        });
      } catch {}
    } else if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      const wasRegistered = sock.authState.creds.registered;
      console.log(`[connection] closed (code=${code}). registered=${wasRegistered}`);

      // If we got logged-out BEFORE pairing ever succeeded (i.e. stale half-creds
      // from a failed pairing attempt), wipe the session folder and restart so a
      // fresh pairing code is generated next time.
      if (loggedOut && !wasRegistered) {
        console.log("[connection] Stale half-paired session detected — wiping and restarting for a new code.");
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
        try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch {}
        setTimeout(start, 1500);
        return;
      }
      if (loggedOut) {
        console.log("[connection] Logged out from phone. Wiping session.");
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
        try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch {}
        setTimeout(start, 2000);
        return;
      }
      setTimeout(start, 2000);
    }
  });

  // Anti-call
  sock.ev.on("call", async (calls) => {
    if (!state.anticall) return;
    for (const c of calls) {
      if (c.status === "offer") {
        try {
          await sock.rejectCall(c.id, c.from);
          await sock.sendMessage(c.from, { text: "📵 Calls are not allowed. You have been blocked briefly." });
        } catch {}
      }
    }
  });

  // Anti-delete + Anti-edit (looks up cached original content)
  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const isDelete =
        u.update?.message === null ||
        u.update?.messageStubType === 68 ||
        u.update?.message?.protocolMessage?.type === 0;

      const editedMsg = u.update?.message?.editedMessage?.message
        || u.update?.message?.protocolMessage?.editedMessage;

      if (isDelete && state.antidelete) {
        const orig = recallMessage(u.key.id);
        const senderNum = (u.key.participant || u.key.remoteJid || "").split("@")[0];
        const chat = u.key.remoteJid || "?";
        let body = `🗑️ *Anti-Delete*\nChat: ${chat}\nFrom: ${senderNum}`;
        if (orig?.text) body += `\n\n💬 ${orig.text}`;
        else if (orig?.media) body += `\n\nDeleted media: ${orig.media}`;
        else body += `\n\n(content not cached)`;
        try { await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, { text: body }); } catch {}
      }

      if (editedMsg && state.antiedit) {
        const orig = recallMessage(u.key.id);
        const newText =
          editedMsg.conversation ||
          editedMsg.extendedTextMessage?.text ||
          "";
        const senderNum = (u.key.participant || u.key.remoteJid || "").split("@")[0];
        const body =
          `✏️ *Anti-Edit*\nChat: ${u.key.remoteJid}\nFrom: ${senderNum}\n\n` +
          `Before: ${orig?.text || "(not cached)"}\n` +
          `After: ${newText || "(empty)"}`;
        try { await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, { text: body }); } catch {}
      }
    }
  });

  // Auto status view
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      rememberMessage(msg);
      const jid = msg.key.remoteJid;

      // Auto-status read
      if (jid === "status@broadcast") {
        if (state.autostatus) {
          try { await sock.readMessages([msg.key]); } catch {}
        }
        continue;
      }

      const fromMe = msg.key.fromMe;
      const sender = msg.key.participant || jid;
      const text = getText(msg).trim();
      if (!text) continue;

      // Auto-read
      if (state.autoread && !fromMe) {
        try { await sock.readMessages([msg.key]); } catch {}
      }

      // Auto-typing
      if (state.autotyping && !fromMe) {
        try { await sock.sendPresenceUpdate("composing", jid); } catch {}
      }

      // Auto-react
      if (state.autoreact && !fromMe) {
        try {
          const emojis = ["💚", "🔥", "✨", "👀", "👌", "🚀"];
          await sock.sendMessage(jid, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key } });
        } catch {}
      }

      // PM blocker
      if (state.pmblocker && !fromMe && jid.endsWith("@s.whatsapp.net") && !isOwner(sender)) {
        try { await sock.sendMessage(jid, { text: "🚫 PMs are blocked by the owner." }); } catch {}
        continue;
      }

      // Custom auto-replies
      const lower = text.toLowerCase();
      for (const [trigger, response] of state.replies) {
        if (lower.includes(trigger)) {
          try { await sock.sendMessage(jid, { text: response }, { quoted: msg }); } catch {}
          break;
        }
      }

      // Command handling
      const parsed = parseCommand(text);

      // AI auto-reply for DMs (skip if it's a command or own message)
      if (
        !parsed &&
        !fromMe &&
        state.autoAiReply &&
        jid.endsWith("@s.whatsapp.net") &&
        !isOwner(sender)
      ) {
        try {
          await sock.sendPresenceUpdate("composing", jid);
          const ans = await aiReply(jid, text);
          if (ans) await sock.sendMessage(jid, { text: ans }, { quoted: msg });
          await sock.sendPresenceUpdate("paused", jid);
        } catch (e) {
          console.error("[ai-auto]", e.message);
        }
        continue;
      }

      if (!parsed) continue;

      const owner = isOwner(sender);
      const sudo = state.sudo.has(jidToNumber(sender));

      if (state.maintenance && !owner) {
        try { await sock.sendMessage(jid, { text: "🛠️ Bot is under maintenance." }, { quoted: msg }); } catch {}
        continue;
      }
      if (state.mode === "private" && !owner && !sudo) continue;

      // Custom commands
      if (state.customCmds.has(parsed.cmd)) {
        try { await sock.sendMessage(jid, { text: state.customCmds.get(parsed.cmd) }, { quoted: msg }); } catch {}
        continue;
      }

      const entry = commands[parsed.cmd];
      if (!entry) continue;

      if (state.cmdreact) {
        try { await sock.sendMessage(jid, { react: { text: "⚡", key: msg.key } }); } catch {}
      }

      try {
        await entry.handler({ sock, jid, msg, sender, args: parsed.args, body: parsed.body, cmd: parsed.cmd });
      } catch (err) {
        console.error(`[cmd:${parsed.cmd}]`, err);
        try { await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg }); } catch {}
      }
    }
  });
}

process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

start().catch((e) => {
  console.error("[fatal]", e);
  setTimeout(() => process.exit(1), 1000);
});
