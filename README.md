# ChaosNav – Smarter Route Planner

> Traditional apps optimise for speed. ChaosNav optimises for **safety, accessibility and real conditions** by routing around hazards reported by the community.

**Live demo:** https://chaosnavigator.netlify.app
**Team ChaosNav** – Geo AI Hackathon, Topic 9: *Smarter Route Planner* (Lalith Chandar SM, A Dinesh, Rijul Siby C)

---

## Features

| Feature | What it does |
|---|---|
| **Route alternatives + dashboard** | Up to 5 colour-coded routes with time labels. A side dashboard names the **Safest**, **Fastest** (lowest expected time) and **Longest** (distance) route with arrival time, distance and issues on each. |
| **Smart place search** | Suggestions as you type, tolerant of typos and short forms ("univ", "clg"), biased to the area on the map. Pins are draggable and show a readable address. |
| **Community issue reporting** | Separate report page: 8 types (flood, closure, accident, damaged road, missing ramp, broken footpath, stairs, hard avoid zone), severity, radius, note. Anyone can report. |
| **Shared + auto-expiring** | Reports are shared with all users, hidden after **48 hours**, then archived in this repo. |
| **Hazard-aware routing** | Active reports add time penalties; closures/avoid zones block a route. Detours are tried around hazards. |
| **Walk & wheelchair modes** | Wheelchair mode treats missing ramps, stairs and broken footpaths as hard blocks. |
| **Traffic-aware ETA** | Typical congestion by time of day/weekday, manual levels, departure time. Optional **live traffic** (TomTom). |
| **Live location** | Blue dot that moves with you, follow mode, "use my location as start". |
| **Admin delete** | Only the software handler (password) can delete reports. |

## Tech stack

