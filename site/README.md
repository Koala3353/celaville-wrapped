# Celaville Wrapped -- static site

This is the public, static front end for **Celaville Wrapped** (RecWeek
2026-2027). It is a plain HTML/CSS/JS site with no build step, hosted on
GitHub Pages at **https://wrapped.ateneoceladon.com**.

**This repository contains no member data.** Every reader's actual answers,
persona, stats, and attendance history live entirely in a private Google
Apps Script project and a private Google Sheet, neither of which is public
or part of this repo. This site only knows how to:

1. read a `?id=TOKEN` (or `?mock=1`) query parameter from its own URL,
2. fetch that member's JSON payload from the Apps Script Web App (see
   `assets/api.js`), and
3. render it through the same "walk through Celaville" story UI for
   everyone.

If you can read this repo's source, you are reading the *presentation
layer* only -- there is nothing here to leak.

## Running it locally

No build step, no dependencies, no `npm install`. Any static file server
works:

```sh
cd site
python3 -m http.server 8000
# open http://localhost:8000/?mock=1
```

`?mock=1` hits the Apps Script API's `?api=1&mock=1` endpoint, which returns
a shareable payload built from fabricated data -- never a real member's
answers -- so local development never needs a real token.

You can also just double-click `index.html`, but a real HTTP server is
closer to production (the service worker, in particular, only registers over
`http:`/`https:`, not `file:`).

## Deployment

Deployment **is** pushing to `main`. There is no build step and no CI
pipeline: GitHub Pages serves this repository's `main` branch directly.

- **Repo:** `github.com/Koala3353/celaville-wrapped`
- **Pages source:** repository root of `main` (this `site/` folder's
  contents are what gets pushed to the repo root -- see the note below)
- **Custom domain:** configured two ways, both required:
  1. The `CNAME` file at the repo root (committed, so it survives every
     re-deploy instead of resetting in the GitHub Pages settings UI whenever
     the branch is repushed).
  2. A DNS record at the domain registrar -- see **DNS setup** below. GitHub
     Pages cannot make this half happen on its own.

**Folder note:** everything in this `site/` directory (plus the repo-root
files GitHub Pages requires there, like `CNAME`) is what actually gets
pushed to `github.com/Koala3353/celaville-wrapped`. The rest of the
`rw-wrapped` working tree (`Code.gs`, `Wrapped.html`, the old Apps Script
HtmlService page, internal docs) is **not** part of this repo and must never
be copied into it -- that project also lives under this same local folder
for convenience during development, but it's a private Apps Script project,
not part of the public static site.

## DNS setup (do this once, at the domain registrar)

This is a **manual step outside of GitHub** -- pushing code and committing
`CNAME` does not create the DNS record for you. Whoever controls the
`ateneoceladon.com` domain needs to add, at the DNS provider for that domain:

| Type  | Host / Name | Value                  |
|-------|-------------|------------------------|
| CNAME | `wrapped`   | `Koala3353.github.io`  |

That's a `CNAME` record for the `wrapped` subdomain, pointing at
`Koala3353.github.io` (GitHub Pages' own hostname for this account -- not
`github.com`, and not the repo name). Once that record has propagated (can
take anywhere from a few minutes to a few hours) and the `CNAME` file is
present in the repo, GitHub Pages will serve this site at
`https://wrapped.ateneoceladon.com` with a GitHub-managed HTTPS certificate.

Until that DNS record exists, the site is still reachable at its default
`https://koala3353.github.io/celaville-wrapped/` GitHub Pages URL -- useful
for testing the deploy itself independently of the DNS step.

## How the API connection works (short version)

See `assets/api.js` for the full contract and the CORS reasoning. In short:
Apps Script's `doGet` cannot set custom response headers, so every request
this site makes is a plain `GET` with no custom headers (`?api=1&id=...` as
a query param, never an `Accept` header), and the payload fetch relies on
`fetch`'s default `redirect:'follow'` to ride out the `/exec` -&gt;
`script.googleusercontent.com` redirect hop where the actual
`Access-Control-Allow-Origin: *` header lives.

## Files

See the top-level task/PR description or `Code.gs`'s own comments for the
full picture of the Apps Script side. On the static side:

- `index.html` -- the story page shell + fetch bootstrap
- `assets/api.js` -- the only file that knows Apps Script exists
- `assets/slides.js` -- per-slide content builders + the `S[]` slide table
- `assets/share.js` -- the canvas share card + share sheet
- `assets/app.js` -- the engine: swipe physics, loader, boot sequence
- `assets/styles.css` -- the full "Organic Storybook" design system
- `sw.js` / `manifest.webmanifest` -- offline shell + home-screen install
- `404.html` -- branded not-found page
- `CNAME` / `.nojekyll` / `robots.txt` -- GitHub Pages plumbing
