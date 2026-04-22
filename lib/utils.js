import { config } from "./config.js";

export function isOwner(jid) {
  if (!jid) return false;
  const num = jid.split("@")[0].split(":")[0];
  return num === config.OWNER_NUMBER;
}

export function jidToNumber(jid) {
  return (jid || "").split("@")[0].split(":")[0];
}

export function getText(msg) {
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  );
}

export function parseCommand(text) {
  if (!text) return null;
  for (const p of config.PREFIXES) {
    if (text.startsWith(p)) {
      const rest = text.slice(p.length).trim();
      if (!rest) return null;
      const parts = rest.split(/\s+/);
      const cmd = parts.shift().toLowerCase();
      return { prefix: p, cmd, args: parts, body: parts.join(" ") };
    }
  }
  return null;
}

export function nowKampala() {
  return new Date().toLocaleString("en-GB", { timeZone: config.TIME_ZONE });
}

export function uptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}
