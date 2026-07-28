# Endless Sheet — Coolify deploy

A single static page. No build step, no runtime dependencies, no external
requests — the icon, the manifest, every sound and sprite is generated or
embedded in `index.html`.

```
index.html    the app (~225 KB)
Dockerfile    nginx:alpine, serves index.html on port 80
nginx.conf    gzip + no-cache on the entry file
```

---

## 1. Put it in a Git repo

```bash
cd endless-sheet-deploy
git init -b main
git add .
git commit -m "Endless Sheet"
git remote add origin <your-repo-url>
git push -u origin main
```

A private repo is fine — connect it in Coolify with the GitHub App or a
deploy key. A public repo needs no credentials at all.

## 2. Point DNS at the server first

Add an `A` record for the hostname you want (e.g. `sheet.example.com`)
pointing at your Coolify server's IP, and let it resolve **before** step 3.
Coolify asks Let's Encrypt for the certificate the moment you save the
domain; if DNS isn't live yet the request fails and you'll be chasing a
retry.

## 3. Create the application in Coolify

1. **Project → + New → Application**
2. Source: **Public Repository** (paste the URL) or your connected GitHub account
3. Branch: `main`
4. **Build Pack: `Dockerfile`**
5. **Ports Exposes: `80`**
6. **Domains:** `https://sheet.example.com` — with the `https://` prefix;
   Coolify's proxy terminates TLS and issues the certificate itself
7. **Deploy**

First build pulls `nginx:alpine` and copies one file — it takes seconds.

### Alternative: no Dockerfile

Coolify's **Static** build pack serves a directory with its own nginx:

- Build Pack: `Static`
- Publish Directory: `/`
- Ports Exposes: `80`

Same result. You lose the gzip and cache headers from `nginx.conf`, which
for one file is a minor thing. Use the Dockerfile route if you want them.

### Alternative: no Git at all

Create a **Docker Compose** resource using `nginx:alpine`, then
**Storages → Add File Mount** with the destination
`/usr/share/nginx/html/index.html` and paste the file contents in.
It works, but pasting 225 KB into a browser textarea is unpleasant — only
worth it if you can't use a repo.

## 4. Put it on your phone

Open the `https://` URL in **Safari** (iOS) or Chrome (Android) →
**Share → Add to Home Screen**. It launches fullscreen with no browser
chrome and its own icon.

- Add to Home Screen exists only in Safari on iOS, not Chrome for iOS.
- It must be `https`. That's the whole reason for step 2.
- Web Audio obeys the physical silent switch on iPhone — if it looks like
  it's popping but you hear nothing, flip the ringer switch.

## Updating later

Edit `index.html`, commit, push. With **Auto Deploy** enabled Coolify
rebuilds on the webhook; otherwise hit **Redeploy**. `nginx.conf` sends
`no-cache` on the entry file, so a reload picks up the new version rather
than serving a pinned copy.

## Where your progress lives

Level, XP, wardrobe, and settings sit in `localStorage`, keyed to the
origin. The copy on your own domain keeps its own save, separate from the
one hosted on claude.ai. Pick one home and stay with it.
