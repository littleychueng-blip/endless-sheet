#!/usr/bin/env python3
"""Wrap src/app.html into the deployable index.html.

The app itself lives in src/app.html as a fragment: <title>, <style>, markup,
<script>. This adds the document shell plus everything a phone needs to treat
it as an installed app — fullscreen meta tags, a manifest, and the home-screen
icon — all inlined as data URIs so the page makes zero external requests.

    python3 build.py

Edit src/app.html, run this, commit. Coolify redeploys on push.
"""

import base64
import json
import pathlib

HERE = pathlib.Path(__file__).parent
APP = HERE / "src" / "app.html"
ICON = HERE / "icon.png"
OUT = HERE / "index.html"

GROUND_LIGHT = "#EDECF1"
GROUND_DARK = "#131319"


def main() -> None:
    app = APP.read_text()
    icon = base64.b64encode(ICON.read_bytes()).decode()

    # the fragment carries its own <title>; in the built page it belongs in <head>
    app = app.replace("<title>Endless Sheet</title>\n", "", 1)

    manifest = {
        "name": "Endless Sheet",
        "short_name": "Endless Sheet",
        "description": "Infinite bubble wrap. Tap, drag, or drive the walker.",
        "display": "standalone",
        "orientation": "any",
        "background_color": GROUND_DARK,
        "theme_color": GROUND_DARK,
        "icons": [{
            "src": "data:image/png;base64," + icon,
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any",
        }],
    }
    mani = base64.b64encode(json.dumps(manifest, separators=(",", ":")).encode()).decode()

    head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>Endless Sheet</title>

<!-- launches fullscreen from the home screen, no browser chrome -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Endless Sheet">
<meta name="theme-color" content="{GROUND_LIGHT}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="{GROUND_DARK}" media="(prefers-color-scheme: dark)">

<link rel="apple-touch-icon" href="data:image/png;base64,{icon}">
<link rel="icon" type="image/png" href="data:image/png;base64,{icon}">
<link rel="manifest" href="data:application/manifest+json;base64,{mani}">
</head>
<body>
"""

    OUT.write_text(head + app + "\n</body>\n</html>\n")
    print(f"built {OUT.name}: {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
