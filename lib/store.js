// In-memory message cache so antidelete / antiedit can show original content.
const MAX = 1500;
const cache = new Map();

function getText(msg) {
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

function mediaInfo(msg) {
  const m = msg.message || {};
  if (m.imageMessage) return "📷 image";
  if (m.videoMessage) return "🎥 video";
  if (m.audioMessage) return "🎵 audio";
  if (m.stickerMessage) return "🩵 sticker";
  if (m.documentMessage) return `📄 doc (${m.documentMessage.fileName || "file"})`;
  if (m.contactMessage) return "👤 contact";
  if (m.locationMessage) return "📍 location";
  return null;
}

export function rememberMessage(msg) {
  if (!msg?.key?.id || !msg.message) return;
  const text = getText(msg);
  const media = mediaInfo(msg);
  if (!text && !media) return;
  cache.set(msg.key.id, {
    chat: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    text,
    media,
    ts: msg.messageTimestamp,
  });
  if (cache.size > MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

export function recallMessage(id) {
  return cache.get(id) || null;
}
