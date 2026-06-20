const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { Client } = require("@xhayper/discord-rpc");

const CONFIG_PATH = path.join(__dirname, "config.json");

let rpc = null;
let connected = false;
let startTimestamp = Date.now();

function log(msg) {
  const time = new Date().toLocaleTimeString("pl-PL");
  console.log(`[${time}] ${msg}`);
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const cfg = JSON.parse(raw);

    if (!cfg.clientId || cfg.clientId.trim() === "") {
      throw new Error("Brak 'clientId' w config.json. Wklej tam Application ID z Discord Developer Portal.");
    }

    return cfg;
  } catch (err) {
    log(`❌ Błąd wczytywania config.json: ${err.message}`);
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
    log("⏳ Jeszcze nie połączono z Discordem, pomijam aktualizację.");
    return;
  }

  const cfg = loadConfig();
  if (!cfg) return;

  const activity = buildActivity(cfg);

  try {
    await rpc.user?.setActivity(activity);
    log(`✅ Status zaktualizowany: "${activity.details || ""}" / "${activity.state || ""}"`);
  } catch (err) {
    log(`❌ Nie udało się ustawić statusu: ${err.message}`);
  }
}

async function start() {
  const cfg = loadConfig();
  if (!cfg) {
    log("Popraw config.json i uruchom serwis ponownie.");
    process.exit(1);
  }

  rpc = new Client({ clientId: cfg.clientId });

  rpc.on("ready", () => {
    connected = true;
    log(`🔗 Połączono z Discordem jako: ${rpc.user?.username ?? "nieznany użytkownik"}`);
    applyPresence();
  });

  rpc.on("disconnected", () => {
    connected = false;
    log("⚠️  Rozłączono z Discordem. Próbuję połączyć ponownie...");
  });

  log("🔄 Łączenie z lokalnym klientem Discord (musi być uruchomiony i zalogowany)...");

  try {
    await rpc.login();
  } catch (err) {
    log(`❌ Nie udało się połączyć: ${err.message}`);
    log("   Sprawdź czy Discord jest uruchomiony na tym komputerze i czy clientId w config.json jest poprawny.");
    log("   Serwis będzie ponawiał próbę co 15 sekund.");
    setTimeout(start, 15000);
    return;
  }

  // Śledzenie zmian w config.json na żywo
  const watcher = chokidar.watch(CONFIG_PATH, { ignoreInitial: true });
  watcher.on("change", () => {
    log("📝 Wykryto zmianę w config.json, aktualizuję status...");
    applyPresence();
  });

  log("👀 Obserwuję config.json pod kątem zmian. Edytuj plik, żeby zmienić status na żywo.");
}

process.on("SIGINT", () => {
  log("Zamykanie serwisu...");
  if (rpc) rpc.destroy();
  process.exit(0);
});

start();
