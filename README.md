# Endless Sheet

Infinite bubble wrap — tap, drag, or drive a little character over it. Six
synthesised sound materials, wandering NPCs, levels, generative ambient music.

Live: http://no9k2hqgkxidx8rzwfn8mdb3.35.202.38.29.sslip.io/

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

Coolify sees the push and redeploys on its own. About 30 seconds from `git
push` to the new version being live. `nginx.conf` sends `no-cache` on the
entry file, so a reload picks it up rather than serving a pinned copy.

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
