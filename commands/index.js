import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config, state } from "../lib/config.js";
import { isOwner, jidToNumber, uptime, nowKampala } from "../lib/utils.js";
import { clearSession } from "../lib/session.js";
import { aiAvailable, clearHistory } from "../lib/ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();

function reply(sock, jid, text, quoted) {
  return sock.sendMessage(jid, { text }, { quoted });
}

const commands = {};

function register(names, handler, meta = {}) {
  const list = Array.isArray(names) ? names : [names];
  for (const n of list) commands[n.toLowerCase()] = { handler, meta, name: list[0] };
}

// ─── INFO / SYSTEM ────────────────────────────────────────────
register(["menu", "help", "listcmd"], async (ctx) => {
  const { buildMenu } = await import("../lib/menu.js");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const photoPath = path.join(__dirname, "..", "assets", "owner.jpg");
  const caption = buildMenu(Object.keys(commands).length);
  try {
    if (fs.existsSync(photoPath)) {
      await ctx.sock.sendMessage(
        ctx.jid,
        { image: fs.readFileSync(photoPath), caption },
        { quoted: ctx.msg },
      );
      return;
    }
  } catch (e) {
    // fall through to text
  }
  await reply(ctx.sock, ctx.jid, caption, ctx.msg);
});

register("setmenu", async (ctx) => {
  if (!isOwner(ctx)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const imgMsg = quoted?.imageMessage || ctx.msg.message?.imageMessage;
  if (!imgMsg) return reply(ctx.sock, ctx.jid, "Reply to (or send) an image with `.setmenu` to use it as the menu photo.", ctx.msg);
  try {
    const { downloadMediaMessage } = await import("@whiskeysockets/baileys");
    const fakeMsg = quoted
      ? { key: ctx.msg.key, message: quoted }
      : ctx.msg;
    const buf = await downloadMediaMessage(fakeMsg, "buffer", {});
    const out = path.join(__dirname, "..", "assets", "owner.jpg");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    await reply(ctx.sock, ctx.jid, "✅ Menu photo updated. Try `.menu` to see it.", ctx.msg);
  } catch (e) {
    await reply(ctx.sock, ctx.jid, `Failed: ${e.message}`, ctx.msg);
  }
});

register("sys", async (ctx) => {
  const mem = process.memoryUsage();
  const txt =
    `*${config.BOT_NAME} — System*\n` +
    `Platform: ${os.platform()} ${os.arch()}\n` +
    `Node: ${process.version}\n` +
    `CPU: ${os.cpus()[0].model}\n` +
    `RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
    `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\n` +
    `Uptime: ${uptime(process.uptime())}\n` +
    `Time (Kampala): ${nowKampala()}`;
  await reply(ctx.sock, ctx.jid, txt, ctx.msg);
});

register(["gitinfo", "inspect"], async (ctx) => {
  await reply(
    ctx.sock,
    ctx.jid,
    `*${config.BOT_NAME}*\nVersion: 1.0.0\nRuntime: Node ${process.version}\nBaileys: MD\nOwner: ${config.OWNER_NUMBER}`,
    ctx.msg,
  );
});

register("gitpull", async (ctx) => {
  await reply(ctx.sock, ctx.jid, "Pulling latest changes... (no-op in this environment)", ctx.msg);
});

register("reload", async (ctx) => {
  await reply(ctx.sock, ctx.jid, "♻️ Reload requested. The process manager will restart me shortly.", ctx.msg);
  setTimeout(() => process.exit(0), 800);
});

register(["settings", "manage"], async (ctx) => {
  const lines = Object.entries(state)
    .filter(([, v]) => typeof v === "boolean" || typeof v === "string")
    .map(([k, v]) => `• ${k}: ${v}`)
    .join("\n");
  await reply(ctx.sock, ctx.jid, `*Bot Settings*\n${lines}`, ctx.msg);
});

register("mode", async (ctx) => {
  const v = (ctx.args[0] || "").toLowerCase();
  if (v !== "public" && v !== "private") {
    return reply(ctx.sock, ctx.jid, `Mode: *${state.mode}*\nUsage: .mode public|private`, ctx.msg);
  }
  state.mode = v;
  await reply(ctx.sock, ctx.jid, `Mode set to *${v}*`, ctx.msg);
});

register("maintenance", async (ctx) => {
  state.maintenance = !state.maintenance;
  await reply(ctx.sock, ctx.jid, `Maintenance: *${state.maintenance ? "ON" : "OFF"}*`, ctx.msg);
});

// ─── TOGGLES ──────────────────────────────────────────────────
function toggle(key, label) {
  return async (ctx) => {
    const v = (ctx.args[0] || "").toLowerCase();
    if (v === "on") state[key] = true;
    else if (v === "off") state[key] = false;
    else state[key] = !state[key];
    await reply(ctx.sock, ctx.jid, `${label}: *${state[key] ? "ON" : "OFF"}*`, ctx.msg);
  };
}

register("anticall", toggle("anticall", "Anti-call"));
register("antidelete", toggle("antidelete", "Anti-delete"));
register("antiedit", toggle("antiedit", "Anti-edit"));
register("autoreact", toggle("autoreact", "Auto-react"));
register("autoread", toggle("autoread", "Auto-read"));
register(["autoaireply", "auto"], toggle("autoAiReply", "Auto AI reply"));

register("aion", async (ctx) => {
  if (!aiAvailable) return reply(ctx.sock, ctx.jid, "⚠️ AI is not configured. Set OPENAI_API_KEY.", ctx.msg);
  state.autoAiReply = true;
  await reply(ctx.sock, ctx.jid, `🤖 *AI auto-reply: ON*\nI'll now respond to DMs using past conversation context.`, ctx.msg);
});

register("aioff", async (ctx) => {
  state.autoAiReply = false;
  clearHistory(ctx.jid);
  await reply(ctx.sock, ctx.jid, `🛑 *AI auto-reply: OFF*\nConversation memory for this chat cleared.`, ctx.msg);
});

register("ai", async (ctx) => {
  if (!aiAvailable) return reply(ctx.sock, ctx.jid, "⚠️ AI is not configured.", ctx.msg);
  if (!ctx.body) return reply(ctx.sock, ctx.jid, "Usage: .ai <question>", ctx.msg);
  const { aiReply } = await import("../lib/ai.js");
  const ans = await aiReply(ctx.jid, ctx.body);
  await reply(ctx.sock, ctx.jid, ans || "Sorry, no response.", ctx.msg);
});
register("autostatus", toggle("autostatus", "Auto-status view"));
register("autotyping", toggle("autotyping", "Auto-typing"));
register("cmdreact", toggle("cmdreact", "Command reactions"));
register("pmblocker", toggle("pmblocker", "PM blocker"));
register("stealth", toggle("stealth", "Stealth"));

// ─── REPLIES / CUSTOM CMDS ────────────────────────────────────
register("addreply", async (ctx) => {
  const [trigger, ...rest] = ctx.body.split("|");
  if (!trigger || !rest.length) return reply(ctx.sock, ctx.jid, "Usage: .addreply trigger|response", ctx.msg);
  state.replies.set(trigger.trim().toLowerCase(), rest.join("|").trim());
  await reply(ctx.sock, ctx.jid, `✅ Reply saved for *${trigger.trim()}*`, ctx.msg);
});

register("delreply", async (ctx) => {
  const k = ctx.body.trim().toLowerCase();
  await reply(ctx.sock, ctx.jid, state.replies.delete(k) ? `🗑️ Removed *${k}*` : "Not found", ctx.msg);
});

register("listreplies", async (ctx) => {
  if (!state.replies.size) return reply(ctx.sock, ctx.jid, "No saved replies.", ctx.msg);
  const list = [...state.replies.entries()].map(([k, v]) => `• ${k} → ${v}`).join("\n");
  await reply(ctx.sock, ctx.jid, `*Auto-Replies*\n${list}`, ctx.msg);
});

register("setcmd", async (ctx) => {
  const [name, ...rest] = ctx.body.split("|");
  if (!name || !rest.length) return reply(ctx.sock, ctx.jid, "Usage: .setcmd name|response", ctx.msg);
  state.customCmds.set(name.trim().toLowerCase(), rest.join("|").trim());
  await reply(ctx.sock, ctx.jid, `✅ Custom command .${name.trim()} added`, ctx.msg);
});

register("delcmd", async (ctx) => {
  const k = ctx.body.trim().toLowerCase();
  await reply(ctx.sock, ctx.jid, state.customCmds.delete(k) ? `🗑️ Removed .${k}` : "Not found", ctx.msg);
});

register("addplugin", async (ctx) => {
  await reply(ctx.sock, ctx.jid, "Plugin loader is not enabled in this build for safety.", ctx.msg);
});
register("delplugin", async (ctx) => {
  await reply(ctx.sock, ctx.jid, "Plugin loader is not enabled in this build for safety.", ctx.msg);
});

// ─── CHAT ACTIONS ─────────────────────────────────────────────
register(["clear", "clearchat"], async (ctx) => {
  try {
    await ctx.sock.chatModify({ delete: true, lastMessages: [{ key: ctx.msg.key, messageTimestamp: ctx.msg.messageTimestamp }] }, ctx.jid);
    await reply(ctx.sock, ctx.jid, "🧹 Chat cleared.", ctx.msg);
  } catch {
    await reply(ctx.sock, ctx.jid, "Could not clear chat.", ctx.msg);
  }
});

register("archivechat", async (ctx) => {
  try {
    await ctx.sock.chatModify({ archive: true, lastMessages: [{ key: ctx.msg.key, messageTimestamp: ctx.msg.messageTimestamp }] }, ctx.jid);
    await reply(ctx.sock, ctx.jid, "📦 Archived.", ctx.msg);
  } catch {
    await reply(ctx.sock, ctx.jid, "Failed to archive.", ctx.msg);
  }
});

register("pinchat", async (ctx) => {
  try {
    await ctx.sock.chatModify({ pin: true }, ctx.jid);
    await reply(ctx.sock, ctx.jid, "📌 Pinned.", ctx.msg);
  } catch {
    await reply(ctx.sock, ctx.jid, "Failed to pin.", ctx.msg);
  }
});

register("star", async (ctx) => {
  try {
    await ctx.sock.chatModify({ star: { messages: [{ id: ctx.msg.key.id, fromMe: ctx.msg.key.fromMe }], star: true } }, ctx.jid);
    await reply(ctx.sock, ctx.jid, "⭐ Starred.", ctx.msg);
  } catch {
    await reply(ctx.sock, ctx.jid, "Failed to star.", ctx.msg);
  }
});

register("clearsession", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  clearSession();
  await reply(ctx.sock, ctx.jid, "🧨 Session cleared. Restarting...", ctx.msg);
  setTimeout(() => process.exit(0), 800);
});

