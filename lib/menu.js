import { config, state } from "./config.js";
import { nowKampala } from "./utils.js";

const CATEGORIES = {
  OWNER: [
    "addreply","anticall","antidelete","antiedit","archivechat","autoreact","autoread","autoreply",
    "autostatus","autotyping","broadcast","broadcastdm","clear","clearchat","clearsession","cleartmp",
    "cmdreact","delcmd","delplugin","delreply","gcleave","getfile","inspect","gitinfo","addplugin",
    "joingroup","listcmd","listrent","listreplies","maintenance","manage","mention","mode","pinchat",
    "pmblocker","gitpull","reload","rentbot","setbio","setcmd","setpp","settings","star","stealth",
    "stoprent","sudo","sysinfo","update",
  ],
  AI: ["aion","aioff","ai","gpt","llama","mistral","dalle","flux","diffusion","sora"],
  DOWNLOAD: [
    "alamy","apkdl","facebook","getty","gimage","gitclone","gitclone2","instagram","istock","mediafire",
    "mega","sharechat","snack","snapchat","spotify","dlstatus","terabox","tiktok","twitter","video","vidsplay",
  ],
  GENERAL: ["alive","channelid","echo","getpp","menu","pair","ping","pingweb","find","smenu","perf","uptime","viewonce"],
  UTILITY: [
    "analyze","calc","cipher","crun","distance","dna","rle","schedule","schedulecancel","schedulelist",
    "siminfo","speedtest","sudoku","units","urldecode","wordcloud",
  ],
  MENU: ["animes","audiofx","notes","privacy","images","stext","ephoto"],
  ADMIN: [
    "antibadword","antilink","antispam","antitag","ban","chatbot","delete","demote","disappear","add",
    "gcset","goodbye","hidetag","kick","mute","promote","resetlink","setgdesc","setgname","setgpp",
    "tag","tagall","tagnotadmin","unban","unmute","warn","welcome",
  ],
  STICKERS: ["attp","emojimix","gif","igs","igsc","quoted","s2img","sticker","sticker2","crop","stickers","tgstk","take"],
  TOOLS: [
    "base64","bfdecode","brainfuck","excard","fetch","flip","forwarded","grayscale","blur","invert",
    "qrcode","qmaker","readmore","readqr","removebg","length","reverse","sepia","sharpen","getpage",
    "screenshot","tinyurl","smallcaps","tourl","translate","tts","url","vnote",
  ],
  GROUP: [
    "character","compliment","gcmtdata","groupinfo","insult","invitelink","joinrequests","poll",
    "rank","ship","simp","staff","stupid","warnings","wasted",
  ],
  IMAGES: ["coding","cyberimg","game","islamic","mountain","pies","tech"],
  GAMES: ["dado","dare","hangman","math","tictactoe","trivia","truth"],
  SEARCH: ["define","element","whoisip","wattpad","wiki"],
  FUN: ["8ball","fact","flirt","hack","joke","joke2","meme","teddy","why"],
  STALK: ["genshin","github","npmstalk","pinstalk","tgstalk","thrstalk","ttstalk","xstalk"],
  INFO: [
    "script","imdb","itunes","medicine","momo","movie","news","owner","pokedex","quran","shazam",
    "string","trends","weather","whois",
  ],
  QUOTES: ["goodnight","quote","quote2","roseday","shayari","wyr"],
  MUSIC: ["lyrics","play","ringtone","scloud","song","ytsearch"],
  UPLOAD: ["aupload","catbox","freeimage","litterbox","pixhost","pomf","quax","tmpfiles","uguu","xoat"],
};

export function buildMenu(commandCount) {
  const lines = [];
  lines.push("✦═══ *BOT MENU* ═══✦");
  lines.push(`║➩ *Bot:* ${config.BOT_NAME}`);
  lines.push(`║➩ *Prefixes:* ${config.PREFIXES.join(" ")}`);
  lines.push(`║➩ *Plugins:* ${commandCount}`);
  lines.push(`║➩ *Version:* 6.0.0`);
  lines.push(`║➩ *Time:* ${nowKampala()}`);
  lines.push(`║➩ *Mode:* ${state.mode}`);
  lines.push(`║➩ *Owner:* ${config.OWNER_NUMBER}`);
  for (const [cat, cmds] of Object.entries(CATEGORIES)) {
    lines.push(`║══ *${cat}* ══✧`);
    for (const c of cmds) lines.push(`║ ✦ .${c}`);
  }
  lines.push("✦══════════════✦");
  return lines.join("\n");
}