| Part | Technology |
|---|---|
| Front end | HTML, CSS, JavaScript, [Leaflet](https://leafletjs.com) |
| Map data | OpenStreetMap |
| Place search | Photon (OSM), Nominatim fallback, TomTom Fuzzy Search *(optional)* |
| Routing | OSRM public servers, TomTom Routing *(optional)* |
| Back end | Netlify Functions (Node.js 18) |
| Database | This GitHub repo (`data/active.json`) via the GitHub Contents API |
| Automation | GitHub Actions (hourly archive) |
| Hosting | Netlify (auto-deploys from GitHub) |
| Demo fallback | Browser LocalStorage |

## How it works

```
User ─► Web app (Leaflet) ─► Netlify Functions ─► GitHub repo (reports)
                          ├─► Photon / TomTom  (place search)
                          └─► OSRM / TomTom    (routes)
```

1. **Search** – user types a place; suggestions are ranked and shown; user picks one or drags the pin.
2. **Routes** – app loads active reports from `/api/reports` and asks OSRM (or TomTom) for routes; times adjusted for traffic.
3. **Assess** – each route = travel time + penalties for reports within their radius. Hard blocks make it "not passable".
4. **Detour** – if the best route still crosses issues, via-point detours are tried (dead-ends and over-long ones rejected).
5. **Show** – dashboard lists Safest / Fastest / Longest; user chooses.
6. **Report** – new issue → `POST /api/reports` → function commits it to `data/active.json`. Everyone sees it on next refresh.
7. **Expire & archive** – after 48 h it stops appearing; the hourly Action moves it to `data/archive/YYYY-MM.json`.
8. **Moderate** – admin signs in; server checks the password and deletes the report with a commit.

## Project structure

```
chaosnav/
├── public/index.html               # whole front end (UI + routing logic)
├── netlify/functions/
│   ├── reports.js                  # GET / POST / DELETE reports (GitHub = database)
│   ├── traffic.js                  # optional live-traffic routing (TomTom)
│   └── search.js                   # optional place search (TomTom)
├── scripts/archive.js              # moves expired reports to data/archive/
├── .github/workflows/archive.yml   # runs archive.js every hour
├── data/active.json                # live reports (starts as [])
├── netlify.toml                    # Netlify build + /api redirect
└── .gitignore
```

**Report format** (`data/active.json`):
```json
{ "id": "lx3k9a2b", "type": "flood", "lat": 12.97, "lng": 77.59, "r": 80, "sev": 2,
  "note": "Knee-deep water", "t": 1731580000000, "exp": 1731752800000 }
```

## Setup

### 1. Get the code on GitHub
Fork/clone this repo, or create a new public repo named `chaosnav` and push the project:
```bash
git init
git add .
git commit -m "Initial ChaosNav"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/chaosnav.git
git push -u origin main
```
Check that the hidden `.github` folder was uploaded.

### 2. Allow the archive bot to commit
Repo → **Settings → Actions → General → Workflow permissions** → **Read and write permissions** → Save.

### 3. Create a GitHub token
GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
- Repository access: **Only select repositories** → `chaosnav`
- Permissions → **Contents: Read and write**
- Copy the token (shown once).

### 4. Deploy on Netlify
1. [netlify.com](https://netlify.com) → sign up with GitHub → **Import a Git repository → GitHub** → choose `chaosnav`.
2. Leave build settings as they are (read from `netlify.toml`).
3. Add environment variables:

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | the token from step 3 |
| `GITHUB_REPO` | `YOUR-USERNAME/chaosnav` |
| `GITHUB_BRANCH` | `main` |
| `ADMIN_PASSWORD` | a long password for the software handler |
| `TOMTOM_KEY` | *(optional)* free key from [developer.tomtom.com](https://developer.tomtom.com) – enables live traffic + better search |

4. **Deploy**. Variables added later only apply after **Deploys → Trigger deploy → Deploy site**.
5. If your site shows **Private**, click **Make public** so others can open it.

### 5. Verify
- Open `https://YOUR-SITE.netlify.app/api/reports` → should show `{"reports":[]}`.
- Open the site → header badge should be **green** ("Shared reports · GitHub").
- Add a report → a new commit appears in `data/active.json`.
- Test archiving: edit a report's `exp` in `data/active.json` to `1700000000000`, then **Actions → Archive expired reports → Run workflow**. It should move to `data/archive/`.

## Admin (software handler)
Click **Admin** in the header, enter `ADMIN_PASSWORD`; Delete buttons appear on issues. The password is checked on the server, never stored in the page. To change it, edit the variable in Netlify and redeploy.

## Run locally
```bash
npm i -g netlify-cli
netlify login
```
Create a `.env` file (already git-ignored) with `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `ADMIN_PASSWORD` (and `TOMTOM_KEY`), then:
```bash
netlify dev        # opens http://localhost:8888
```
Opening `public/index.html` with VS Code Live Server also works in **local demo mode** (reports saved in the browser only).

## Updating & customising
Deploy any change:
```bash
git add .
git commit -m "Describe your change"
git pull --rebase origin main    # the app itself commits reports, so pull first
git push
```
| To change… | Edit |
|---|---|
| Add/rename an issue type | `T` in `public/index.html` **and** `TYPES` in `netlify/functions/reports.js` |
| Report lifetime (48 h) | `TTL` in `public/index.html` and `reports.js` |
| Time penalty per issue | `p` values in `T` (seconds; `1e5` = hard block) |
| Typical-traffic strength | `WD` (weekday) / `WE` (weekend) arrays in `index.html` |
| Labels and colours | search the label text in `public/index.html` (Ctrl + Shift + F) |

## Limitations
- Public OSRM, Photon and Nominatim servers are for light use; heavy traffic needs self-hosted servers.
- Without a TomTom key, traffic is a typical-pattern estimate, not live.
- Reports are not verified; one shared admin password (no individual accounts).
- TomTom's free tier is limited (about 2,500 requests/day, shared by search and routing).

## Future scope
Automatic re-routing while travelling, voice directions, report voting and photos, using archived data to flag repeat flood spots, predictive AI and direct municipal sensor integration.

## Credits
Map data © OpenStreetMap contributors · Leaflet · OSRM · Photon / Nominatim · TomTom · Netlify · GitHub
