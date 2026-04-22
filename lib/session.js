import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SESSION_DIR = path.join(__dirname, "..", "sessions");

export function ensureSessionFromEnv() {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
  const credsPath = path.join(SESSION_DIR, "creds.json");
  if (fs.existsSync(credsPath)) return;

  const sid = (config.SESSION_ID || "").trim();
  if (!sid) {
    console.warn("[session] No SESSION_ID provided. Bot cannot connect without it.");
    return;
  }

  try {
    const b64 = sid.includes(";;;") ? sid.split(";;;").pop() : sid.replace(/^.*?~/, "");
    const json = Buffer.from(b64, "base64").toString("utf-8");
    JSON.parse(json);
    fs.writeFileSync(credsPath, json);
    console.log("[session] creds.json written from SESSION_ID");
  } catch (err) {
    console.error("[session] Failed to decode SESSION_ID:", err.message);
  }
}

export function clearSession() {
  if (!fs.existsSync(SESSION_DIR)) return;
  for (const f of fs.readdirSync(SESSION_DIR)) {
    fs.rmSync(path.join(SESSION_DIR, f), { recursive: true, force: true });
  }
}
