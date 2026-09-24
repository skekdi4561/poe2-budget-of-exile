[English](README.en.md) | [한국어](README.md)

# PoE2 Budget of Exile (overlay)

> In Korean the same program is released as **PoE2 시세 감정소** ("PoE2 Price Appraiser") —
> it is one app, and with the app language set to Korean it shows the Korean name.

**"What is the highest DPS I can buy with this budget?"** — a Path of Exile 2 overlay that answers with a market curve.
It was built for the Kakao (Korean) realm, and it is a fork of [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2)
(the PoE2 fork of Awakened PoE Trade, MIT) that adds a **market curve widget**.

- `F7` — market curve widget for 7 attack weapon types (bow, crossbow, one-hand mace, two-hand mace, spear, quarterstaff, talisman) and shields.
  Price frontier by DPS (armour for shields), modifier filters, the best DPS your budget can buy, price trend
- Data: the top-100 snapshot that the [Attack Weapon Price Appraiser](https://skekdi4561.github.io/poe2-bow/) site (Korean only)
  takes about every hour (about 75 minutes including collection time), plus samples sent by users (see the notice below)
- Everything else from the original is unchanged: price checks for every item, the overlay, and all its languages.
  The app runs in 9 languages (English, Русский, 正體中文, 한국어, 日本語, Deutsch, Español, Português (Brasil), Français),
  and the default trade site follows the app language (Korean uses the Kakao trade site, poe.kakaogames.com)

## Install

Download the single Setup file from [Releases](https://github.com/skekdi4561/poe2-budget-of-exile/releases).

| File | Purpose |
|---|---|
| `PoE2-BudgetOfExile-Setup-<version>.exe` | Installer — adds a Start menu entry, supports **automatic updates** |

**Why you see two warnings**: this is a program made by one person without a code-signing certificate,
so the browser and Windows each ask once. It is not a virus detection.
- When downloading: if the browser warns that the file is not commonly downloaded, click `⋯` next to the file
  in the download list → `Keep`.
- When running: in the "Windows protected your PC" window, choose `More info → Run anyway`.
Just make sure the file came from this repository's Releases.

## Usage

**On first launch the app follows your Windows language settings**: the first language in the list if the
app has it and it is not English; otherwise Korean if Korean is anywhere in the list (with the Kakao trade
site); otherwise the first language in the list that the app has, or English. If your game client uses a different language, press `Shift + Space`
in game, click the gear button, open General → Language, pick your game client's language, and save.

1. When you start the game, an icon appears in the tray. The league is **set to the current challenge league automatically**
   (you do not need to change settings when a new season starts).
2. In game, hover over an item and press `D` while holding `Ctrl` — price check.
   To open it without auto-hide, press `Ctrl + Alt + D`. (Same hotkeys as the original; you can change them in Settings → Hotkeys.)
3. `Shift + Space` — overlay and settings. Hotkeys work **only while the game window is active**.
4. `F7` — opens and closes the market curve widget. Pick a weapon type, add modifier filters,
   and see the best DPS range for your budget. `Esc` closes it.

If the curve is empty, that weapon's prices have not been collected yet (for example, in the first hour of a new season).
It usually fills within 1–2 hours.

## Troubleshooting

- **The overlay does not show over the game**: if you run the game as administrator, run this app as administrator too
  (the app tells you when this is needed).
- **F7 does nothing**: hotkeys work only while the game window is active. Check the "Market Appraiser" key
  in Settings → Hotkeys (another program may be using F7).
- **Price check goes to the wrong trade site, or shows "POE2 language doesn't match PoE2 Budget of Exile"**:
  in Settings → General, set Language to your game client's language and leave "Preferred trade site"
  on its default (the first option, the trade site for that language).
- **Config file location**: `%APPDATA%\poe2-sise\apt-data\config.json` (you can also open it from the tray menu: "Open config folder").
- For anything else, open an issue in [Issues](https://github.com/skekdi4561/poe2-budget-of-exile/issues).

## Data collection notice (crowd samples)

From the trade site's responses to **attack weapon and shield price checks that you run yourself**, this app extracts only
the public information of the listings and sends it to a collection server — listing id, item name and rarity, weapon type,
league, price and currency, DPS, attack speed and critical hit chance (shields: armour and block chance), modifier text,
and the instant-buy fee when there is one.
The collected samples become the market curves of the [Attack Weapon Price Appraiser](https://skekdi4561.github.io/poe2-bow/)
and go back to every user.

- No extra trade API calls are made — it only reuses responses that have already arrived on your screen
- **Your** account and characters are never sent
- The seller's account name is not sent either. However, **the listing id is a public identifier that points to that
  listing on the trade site**, so looking it up on the trade site shows the seller's account (information the trade site
  already shows). That is why we do not call this "anonymous"
- Only **rare** listings are sent, and only from searches for the 7 attack weapon types and shields (the curves use rares only;
  v1.3.3 and earlier sent every rarity, rare-only starts with the next version), and the collector uses only
  current-league samples for the curves
- Samples that would change a price curve are verified on the trade site by the collector first, and
  implausibly cheap ones are dropped. A sample that an already verified better-and-cheaper listing beats
  cannot change the curve, so it goes in unverified (it can show up once you add modifier filters)
- It is on by default. **To turn it off: Settings → Price check → uncheck "Share price-check results with the Market Appraiser" and save.**
  From the moment you save, nothing is sent, and anything queued for sending is discarded

## Transparency

- This fork is **developed with AI (Claude) pair programming**. Out of respect for the original project's
  contribution policy (no AI-generated code), we do not send pull requests upstream.
  Details are in [AI_POLICY.fork.md](./AI_POLICY.fork.md)
  (the repository's `AI_POLICY.md` is **the original project's file, kept verbatim** — we have not edited it).
- This fork is **unofficial**. It is not made, endorsed or supported by the original author.
  Do not report bugs in this build to the original project's issue tracker.
- The original copyright and MIT license are kept unchanged in LICENSE.
- It does not read game memory and does not modify game files. Like the original, it only reads the game log (Client.txt) and config file.

## Build

```
cd renderer && npm install && npm run make-index-files
cd ../main  && npm install && npm run package
```

`npm run package` builds the renderer and then main, and then creates the installer
(it used to skip the build, so a stale `renderer/dist` was often packaged as-is).

## Author

김김두부 — <https://www.youtube.com/channel/UCdLge1kr3N8zEg2dMgF2pAg>

A video on how to use the program (in Korean):
<https://youtu.be/c1o28p74dO8>
