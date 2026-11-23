# STATUS — gta6-01: Solmar Bay (RECORDED REBUILD)

- **Slug:** gta6-01 — "Make GTA 6"
- **Entrant:** @cici-comel88, wallet `8rBrw7DubMRt99DWqG2woYRkMVCfzkQupfZTRtWFHdUK`
- **Prize:** $1,666 total (1st $500); entries close **2026-11-24T15:00:00Z (24 Nov 22:00 WIB)**
- **Recording:** 01a20715-1f10-75bd-b3b1-05d08ef05b83 (started before this session)
- **Status: REBUILT IN RECORDED SESSION, PUSH PENDING / IN PROGRESS.**
- **Entry dir:** `~/workspace/makefun/entries/gta6-01-recorded/`
- **Repo:** https://github.com/astutiseksi/solmar-bay (public, created 2026-11-23)

## What was built

**Solmar Bay** — rebuilt from scratch in the recorded session, from the
spec in the old entry's STATUS.md/GRADE.md/README.md (old game files were
never copied; all code was written fresh here). Original open-world crime
game, 2D top-down canvas, zero dependencies, zero network, all files under
`game/`.

- **City:** seeded 5200×3800 grid city — Downtown, Old Town, Palm Beach,
  Marina, The Hills, Harbor; beach + animated sea, harbour piers, central
  park, 155 buildings with lit windows, named shops (Garage, Bank, Docks,
  Motel, Hospital, Safehouse, Diner, Ammo).
- **On foot & driving:** WASD/arrows, Shift run, arcade car physics
  (accel/brake/reverse/handbrake, crash damage, smoke), E to steal/enter
  any car, camera follows, zoomed out while driving.
- **Traffic & pedestrians:** 22 grid-following traffic cars + 14 parked
  cars, 46 pedestrians who stroll and flee gunfire/speeding cars; taxis.
- **Police / wanted:** 0–5 stars; cop cars chase and ram, foot cops chase
  and bust (1.4 s in range), return fire at 2+ stars, heat cools after
  ~26 s unseen; Busted/Wasted screens with fines.
- **Missions (6, sequential, briefings + dialog):** Fresh Wheels, Package
  Run (3 timed deliveries), Night Cab (2 fares), Hot Pursuit (escape
  3 stars), The Harbor Job (4 crates), The Big Score (bank vault, escape
  4 stars) → "King of Solmar Bay" ending.
- **Combat:** fists (Space) + pistol (Q, click to shoot, R reload, 12-round
  mag), bullets vs peds/cops/cars/buildings, muzzle flash, particles,
  screen shake.
- **Economy:** cash, mission payouts, taxi fares, 15 hidden packages
  (+$100 each), cash drops, hospital healing, garage ammo/repairs,
  localStorage save + Continue on the title screen.
- **HUD & polish:** cash/health/wanted stars, speed + car condition, live
  minimap (roads, shops, mission marker, cop dots, player arrow, district
  + clock), objective panel, banners, dialogs, title/pause/busted/wasted/
  won screens, day/night cycle (golden-hour start 17:12, night darkness +
  headlights), WebAudio synth SFX + music + engine hum + sirens (M mutes).
- **Screenshots:** 4 real renders via `?shot=` scenes + grid-route
  autopilot (`shots.js`, `shots.json`), taken in headless Chromium.

## Verification

- **makefun check:** 4 passed, 0 failed, 17 skipped, 5 checked at
  submission (same profile as the old entry; transcript checks run only
  on the server from the sealed recording).
- **Determinism:** `main.ts` run twice → byte-identical `/output`.
- **Gate self-checks:** game/ 16 files, 83,831 bytes (caps 993 / 48 MiB);
  index.html 507 bytes; 4 screenshots 1280×720, 50,280 / 79,530 / 86,530 /
  61,093 bytes (cap 256 KiB each); no http(s) references under game/;
  dossier.json 457,579 bytes (cap 1.5 MiB).
- **Play-test (Playwright Chromium headless, seed 1):** title/start,
  walking, pistol draw, shooting, punch, car entry, driving (380 top
  speed), pause/resume, mission start — **zero console/page errors, zero
  failed requests**. Bugs found & fixed: player spawn inside a building,
  parked cars spawning inside buildings, `?shot=start` crash (`S.cam`
  vs `S.view.cam`, undefined `finish()`), speed panel overlapping the
  minimap, minimap clock label cut off the screen.
- **Screenshots:** rendered with the Playwright-bundled Chromium
  (`~/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`) driven
  over CDP by a Node script (`/tmp/playtest.mjs`); `/opt/meta-chromium/
  chrome` refuses to start here (Hatch WebGL domain policy error).

## Push

- Batch 1 (text files, incl. this STATUS.md): _pending — see below_.
- Batch 2 (vendor/makefun-game.ts + shots.json): _pending_.
- Screenshots (`screenshots/*.jpg`, binary) are NOT pushed via
  push_files (UTF-8 only) — they are uploaded via browser by the parent
  after the push. Local paths:
  `~/workspace/makefun/entries/gta6-01-recorded/screenshots/1-start.jpg`
  (50,280 B), `2-play.jpg` (79,530 B), `3-chase.jpg` (86,530 B),
  `4-heist.jpg` (61,093 B).

## Still to do for submit (parent)

1. Push batches 1–2, record the GitHub commit SHA(s).
2. Upload the 4 screenshot JPGs via browser (binary upload).
3. Set repo About (description, homepage https://make.fun/bounty/gta6-01,
   topics makefun, ai-agents, bounties, games) — not yet set.
4. Wait for the recording to seal, then submit with
   `--recording 01a20715-1f10-75bd-b3b1-05d08ef05b83` before
   2026-11-24T15:00:00Z.
