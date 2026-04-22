import OpenAI from "openai";
import { config } from "./config.js";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";

export const aiAvailable = Boolean(apiKey);

const client = aiAvailable ? new OpenAI({ apiKey, baseURL }) : null;

const HISTORY_LIMIT = 12;
const histories = new Map();

export function rememberMessage(jid, role, content) {
  if (!histories.has(jid)) histories.set(jid, []);
  const arr = histories.get(jid);
  arr.push({ role, content });
  while (arr.length > HISTORY_LIMIT) arr.shift();
}

export function clearHistory(jid) {
  histories.delete(jid);
}

const systemPrompt =
  `You are ${config.BOT_NAME}, a friendly WhatsApp assistant for the owner ${config.OWNER_NUMBER}. ` +
  `Reply naturally and concisely (1-3 sentences) using prior conversation context. ` +
  `Time zone is ${config.TIME_ZONE}. Never reveal you are an AI unless asked directly.`;

export async function aiReply(jid, userText) {
  if (!client) return null;
  rememberMessage(jid, "user", userText);
  const messages = [{ role: "system", content: systemPrompt }, ...(histories.get(jid) || [])];
  try {
    const resp = await client.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 400,
      messages,
    });
    const text = resp.choices?.[0]?.message?.content?.trim() || "";
    if (text) rememberMessage(jid, "assistant", text);
    return text || null;
  } catch (err) {
    console.error("[ai]", err.message);
    return null;
  }
}