register("cleartmp", async (ctx) => {
  const tmp = "/tmp";
  let n = 0;
  try {
    for (const f of fs.readdirSync(tmp)) {
      if (f.startsWith("baileys-") || f.endsWith(".tmp")) {
        try { fs.rmSync(path.join(tmp, f), { recursive: true, force: true }); n++; } catch {}
      }
    }
  } catch {}
  await reply(ctx.sock, ctx.jid, `🧽 Cleared ${n} temp files.`, ctx.msg);
});

// ─── BROADCAST ────────────────────────────────────────────────
register("broadcast", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  if (!ctx.body) return reply(ctx.sock, ctx.jid, "Usage: .broadcast <message>", ctx.msg);
  const chats = Object.keys(ctx.sock.chats || {}).filter((j) => j.endsWith("@g.us"));
  let n = 0;
  for (const j of chats) {
    try { await ctx.sock.sendMessage(j, { text: `📢 *Broadcast*\n\n${ctx.body}` }); n++; } catch {}
  }
  await reply(ctx.sock, ctx.jid, `✅ Sent to ${n} groups.`, ctx.msg);
});

register("broadcastdm", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  if (!ctx.body) return reply(ctx.sock, ctx.jid, "Usage: .broadcastdm <message>", ctx.msg);
  const chats = Object.keys(ctx.sock.chats || {}).filter((j) => j.endsWith("@s.whatsapp.net"));
  let n = 0;
  for (const j of chats) {
    try { await ctx.sock.sendMessage(j, { text: `📢 ${ctx.body}` }); n++; } catch {}
  }
  await reply(ctx.sock, ctx.jid, `✅ Sent to ${n} contacts.`, ctx.msg);
});

