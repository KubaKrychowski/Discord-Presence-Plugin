# Discord Presence — własny status Rich Presence

Mały serwis, który ustawia Twój status na Discordzie ("Gra w...") na podstawie
pliku `config.json`. Edytujesz config, zapisujesz — status zmienia się od razu,
bez restartu serwisu.

## Wymaganie konieczne

Discord musi być **uruchomiony i zalogowany na tym samym komputerze**, na
którym działa ten serwis (Discord RPC łączy się lokalnie przez IPC/socket,
nie przez internet). Nie zadziała to na zdalnym VPS, jeśli nie masz tam
otwartego Discorda.

## Wariant 1: Lokalnie, zwykłym Node.js (najprostszy)

```bash
npm install
node index.js
```

To wszystko. W konsoli zobaczysz logi połączenia i potwierdzenie ustawienia
statusu.

### Autostart przy starcie komputera (opcjonalnie)

- **Windows**: dodaj skrót do `node index.js` (z pełną ścieżką) do folderu
  Autostart (`shell:startup` w Eksploratorze), albo użyj np. `pm2` /
  `nssm` żeby zrobić z tego usługę.
- **macOS**: `launchd` (plist w `~/Library/LaunchAgents`) albo `pm2`.
- **Linux**: `systemd --user` service albo `pm2`.

Najprościej cross-platformowo: `npm install -g pm2`, potem
`pm2 start index.js --name discord-presence` i `pm2 save` + `pm2 startup`.

## Wariant 2: Docker (na tym samym komputerze co Discord)

Wymaga zamontowania socketu IPC Discorda do kontenera.

### Linux / macOS

1. Sprawdź swoje UID: `id -u` (zwykle `1000`)
2. Sprawdź czy socket istnieje: `ls /run/user/$(id -u)/discord-ipc-0`
   (na macOS może to być inna ścieżka — sprawdź w `$TMPDIR` lub
   `/var/folders/.../discord-ipc-0`)
3. Zaktualizuj ścieżkę w `docker-compose.yml` jeśli inna niż `1000`
4. Uruchom:

```bash
docker compose up -d --build
```

### Windows

Docker Desktop na Windows nie ma łatwego dostępu do named pipes Windows
(`\\.\pipe\discord-ipc-0`) z poziomu kontenera Linux — to ograniczenie
Dockera, nie tego serwisu. **Na Windows polecam Wariant 1 (lokalny Node.js)**
zamiast walki z Dockerem.

## Edycja statusu

Otwórz `config.json` i zmień co chcesz:

```json
{
  "clientId": "TWOJE_APPLICATION_ID",
  "details": "Pierwsza linijka statusu",
  "state": "Druga linijka statusu",
  "largeImageKey": "nazwa-wgranej-ikonki",
  "largeImageText": "tekst po najechaniu na ikonkę",
  "showTimestamp": true,
  "buttons": [
    { "label": "Mój GitHub", "url": "https://github.com/twoj-profil" }
  ]
}
```

Zapisz plik — serwis sam wykryje zmianę i zaktualizuje status (zwykle
w ciągu 1-2 sekund, Discord ma swój wewnętrzny throttling na zbyt częste
zmiany).

### Obrazki (largeImageKey / smallImageKey)

Żeby użyć obrazków, musisz je wcześniej wgrać w
[Discord Developer Portal](https://discord.com/developers/applications) →
Twoja aplikacja → **Rich Presence → Art Assets**. Tam nadajesz obrazkowi
nazwę-klucz (np. `logo`) i tej nazwy używasz w `largeImageKey`.

## Rozwiązywanie problemów

- **"Nie udało się połączyć"** — upewnij się, że Discord jest otwarty i
  jesteś zalogowany. Sprawdź też, czy `clientId` w configu się zgadza z
  Application ID z Developer Portal.
- **Status się nie pojawia mimo "Połączono"** — sprawdź w ustawieniach
  Discorda: `Ustawienia użytkownika → Aktywność → Pokaż aktywność w grze
  na moim profilu` musi być włączone.
- **Status znika po 15-20 minutach bezczynności** — to normalne zachowanie
  Discorda dla niektórych typów aktywności; serwis musi cały czas działać
  w tle, żeby status był stały.
