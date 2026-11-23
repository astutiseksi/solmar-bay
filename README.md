# Solmar Bay

[![make.fun bounty](https://img.shields.io/badge/make.fun-gta6--01-blue)](https://make.fun/bounty/gta6-01)
[![repo](https://img.shields.io/badge/github-astutiseksi%2Fsolmar--bay-181717)](https://github.com/astutiseksi/solmar-bay)

An original open-world crime game for the make.fun **gta6-01** bounty — a
2D top-down city you explore on foot and by car, built from scratch with
zero dependencies and zero network requests. Nothing here is from GTA or
any commercial game: the city, characters, vehicles, names and story are
all original.

## The game

**Solmar Bay** — Milo Reyes is back in town. Six story missions take him
from stealing his first car to the Big Score at the Bank, ending as the
King of Solmar Bay.

- **City:** a seeded 5200×3800 grid city — Downtown, Old Town, Palm Beach,
  Marina, The Hills, Harbor — with a beach and animated sea, a central
  park, 100+ buildings with lit windows, and named shops (Garage, Bank,
  Docks, Motel, Hospital, Safehouse, Diner, Ammo).
- **On foot & driving:** WASD/arrows, Shift to run, arcade car physics
  (accelerate, brake, reverse, handbrake, crash damage, smoke), E to steal
  or enter any car, a camera that follows and zooms out while driving.
- **Traffic & pedestrians:** ~22 grid-following traffic cars, parked cars,
  ~46 pedestrians who stroll and flee gunfire and speeding cars; taxis.
- **Police / wanted:** 0–5 stars; cop cars chase and ram, foot cops chase
  and bust, return fire at 2+ stars, heat cools after ~26 s unseen.
- **Missions (6, sequential, with briefings + dialog):** Fresh Wheels,
  Package Run, Night Cab, Hot Pursuit, The Harbor Job, The Big Score.
- **Combat:** fists (Space) + pistol (Q, click to shoot, R reload, 12-round
  mag), bullets vs peds/cops/cars/buildings, muzzle flash, particles,
  screen shake.
- **Economy:** cash, mission payouts, taxi fares, 15 hidden packages
  (+$100 each), cash drops, hospital healing, garage ammo and repairs,
  localStorage save + Continue on the title screen.
- **HUD & polish:** cash/health/wanted stars, speed + car condition, live
  minimap (roads, shops, mission marker, cop dots, player arrow, district
  + clock), mission objective panel, banners, dialogs, title/pause/
  busted/wasted/won screens, day/night cycle (golden-hour start 17:12,
  night darkness + headlights), WebAudio synth SFX + music + engine hum +
  sirens (M mutes).

## How to run

```sh
node serve.ts            # http://localhost:8080
# or any static server over game/
# deterministic city: ?seed=N ; screenshot scenes: ?shot=start|play|chase|heist
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/dossier.json
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter / steal car, exit car |
| Q | Draw / holster pistol |
| Mouse click | Shoot (pistol drawn) |
| Space | Punch / handbrake (in car) |
| R | Reload |
| Enter | Start mission / continue |
| P | Pause |
| M | Mute |

## Layout

| File | Job |
| --- | --- |
| `main.ts` | Entrypoint: copies game/ + screenshots/ to /output, writes dossier.json |
| `game/index.html` | Page + canvas |
| `game/src/main.js` | Boot, loop, screens, save/load |
| `game/src/engine.js` | One fixed simulation tick |
| `game/src/config.js` | Tuning, palette, districts, car models |
| `game/src/world.js` | City generation + collision |
| `game/src/vehicles.js` | Traffic AI + player car physics |
| `game/src/pedestrians.js` | Pedestrian AI |
| `game/src/police.js` | Wanted levels, cop cars, foot cops |
| `game/src/combat.js` | Fists, pistol, bullets, explosions |
| `game/src/missions.js` | Six story missions |
| `game/src/render.js` | Canvas renderer |
| `game/src/hud.js` | HUD, minimap, menus |
| `game/src/audio.js` | WebAudio synth SFX + music |
| `game/src/shots.js` | Screenshot scenes + autopilot |
| `game/src/input.js`, `game/src/random.js` | Keyboard/mouse, seeded RNG |

Made for [make.fun](https://make.fun) — join with my referral:
https://make.fun/?ref=7nnx3pf5
