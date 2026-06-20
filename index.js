const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { Client } = require("@xhayper/discord-rpc");

const CONFIG_PATH = path.join(__dirname, "config.json");

let rpc = null;
let connected = false;
let startTimestamp = Date.now();

function log(msg) {
  const time = new Date().toLocaleTimeString("en-US");
  console.log(`[${time}] ${msg}`);
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(raw);

    if (!cfg.clientId || cfg.clientId.trim() === "") {
      throw new Error("Missing 'clientId' in config.json. Paste your Application ID from the Discord Developer Portal there.");
    }

    return cfg;
  } catch (err) {
    log(`Error loading config.json: ${err.message}`);
    return null;
  }
}

function buildActivity(cfg) {
  const activity = {};

  if (cfg.details) activity.details = String(cfg.details).slice(0, 128);
  if (cfg.state) activity.state = String(cfg.state).slice(0, 128);

  if (cfg.largeImageKey) {
    activity.largeImageKey = cfg.largeImageKey;
    if (cfg.largeImageText) activity.largeImageText = String(cfg.largeImageText).slice(0, 128);
  }

  if (cfg.smallImageKey) {
    activity.smallImageKey = cfg.smallImageKey;
    if (cfg.smallImageText) activity.smallImageText = String(cfg.smallImageText).slice(0, 128);
  }

  if (cfg.showTimestamp) {
    activity.startTimestamp = startTimestamp;
  }

  if (Array.isArray(cfg.buttons) && cfg.buttons.length > 0) {
    activity.buttons = cfg.buttons
      .filter((b) => b && b.label && b.url && /^https?:\/\//.test(b.url))
      .slice(0, 2)
      .map((b) => ({ label: String(b.label).slice(0, 32), url: b.url }));
  }

  return activity;
}

async function applyPresence() {
  if (!connected || !rpc) {
    log("Not connected to Discord yet, skipping update.");
    return;
  }

  const cfg = loadConfig();
  if (!cfg) return;

  const activity = buildActivity(cfg);

  try {
    await rpc.user?.setActivity(activity);
    log(`Status updated: "${activity.details || ""}" / "${activity.state || ""}"`);
  } catch (err) {
    log(`Failed to set status: ${err.message}`);
  }
}

async function start() {
  const cfg = loadConfig();
  if (!cfg) {
    log("Fix config.json and restart the service.");
    process.exit(1);
  }

  rpc = new Client({ clientId: cfg.clientId });

  rpc.on("ready", () => {
    connected = true;
    log(`Connected to Discord as: ${rpc.user?.username ?? "unknown user"}`);
    applyPresence();
  });

  rpc.on("disconnected", () => {
    connected = false;
    log("Disconnected from Discord. Trying to reconnect...");
  });

  log("Connecting to local Discord client (it must be running and logged in)...");

  try {
    await rpc.login();
  } catch (err) {
    log(`Failed to connect: ${err.message}`);
    log("   Check that Discord is running on this machine and that clientId in config.json is correct.");
    log("   The service will retry every 15 seconds.");
    setTimeout(start, 15000);
    return;
  }

  // Watch config.json for live changes
  const watcher = chokidar.watch(CONFIG_PATH, { ignoreInitial: true });
  watcher.on("change", () => {
    log("Detected a change in config.json, updating status...");
    applyPresence();
  });

  log("Watching config.json for changes. Edit the file to update the status live.");
}

process.on("SIGINT", () => {
  log("Shutting down service...");
  if (rpc) rpc.destroy();
  process.exit(0);
});

start();