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

## Where it runs

Google Cloud VM, Coolify v4, project `endless-sheet` / production. Build pack
is Dockerfile, ports exposes 80, and Traefik routes the sslip.io domain to the
container.

The domain is plain **http**. Let's Encrypt rate-limits `sslip.io` hard enough
that certificate validation fails, so HTTPS needs a real domain: point an A
record at `35.202.38.29`, set it as the domain in Coolify, and a certificate
is issued automatically. Adding to the home screen still gives a fullscreen
app over http — that comes from the meta tags, not the protocol.

## No external requests

Every sound is synthesised in Web Audio at the moment it plays, every sprite
is drawn on a canvas, and the icon and manifest are inlined as data URIs.
Once the page loads, it talks to nothing.

## Progress is per-origin

Level, XP, wardrobe and settings live in `localStorage`, keyed to the origin.
A copy served from a different hostname keeps its own separate save.
