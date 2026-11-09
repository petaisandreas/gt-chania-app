# GT Chania

Academy app for **Grappling Team Chania**, built on the BJJ GYM platform (demo data only, stored in the browser). The gym's branding lives in `clients/gt-chania/`.

# BJJ GYM

White-label academy management platform for Jiu-Jitsu schools: marketing site, staff web app, front-desk kiosk, member portal and mat TV.
One codebase, one folder per client under `clients/`. Vanilla JS modules, a tiny Node static server, and a build step that brands each client.

```bash
node server.js        # develop: serves the default client from source -> http://127.0.0.1:5173
npm install           # once, for the build (installs sharp, used to render the PNG app icons)
npm run build         # builds every client into dist/
npm run preview       # serves dist/ the way GitHub Pages will -> http://127.0.0.1:5173
```

| Page | Path |
|---|---|
| Marketing site + trial signup | `/` |
| Staff app | `/app.html` (dev alias `/app`) |
| Check-in kiosk (tablet) | `/kiosk.html` (`/kiosk`) |
| Member portal (phone) | `/member.html` (`/member`) |
| Mat TV (round timer + who's on the mat) | `/tv.html` (`/tv`) |

Environment variables for `server.js`: `PORT` (default `5173`) and `HOST` (default `127.0.0.1`, local only).
To open the kiosk or TV from a tablet or screen on your network, start it with `HOST=0.0.0.0` (PowerShell: `$env:HOST="0.0.0.0"; node server.js`).
This exposes the server to everyone on that network, so only do it on a network you trust. It is a development server, not for production.

## Clients

Each client is a folder in `clients/`:

```
clients/
  bjj-gym/         default client, built to the site root (dist/)
    client.json    name, owner, contact, currency, storage prefix, colours, site text
    logo.svg       single-colour mark (used to generate the logo tile and app icons)
    icons/         optional overrides: logo.svg (full-colour tile), icon-192.png, icon-512.png, icon-apple.png
  demo-academy/    example second client, built to dist/demo-academy/
  _template/       copied by `npm run new-client`
```

Exactly one client has `"isDefault": true`; it is served at the site root. Every other client is served at `/<id>/`.
`client.json` is validated on every build: unknown or missing fields, bad colours and clashing ids fail with the exact path of the problem.

What the build does for each client: renders the `{{tokens}}` in the HTML pages, copies `css/`, `js/` and `assets/`, then writes the generated files
`js/client.js` (name, owner, currency, storage prefix), `css/client.css` (colours), `assets/logo.svg` and `assets/icon-192.png`, `icon-512.png`, `icon-apple.png`.
There is no service worker and no web manifest.

The default client's generated files are also committed in the repo so `node server.js` works without a build. After editing `clients/bjj-gym/`,
run `npm run sync-default` to refresh them.

### Browser storage

Every client stores its data under its own prefix (`storagePrefix` in `client.json`): `<prefix>:v1`, `<prefix>:member`, `<prefix>:theme`, `<prefix>:tv`
and the IndexedDB database `<prefix>-files`. The default client uses `bjjgym`, so existing saved data keeps loading.

**Prefix rule.** Every client except the default must use a prefix that starts with `bjj-` (the build rejects anything else; `npm run new-client` sets `bjj-<id>`).
The sibling app kyri-training is published on the same `github.io` origin and uses its own prefixes (`kyri`, `demo-coach`, which are reserved here), so the `bjj-` namespace keeps the two apps apart.
A prefix that has ever been published must never be reused for another client or app, or the new one would inherit the old one's saved data.

**Same-origin warning.** All clients built into one site share one origin (for example `https://you.github.io`), so the browser lets them read each other's storage.
The prefixes keep honest clients apart, but they are not a security boundary. Do not put real member data for several different businesses on one origin.
Give each real client its own domain (see below) or keep shared-origin clients to demos.

## Adding a new client (about 20 minutes)

1. Scaffold it (1 minute):
   ```bash
   npm run new-client -- acme-bjj "Acme BJJ" --owner "Sam Lee"
   ```
   The id is lower-case letters, digits and hyphens (2-31 characters); the storage prefix becomes `bjj-acme-bjj`. Reserved folder names (`css`, `js`, `assets`, `clients`, `scripts`, `dist`, ...) are rejected.
2. Edit `clients/acme-bjj/client.json` (10 minutes): owner name/short/initials, email, Instagram handle, currency and number locale, the default location and staff email domain,
   the site title/description/hero text/promo line, and the colours (`theme.light`, `theme.dark`, `theme.screen` for kiosk and TV, `theme.logo` for the logo tile).
   `storagePrefix` must start with `bjj-`, be unique, and must never be reused after the client is retired (the next client would inherit its saved data).
3. Replace `clients/acme-bjj/logo.svg` (3 minutes) with the academy's logo as a single-colour mark on a square `viewBox`. Only `path`, `rect`, `circle`, `polygon` and `g` are kept and colours are ignored.
   For a full-colour logo instead, put it at `clients/acme-bjj/icons/logo.svg`; only `fill="#rrggbb"` colours survive. Logos are limited to 20 KB. Symbolic links inside `clients/` or the app source are rejected by the build, and icon overrides must be real PNG files. Optional own app icons: `icons/icon-192.png`, `icon-512.png`, `icon-apple.png`.
4. Build and look (5 minutes): `npm run build`, then `npm run preview` and open `http://127.0.0.1:5173/acme-bjj/`. Check the site, `/acme-bjj/app.html`, the kiosk and the TV.
5. Publish: commit the `clients/acme-bjj/` folder and push to `main`, then deploy (see below).

Build just one client with `node scripts/build.mjs --only acme-bjj`, or as a whole site for its own domain with `node scripts/build.mjs --only acme-bjj --as-root`.

## Deploying to GitHub Pages

`.github/workflows/pages.yml` runs `npm ci --ignore-scripts`, `npm run build`, then publishes `dist/`.
It currently runs **only when started manually** (Actions tab -> Deploy to GitHub Pages -> Run workflow), because Pages is not enabled on this private repository:
GitHub Pages for private repositories needs a paid plan (GitHub Pro/Team), and the published site is public even when the repository is private.
To turn it on: enable **Settings -> Pages -> Source: GitHub Actions**, then re-add the `push: branches: [main]` trigger in the workflow.

### Custom domain

A custom domain serves one site, so give it to one client: build that client as the root with `node scripts/build.mjs --only <id> --as-root`
and publish `dist/` from a repository (or branch) dedicated to that client. Put the host name in `deploy.customDomain` in `client.json` as a record of what is configured,
then add the domain in the Pages settings and create the DNS records GitHub lists. Because the domain is its own origin, that client's data is isolated from the others.

## Modules
Dashboard · Members (class-group tabs with monthly price, paid / due soon / overdue status with a grace-period day, one-tap Mark paid, profiles, CSV export) · Schedule & attendance (weekly grid, rosters, reservations) ·
Documents (health certificates & waivers with expiry tracking, files kept in IndexedDB) · Belts & progress (configurable stripe/belt rules, eligibility, leaderboard) · Curriculum (technique library, lesson plans) ·
Events (seminars, belt tests, competitions with paid registration) · Billing (plans, invoices, monthly run, failed-payment retry, expenses) ·
Leads & automations (drag-and-drop pipeline, convert-to-member, email/SMS sequences, embeddable form) ·
Staff & payroll (per-class pay, pay periods) · Pro shop (POS, inventory, low-stock alerts, charge-to-account) · Reports · Settings (locations, backup/restore).

## Data
Everything is stored in the browser's `localStorage` and seeded with a demo academy.
Reset from **Settings -> Reset demo data**. The kiosk and app sync across tabs.

## Code map
- `clients/<id>/` - per-client config and logo; `scripts/` - build, sync-default, new-client
- `js/client.js`, `css/client.css` - generated per client (do not edit by hand)
- `js/store.js` - data model, seed data, derived logic (eligibility, check-in, promotion), storage keys
- `js/ui.js` - escaping, modal/form helpers, charts, toasts
- `js/app.js` - shell + hash router; `js/views/*.js` - one file per module
- `js/kiosk.js` - PIN / name check-in
- `css/tokens.css` (theme, light/dark), `css/app.css`, `css/site.css`

## Next steps for production
Real backend + auth (e.g. Postgres + an API), a payment processor for recurring billing,
an email/SMS provider to actually send automation steps, and a native/PWA member app.
