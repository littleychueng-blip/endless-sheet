# Endless Sheet

Infinite bubble wrap — tap, drag, or drive a little character over it. Six
synthesised sound materials, wandering NPCs, levels, generative ambient music.

**Live: https://littleychueng-blip.github.io/endless-sheet/**

That's the URL to share. It's real HTTPS on GitHub's CDN, so it works for
everyone. The Coolify copy on the VM
(http://no9k2hqgkxidx8rzwfn8mdb3.35.202.38.29.sslip.io/) still runs as a
mirror, but don't hand it out: `sslip.io` gets blocked by some DNS resolvers,
and it has no certificate, so any browser with HTTPS-First turned on fails to
open it.

## Layout

```
src/app.html   the app — this is the file you edit
icon.png       home-screen icon, 192x192
build.py       wraps src/app.html + icon.png into index.html
index.html     built output (committed — the image copies it)
Dockerfile     nginx:alpine, serves index.html on port 80
nginx.conf     gzip + no-cache on the entry file
```

`index.html` is generated. **Never edit it by hand** — edit `src/app.html`
and rebuild, or the next build silently discards your changes.

## Changing something

```bash
# edit src/app.html, then
python3 build.py
git commit -am "what changed"
git push
```

GitHub Pages republishes on its own within a minute or so of the push. It
serves `index.html` with `cache-control: max-age=600`, so a browser that
already has the page can sit on the old copy for up to ten minutes — hard
reload if you need to see a change immediately.

The Coolify mirror does **not** follow a push. Redeploy it by hand from the
Coolify UI if you want the two in sync (note its Redeploy button needs a
double click — a single click only hovers).

## The relay is deployed separately — and almost never

Two things are deployed, and they move on different schedules:

| What | Where | When it needs deploying |
|---|---|---|
| the game (`src/app.html` → `index.html`) | GitHub Pages | every `git push`, automatic |
| the relay (`server/worker.js`) | Cloudflare Workers | only when `server/worker.js` changes |

The relay holds no game logic — it hands out ids and forwards whatever it
receives, byte for byte. New zones, sounds, wardrobe items, levels, even new
fields in the multiplayer messages all live in `app.html`, so a normal update
is just build + push. **Nothing to re-upload to Cloudflare.**

Redeploy the relay only if you edit `server/worker.js` itself (raising
`MAX_PEERS`, adding a route):

```bash
cd server && npx wrangler deploy
```

One thing to watch: everyone in a room runs whatever copy of the page their
browser loaded. Change the message format and a friend who hasn't reloaded is
speaking the old dialect — tell people to hard reload after a multiplayer
change.

## How everyone sees the same world

The world has a fixed size in its own units — `S = 56`, `VH = 1000` — and the
camera scales it to fit the height of whatever screen it lands on. That is the
whole trick. The grid, the zones and the bridges come out identical on a phone
and on a laptop, so cell #1006 is the same bubble everywhere and a position can
travel over the wire as a plain pair of numbers.

Because the world is identical, clients only ever have to agree on **events**,
never on state:

- each player's position, twelve times a second
- the wanderers, from whichever client is **host** — the lowest id in the room.
  Everyone else plays those positions back. The host changes on its own when
  someone leaves.
- one short message per bang: a tap, a collision, a slap, an emote

Nobody sends the sheet. A cell pops under a peer's feet on your machine because
you are running the same footsteps they are. Two rules keep that honest, and
both are easy to break by accident:

- **cells refill on a schedule baked into the cell** (`wait` is derived from the
  cell's index, not `Math.random()`), or two screens would regrow at different
  times
- **the whole sheet keeps its clock, on or off screen.** The draw loop advances
  every cell's state and only *draws* the visible ones. Put the visibility check
  back in front of the state machine and a cell a friend popped three zones away
  freezes mid-pop until you walk up to it.

Level, XP and wardrobe stay local — those are yours, not the room's.

### The paired emotes

Two people showing the same face within two seconds, and **within three body
widths** of each other, turns into a scene. Both machines work out the pair from
the same two emote messages, so the scene itself is never sent:

- **❤️ ❤️** — they hug, then it goes off: a pink shockfront travels out from the
  spot they were standing on and takes the sheet with it. Same `crossWave` the
  slap uses, so it clears the same cells on every screen.
- **💀 💀** — three punches, then a **ten-second duel**. Both of them pop as
  fast as they can; whoever pops less is caged where they stand for ten seconds.

The duel is the one place a *number* has to travel: each side counts its own
pops and sends the total four times a second (`{t:"d", s}`), with one guaranteed
last send when the clock runs out. Both machines then compare the same two
numbers and reach the same verdict, so nobody has to referee. A tie jails
nobody. Two rules to keep in mind if you touch this:

- pairing measures **`atX`/`atY`** — the position a peer last *reported*, not
  the interpolated one on screen. Near the three-body line those differ, and
  reading the drawn position gets you one client pairing while the other does
  not: half a hug is worse than none.
- `pairUp()` runs every frame while a face is up, not just on the keypress.
  Positions land twelve times a second, so a pair often comes together a beat
  after the second face appears.

## Where it runs

Google Cloud VM, Coolify v4, project `endless-sheet` / production. Build pack
is Dockerfile, ports exposes 80, and Traefik routes the sslip.io domain to the
container.

The domain is plain **http**. Let's Encrypt rate-limits `sslip.io` hard enough
that certificate validation fails, so HTTPS needs a real domain: point an A
record at `35.202.38.29`, set it as the domain in Coolify, and a certificate
is issued automatically. Adding to the home screen still gives a fullscreen
app over http — that comes from the meta tags, not the protocol.

## Weather

One minute per turn — clear, rain, thunder or snow — and **nobody is told which
turn it is**. The sky is a pure function of the wall clock: every client hashes
`Math.floor(Date.now() / 60000)` and gets the same answer. That means it also
comes out right for somebody who joins halfway through, and it survives the
host leaving, neither of which a broadcast would give you for free. Phone
clocks drift by a second or two; all that costs is starting the rain a moment
apart, which nobody can see.

10% of minutes are instead a downpour of people, who fall, hit the floor,
blow up the cells under them and vanish.

The turn is shared, and so is the crowd: the falling minute is **scripted from
the seed** — every client unrolls the same list of bodies landing in the same
places at the same offsets into the minute, which is what lets a landing pop
cells without the worlds coming apart. Landings score for nobody (`mine` stays
false throughout), and the bang is only drawn and heard by whoever is looking.
Raindrops and snowflakes remain per-screen, because they touch nothing.

That's the line to keep if you add to this: anything that touches a cell has to
be derived from something every client already agrees on.

## The wanderers

The five wanderers are pets — cat, dog or dinosaur, picked in Setup, purely
cosmetic and per-player (positions are host-synced; looks are yours). Bumping
one plays its cry through the same panner rack as everything else.

There is also a hidden guest: pin yourself against the **bottom edge** of a
zone and keep pushing down for **five seconds**. Do it again to undo it. The
image is a data URI baked into the page at build time — the no-external-requests
rule holds.

## Buzzing an iPhone

Android answers `navigator.vibrate`. Safari mostly does not — Apple never
shipped the Vibration API, so for most of this game's life every buzz was
silently doing nothing on iOS.

What Safari does have is the switch control added in 17.4, which ticks the
phone's haptic engine when it toggles. Clicking a hidden `<label>` for one is
the only way a page can reach that engine. So `buzz()` asks for both and takes
whatever the phone gives it. Three things about it are load-bearing:

- **the switch has to stay rendered.** `display:none` or `visibility:hidden`
  and Safari stops ticking it, which is why `#hap` is a 1px transparent corner
  instead.
- **the click must go through the `<label>`.** Clicking the input directly
  does nothing.
- **it is a side effect, not an API.** It works on iOS 17.4 through 26.4 and
  Apple closed it in 26.5. If a newer iPhone stays silent, that's why, and
  there is no other route from a web page.

`buzz()` also throttles to one every 70ms and only fires for pops *you* caused.
The wanderers pop about three cells a second between them just by walking
around, and a phone that ticks three times a second while you stand still
reads as broken.

## No external requests

Every sound is synthesised in Web Audio at the moment it plays, every sprite
is drawn on a canvas, and the icon and manifest are inlined as data URIs.
Once the page loads, it talks to nothing.

## Progress is per-origin

Level, XP, wardrobe and settings live in `localStorage`, keyed to the origin.
A copy served from a different hostname keeps its own separate save.
