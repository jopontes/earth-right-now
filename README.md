# Earth Right Now

A minimalist, single-page dashboard of the planet's **weather records, right now** —
the hottest, coldest, wettest, windiest, cleanest and most hazardous spots on Earth
this hour. Instead of looking up one city, it reverses the question and shows the
global extremes.

> **Status:** Phase 1 proof-of-concept — **and the live pipeline works.**
> `scripts/aggregate.mjs` pulls real current data from Open-Meteo (free, no API
> key) for a curated list of record-candidate stations and computes the genuine
> global extremes. 10 of the 12 cards are live; the 2 climate-anomaly cards are
> the only ones still pending a historical baseline (see Next steps).

## What's here

```
Extremes/
├─ index.html            # single page
├─ assets/
│  ├─ styles.css         # design system + dynamic theming
│  └─ app.js             # fetch JSON, render cards, theme engine, Leaflet maps
├─ data/
│  ├─ extremes.json      # the data contract (sample dataset)
│  └─ SCHEMA.md          # field-by-field schema docs
└─ scripts/
   └─ aggregate.mjs      # hourly backend job → writes data/extremes.json
```

## Run it

The page fetches `data/extremes.json`, so it needs to be served over HTTP
(opening `index.html` via `file://` is blocked by the browser's fetch policy):

```bash
cd Extremes
node scripts/serve.mjs        # → http://localhost:8137
```

`serve.mjs` re-runs the aggregator **at startup, on every ↻ Update click**
(`/api/refresh`), and every 10 minutes, so the data is always fresh
(set `REFRESH_MIN=0` to disable, e.g. when a real cron handles it).

No build step, no bundler, no API keys.

### Staying up to date

- **Front-end** auto re-fetches `extremes.json` every **5 minutes**, on tab focus,
  and via the **↻ Update** button in the header. It only repaints when the data
  actually changed, so nothing flickers; the "x min ago" labels tick live.
- **Back-end** freshness comes from how often `aggregate.mjs` runs (the dev server
  every 10 min, or your cron in production).

## The data pipeline

```
Open-Meteo (curated candidate stations, no API key)
        │  hourly cron
        ▼
scripts/aggregate.mjs   ──►   data/extremes.json   ──►   front-end (static read)
```

The browser **never** calls an upstream weather API — it only reads your own
static JSON, so visits are instant and there are no per-user rate limits.

**Run it live now** (fetches real current weather + AQI, writes the JSON):

```bash
node scripts/aggregate.mjs            # → data/extremes.json (live)
```

Regenerate the bundled sample with a fresh timestamp instead (offline):

```bash
node scripts/aggregate.mjs --demo
```

Wire it to cron (top of every hour):

```cron
0 * * * * cd /path/to/Extremes && /usr/bin/node scripts/aggregate.mjs >> aggregate.log 2>&1
```

### How "global maximum" is solved

A weather API can't return *the hottest place on Earth* directly. So
`scripts/stations.mjs` holds a curated shortlist of plausible record-holders
(Death Valley, Vostok, Kuwait, the Atacama, monsoon basins, pollution
hotspots…). `aggregate.mjs` queries all of them in one batched call and keeps
the real extreme per metric. Add more stations → better coverage. If you later
want station-free global tables, drop in SYNOP scrapers (Ogimet / NOAA) as
extra adapters in the `ADAPTERS` array — the normaliser and schema are agnostic
to the source.

## Design notes

- **Dynamic theme adaptation** — `decideTheme()` scores the data and shifts the whole
  palette: ambers/reds when heat dominates, frosted blues for a deep freeze,
  violet for a storm-driven hour.
- **One Leaflet mini-map per card**, single pulsing marker pinned to the record.
- **Country flag + region** on every location for instant geographic context.
- Fluid responsive grid, glassmorphic cards, animated aurora background, respects
  `prefers-reduced-motion`.

## Next steps

1. **Climate anomalies (the 2 missing cards):** compute each station's deviation
   from its monthly normal. Pull a baseline from Open-Meteo's historical/climate
   API (or ERA5) once, cache it, and emit `metric: "anomaly"` observations.
2. **Grow `stations.mjs`** — more candidates = the real extreme is less likely to
   sit just outside the shortlist.
3. **Deploy:** run the cron on a host and serve `data/extremes.json` from static
   hosting / Vercel KV / Supabase.
4. Optional: add a small build (Vite) only if SEO/pre-render becomes a priority.
