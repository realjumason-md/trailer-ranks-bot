export const config = {
  BOT_NAME: "TRAILER RANKS",
  OWNER_NUMBER: "256706106326",
  PREFIXES: ["😀", ".", "!"],
  TIME_ZONE: "Africa/Kampala",
  SESSION_ID: process.env.SESSION_ID || "",
};

export const state = {
  anticall: false,
  antidelete: false,
  antiedit: false,
  autoreact: false,
  autoread: false,
  autoAiReply: false,
  autostatus: false,
  autotyping: false,
  cmdreact: false,
  pmblocker: false,
  stealth: false,
  maintenance: false,
  mode: "public",
  sudo: new Set(),
  replies: new Map(),
  customCmds: new Map(),
  rentList: new Map(),
  starred: [],
};