// ─── GROUP / PROFILE ──────────────────────────────────────────
register("gcleave", async (ctx) => {
  if (!ctx.jid.endsWith("@g.us")) return reply(ctx.sock, ctx.jid, "Group only.", ctx.msg);
  await reply(ctx.sock, ctx.jid, "👋 Goodbye.", ctx.msg);
  try { await ctx.sock.groupLeave(ctx.jid); } catch {}
});

register("joingroup", async (ctx) => {
  const m = ctx.body.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  if (!m) return reply(ctx.sock, ctx.jid, "Usage: .joingroup <invite-link>", ctx.msg);
  try {
    await ctx.sock.groupAcceptInvite(m[1]);
    await reply(ctx.sock, ctx.jid, "✅ Joined group.", ctx.msg);
  } catch (e) {
    await reply(ctx.sock, ctx.jid, "Failed: " + e.message, ctx.msg);
  }
});

register("mention", async (ctx) => {
  if (!ctx.jid.endsWith("@g.us")) return reply(ctx.sock, ctx.jid, "Group only.", ctx.msg);
  try {
    const meta = await ctx.sock.groupMetadata(ctx.jid);
    const mentions = meta.participants.map((p) => p.id);
    const text = ctx.body || "📣 Attention everyone!";
    await ctx.sock.sendMessage(ctx.jid, { text, mentions });
  } catch {
    await reply(ctx.sock, ctx.jid, "Failed to mention.", ctx.msg);
  }
});

