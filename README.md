# Discord Presence — your own Rich Presence status

A small service that sets your Discord status (the "Playing..." line) based
on a `config.json` file. Edit the config, save it — the status updates
immediately, no restart needed.

## Requirement

Discord must be **running and logged in on the same machine** where this
service runs (Discord RPC connects locally via IPC/socket, not over the
internet). This won't work on a remote VPS unless Discord is also open there.

## Option 1: Run locally with plain Node.js (simplest)

```bash
npm install
node index.js
```

That's it. The console will show connection logs and confirmation that the
status was set.

## Option 2: Docker (on the same machine as Discord)

Requires mounting Discord's IPC socket into the container.

### Linux / macOS

1. Check your UID: `id -u` (usually `1000`)
2. Check the socket exists: `ls /run/user/$(id -u)/discord-ipc-0`
   (on macOS the path may differ — check `$TMPDIR` or
   `/var/folders/.../discord-ipc-0`)
3. Update the path in `docker-compose.yml` if it's not `1000`
4. Run:

```bash
docker compose up -d --build
```

### Windows

Docker Desktop on Windows doesn't have straightforward access to Windows
named pipes (`\\.\pipe\discord-ipc-0`) from inside a Linux container — this
is a Docker limitation, not something this service can work around.
**On Windows, use Option 1 (plain Node.js)** instead of fighting Docker.

## Editing the status

Open `config.json` and change whatever you like:

```json
{
  "clientId": "YOUR_APPLICATION_ID",
  "details": "First line of the status",
  "state": "Second line of the status",
  "largeImageKey": "uploaded-image-name",
  "largeImageText": "tooltip text on hover",
  "showTimestamp": true,
  "buttons": [
    { "label": "My GitHub", "url": "https://github.com/your-profile" }
  ]
}
```

Save the file — the service detects the change automatically and updates the
status (usually within 1-2 seconds; Discord has its own internal throttling
for rapid changes).

### Images (largeImageKey / smallImageKey)

To use images, upload them first in the
[Discord Developer Portal](https://discord.com/developers/applications) →
your application → **Rich Presence → Art Assets**. There you assign each
image a key name (e.g. `logo`), which you then use in `largeImageKey`.

## Running automatically at startup (autostart)

The easiest, cross-platform way is **pm2** — it manages the process,
restarts it if it crashes, and brings it back up after a reboot or login.

### 1. Install pm2 globally

```bash
npm install -g pm2
```

### 2. Start the service through pm2

From the project folder:

```bash
pm2 start index.js --name discord-presence
```

### 3. Save the current process list

This tells pm2 what to relaunch after a restart:

```bash
pm2 save
```

### 4. Install the startup hook

**Windows:**
```bash
npm install -g pm2-windows-startup
pm2-startup install
```
This registers pm2 in Windows Task Scheduler so it launches at login and
restarts your saved processes (including `discord-presence`).

**macOS / Linux:**
```bash
pm2 startup
```
This prints a command — copy and run it (it needs `sudo` on Linux). It sets
up a system service (`launchd` on macOS, `systemd` on Linux) that starts pm2
on boot.

### Useful pm2 commands

```bash
pm2 list                       # check status (running or not)
pm2 logs discord-presence      # view live logs
pm2 restart discord-presence   # restart (only needed after editing index.js)
pm2 stop discord-presence      # stop the service
```

Note: you do **not** need `pm2 restart` after a normal `config.json` edit —
the file watcher picks up changes automatically. Only restart after changing
`index.js` itself.

### One more thing about autostart

pm2 will launch the service at login, but Discord itself also needs to be
running for the connection to succeed. If Discord starts a bit later (e.g.
its own autostart), that's fine — the service retries every 15 seconds until
it connects. If you want this to be fully hands-off, enable Discord's own
autostart too: Discord Settings → Behavior → "Open Discord automatically
after logging into your computer."

## Troubleshooting

- **"Could not connect to Discord client"** — make sure Discord is open and
  you're logged in. Also double-check that `clientId` in the config matches
  your Application ID from the Developer Portal.
- **Status doesn't show even though it says "Connected"** — check Discord
  settings: `User Settings → Activity Privacy → Display current activity as
  a status message` must be enabled.
- **Status disappears after 15-20 minutes of inactivity** — this is normal
  Discord behavior for some activity types; the service needs to keep
  running in the background for the status to stay persistent.
