<p align="center"><img src="public/icon.png" width="96" alt="Axon"></p>
<h1 align="center">Axon</h1>
<p align="center">Открытый VPN-клиент для Windows на ядрах sing-box и Xray.<br>Open-source VPN client for Windows powered by sing-box and Xray.</p>

---

## Русский

**Axon** — клиент для тех, кто хочет видеть и настраивать всё: протоколы, маршруты, DNS, TUN. Разумные настройки стоят по умолчанию, так что можно просто вставить подписку и нажать кнопку.

### Возможности

- **Протоколы:** VLESS (Reality, Vision, XHTTP, WS, gRPC, HTTPUpgrade), VMess, Trojan, Shadowsocks (включая 2022), Hysteria2, Hysteria, TUIC, WireGuard, SSH, SOCKS, HTTP.
- **Импорт:** ссылки, base64-подписки, JSON sing-box и Xray, Clash YAML, `.conf` WireGuard/AmneziaWG. Можно вставить из буфера или добавить несколько подписок.
- **Совместимость с Happ:** понимает заголовки подписки — название, интервал обновления, трафик и срок, объявления, ссылки поддержки и маршруты `happ://routing`.
- **Режимы:** системный прокси (HTTP + SOCKS5 на одном порту), TUN для всего трафика или оба сразу.
- **Маршруты:** «всё, кроме российских сайтов», «всё через VPN», «только по правилам», конструктор правил (домены, geosite, geoip, IP, процессы, порты).
- **Сервера:** автовыбор самого быстрого, автоматическое переключение при падении, проверка задержки.
- **Наблюдение:** скорость и трафик, активные соединения с закрытием, логи ядер, мастер «не работает».
- **Интерфейс:** тёмная тема на дизайн-системе Mono, палитра команд (`Ctrl K`), мини-окно в трее.
- **Правка вручную:** любые настройки формой или итоговым JSON-конфигом.
- **Обновления:** Axon сам проверяет новые версии на GitHub.

### Установка

Скачайте `Axon_x.y.z_x64-setup.exe` из [Releases](https://github.com/wsq4kar/axon/releases) или из артефактов последней сборки в [Actions](https://github.com/wsq4kar/axon/actions). Установщик пока без цифровой подписи: Windows SmartScreen покажет предупреждение («Подробнее» → «Выполнить в любом случае»).

### Как устроено

```
React + TypeScript (src/)          Rust / Tauri 2 (src-tauri/)
├─ lib/uri.ts      разбор ссылок    ├─ запуск и остановка ядер, их логи
├─ lib/happ.ts     заголовки Happ   ├─ системный прокси Windows (реестр + WinINet)
├─ lib/singbox.ts  конфиг sing-box  ├─ трей и мини-окно
├─ lib/xray.ts     конфиг Xray      ├─ права администратора для TUN
└─ lib/store.ts    состояние        └─ загрузка подписок, файл состояния
```

sing-box — главный маршрутизатор: он принимает трафик (прокси и TUN), решает DNS и правила, отдаёт живую статистику через clash API. Протоколы, которых sing-box не знает (XHTTP), идут через Xray, подключённый цепочкой на локальном SOCKS-порту.

Вся логика написана на TypeScript и проверяется без Windows: `npm test`.

### Разработка

```bash
npm install
npm run dev          # интерфейс в браузере с демо-данными
npm test             # тесты логики
npx tauri dev        # приложение целиком (Windows, нужны ядра в src-tauri/binaries)
```

Ядра для локальной сборки качает `scripts/fetch-cores.ps1`. Установщик собирает GitHub Actions: каждый пуш в `main` даёт артефакт, тег `v*` — релиз.

### Что ещё будет

- AmneziaWG (включая 2.0) — отдельное ядро; ссылки и `.conf` уже распознаются.
- TUN через фоновую службу. Сейчас для TUN Axon перезапускается с правами администратора.
- Английский интерфейс.
- Подписанный установщик.

---

## English

**Axon** is a VPN client for people who want to see and tune everything: protocols, routing, DNS and TUN. It ships with sensible defaults, so you can also just paste a subscription and press the button.

**Features.**
- **Protocols:** VLESS (Reality/XHTTP/WS/gRPC), VMess, Trojan, Shadowsocks 2022, Hysteria2, TUIC, WireGuard, SSH, SOCKS and HTTP.
- **Import:** links, base64, sing-box/Xray JSON, Clash YAML and WireGuard/AmneziaWG `.conf`.
- **Happ compatibility:** subscription headers are understood, including routing.
- **Modes:** system proxy, TUN, or both.
- **Routing:** smart routing with presets and a rule builder.
- **Servers:** automatic selection of the fastest server with failover.
- **Monitoring:** live speed, connections and core logs, plus a troubleshooting wizard.
- **Interface:** tray mini window and a command palette.
- **Editing:** use the forms or edit the JSON directly.
- **Updates:** Axon checks GitHub for new versions.

**Architecture.**
- All logic is TypeScript, tested with `npm test`.
- Rust (Tauri 2) is a thin OS layer: core processes, Windows proxy, tray and elevation.
- sing-box is the router; Xray is chained in for protocols sing-box lacks.

**Install.**
- Grab the NSIS installer from Releases or from the latest Actions run.
- The installer is not code-signed yet, so SmartScreen will warn.

**Roadmap.**
- AmneziaWG core.
- TUN via a Windows service.
- English UI.
- Signed builds.

## License

[GPL-3.0-or-later](LICENSE). sing-box (GPL-3.0) and Xray-core (MPL-2.0) are distributed as separate executables under their own licenses.