register("setbio", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  try {
    await ctx.sock.updateProfileStatus(ctx.body || `${config.BOT_NAME} • online`);
    await reply(ctx.sock, ctx.jid, "✅ Bio updated.", ctx.msg);
  } catch {
    await reply(ctx.sock, ctx.jid, "Failed to update bio.", ctx.msg);
  }
});

register("setpp", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  await reply(ctx.sock, ctx.jid, "Reply to an image with .setpp to update profile picture.", ctx.msg);
});

// ─── FILES ────────────────────────────────────────────────────
register("getfile", async (ctx) => {
  const fp = ctx.body.trim();
  if (!fp || !fs.existsSync(fp)) return reply(ctx.sock, ctx.jid, "File not found.", ctx.msg);
  try {
    const buf = fs.readFileSync(fp);
    await ctx.sock.sendMessage(ctx.jid, { document: buf, fileName: path.basename(fp), mimetype: "application/octet-stream" }, { quoted: ctx.msg });
  } catch (e) {
    await reply(ctx.sock, ctx.jid, "Failed: " + e.message, ctx.msg);
  }
});

// ─── RENT / SUDO ──────────────────────────────────────────────
register("rentbot", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  const [num, days] = ctx.args;
  if (!num) return reply(ctx.sock, ctx.jid, "Usage: .rentbot <number> <days>", ctx.msg);
  const exp = Date.now() + (parseInt(days || "30", 10)) * 86400000;
  state.rentList.set(num, exp);
  await reply(ctx.sock, ctx.jid, `✅ Rented to ${num} until ${new Date(exp).toLocaleDateString()}`, ctx.msg);
});

register("stoprent", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  const num = ctx.args[0];
  await reply(ctx.sock, ctx.jid, state.rentList.delete(num) ? `Stopped rent for ${num}` : "Not found", ctx.msg);
});

register("listrent", async (ctx) => {
  if (!state.rentList.size) return reply(ctx.sock, ctx.jid, "No active rentals.", ctx.msg);
  const list = [...state.rentList.entries()].map(([n, e]) => `• ${n} → ${new Date(e).toLocaleDateString()}`).join("\n");
  await reply(ctx.sock, ctx.jid, `*Rentals*\n${list}`, ctx.msg);
});

register("sudo", async (ctx) => {
  if (!isOwner(ctx.sender)) return reply(ctx.sock, ctx.jid, "Owner only.", ctx.msg);
  const num = ctx.args[0];
  if (!num) return reply(ctx.sock, ctx.jid, `Sudo: ${[...state.sudo].join(", ") || "none"}`, ctx.msg);
  if (state.sudo.has(num)) { state.sudo.delete(num); return reply(ctx.sock, ctx.jid, `Removed sudo: ${num}`, ctx.msg); }
  state.sudo.add(num);
  await reply(ctx.sock, ctx.jid, `Added sudo: ${num}`, ctx.msg);
});

export { commands };
