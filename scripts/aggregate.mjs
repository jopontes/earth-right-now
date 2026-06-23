#!/usr/bin/env node
/* ============================================================
   Global Extremes — backend aggregator (Phase 1 PoC)

   Runs on an hourly cron, pulls global SYNOP / NOAA extreme
   tables, normalises them into the dashboard schema, and writes
   data/extremes.json. The front-end only ever reads that file,
   so visitors never hit an upstream API (zero rate-limit risk).

   Usage:
     node scripts/aggregate.mjs           # live mode (uses adapters)
     node scripts/aggregate.mjs --demo    # re-timestamp the sample
     node scripts/aggregate.mjs --out path/to/extremes.json

   No third-party dependencies — Node 18+ (global fetch) only.
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { STATIONS } from "./stations.mjs";
import { PLEASANT, scoreComfort, COMFORT_FIELDS } from "./pleasant.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = process.argv.slice(2);
const DEMO = args.includes("--demo");
const OUT =
  args.includes("--out") ? args[args.indexOf("--out") + 1] : resolve(ROOT, "data/extremes.json");

/* ------------------------------------------------------------
   1. SOURCE ADAPTERS
   Each adapter returns an array of raw observations:
     { metric, value, unit, display, context, name, region, country,
       cc, lat, lon, population?, observedAt, source }
   They are isolated so a flaky source can fail without taking the
   whole run down (see safe() below).

   Default source = Open-Meteo (free, no API key). It can't return a
   global maximum directly, so we query the curated candidate list in
   scripts/stations.mjs and compute the extremes ourselves.
   ------------------------------------------------------------ */

const OM_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OM_AIRQUALITY = "https://air-quality-api.open-meteo.com/v1/air-quality";

// Climatological baseline (built by scripts/build-normals.mjs). Empty = no
// anomaly cards, which the UI handles gracefully.
let NORMALS = { normals: {} };

const toF = (c) => (c * 9) / 5 + 32;
const popLabel = (p) => (p >= 1e6 ? `Pop. ${(p / 1e6).toFixed(1)}M` : `Pop. ${Math.round(p / 1e3)}k`);
const isoOrNow = (t) => {
  const d = new Date(`${t}Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

async function getJSON(base, params) {
  const url = `${base}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { "User-Agent": "global-extremes/1.0" } });
  if (!res.ok) throw new Error(`${base} → HTTP ${res.status}`);
  return res.json();
}

// Only inhabited places compete — no mountain peaks, ice sheets or research
// outposts (they'd top the cold/snow cards forever and aren't relatable).
const ACTIVE = STATIONS.filter((s) => s.inhabited !== false);

// Live weather for every candidate station → temp / dew point / humidity / gust / rain.
async function fromOpenMeteo() {
  const data = await getJSON(OM_FORECAST, {
    latitude: ACTIVE.map((s) => s.lat).join(","),
    longitude: ACTIVE.map((s) => s.lon).join(","),
    current:
      "temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m," +
      "wind_gusts_10m,precipitation,snow_depth",
    timezone: "UTC",
  });
  const rows = Array.isArray(data) ? data : [data];
  const obs = [];

  rows.forEach((row, i) => {
    const s = ACTIVE[i];
    const c = row?.current;
    if (!s || !c) return;
    const at = isoOrNow(c.time);
    const base = { ...s, population: s.pop, observedAt: at, source: "Open-Meteo" };
    const num = (v) => (Number.isFinite(v) ? v : null);

    if (num(c.temperature_2m) !== null) {
      const t = c.temperature_2m;
      obs.push({ ...base, metric: "temp", value: t, unit: "°C",
        display: `${t.toFixed(1)}°C`, context: `${toF(t).toFixed(1)}°F`,
        displayImp: `${toF(t).toFixed(1)}°F`, contextImp: `${t.toFixed(1)}°C` });

      // Anomaly vs the cached climatological normal for this station + month.
      const normal = NORMALS.normals?.[s.name];
      if (Number.isFinite(normal)) {
        const d = t - normal;
        const sign = d >= 0 ? "+" : "";
        obs.push({ ...base, metric: "anomaly", value: Math.round(d * 10) / 10, unit: "°C",
          display: `${sign}${d.toFixed(1)}°C`,
          context: `${Math.round(t)}°C now · ${Math.round(normal)}°C normal`,
          displayImp: `${sign}${(d * 1.8).toFixed(1)}°F`,
          contextImp: `${Math.round(toF(t))}°F now · ${Math.round(toF(normal))}°F normal`,
          subtitle: `vs ${NORMALS.monthName || "monthly"} average` });
      }
    }
    if (num(c.apparent_temperature) !== null) {
      const a = c.apparent_temperature;
      obs.push({ ...base, metric: "feels", value: a, unit: "°C",
        display: `${a.toFixed(1)}°C`, context: `Feels like · ${toF(a).toFixed(0)}°F`,
        displayImp: `${toF(a).toFixed(1)}°F`, contextImp: `Feels like · ${a.toFixed(0)}°C` });
    }
    if (num(c.dew_point_2m) !== null) {
      const dp = c.dew_point_2m;
      obs.push({ ...base, metric: "dewpoint", value: dp, unit: "°C",
        display: `${Math.round(dp)}°C`, context: "Dew point",
        displayImp: `${Math.round(toF(dp))}°F`, contextImp: "Dew point" });
    }
    if (num(c.relative_humidity_2m) !== null) {
      const rh = Math.round(c.relative_humidity_2m);
      obs.push({ ...base, metric: "humidity", value: c.relative_humidity_2m, unit: "%",
        display: `${rh}%`, context: "Relative humidity",
        displayImp: `${rh}%`, contextImp: "Relative humidity" });
    }
    if (num(c.wind_gusts_10m) !== null) {
      const g = c.wind_gusts_10m;
      obs.push({ ...base, metric: "gust", value: g, unit: "km/h",
        display: `${Math.round(g)} km/h`, context: "Peak gust · last hour",
        displayImp: `${Math.round(g / 1.60934)} mph`, contextImp: "Peak gust · last hour" });
    }
    if (num(c.precipitation) !== null) {
      const p = c.precipitation;
      obs.push({ ...base, metric: "precip3h", value: p, unit: "mm",
        display: `${p.toFixed(1)} mm`, context: "Rainfall · last hour", subtitle: "Accumulated last hour",
        displayImp: `${(p / 25.4).toFixed(2)} in`, contextImp: "Rainfall · last hour" });
    }
    if (num(c.snow_depth) !== null) {
      const sd = c.snow_depth;
      obs.push({ ...base, metric: "snow", value: sd, unit: "m",
        display: `${sd.toFixed(2)} m`, context: "Snow & firn on the ground",
        displayImp: `${(sd * 3.28084).toFixed(2)} ft`, contextImp: "Snow & firn on the ground" });
    }
  });
  return obs;
}

// US AQI for the same candidates → cleanest vs most hazardous.
async function fromOpenMeteoAQI() {
  const data = await getJSON(OM_AIRQUALITY, {
    latitude: ACTIVE.map((s) => s.lat).join(","),
    longitude: ACTIVE.map((s) => s.lon).join(","),
    current: "us_aqi",
    timezone: "UTC",
  });
  const rows = Array.isArray(data) ? data : [data];
  const obs = [];
  rows.forEach((row, i) => {
    const s = ACTIVE[i];
    const v = row?.current?.us_aqi;
    if (!s || !Number.isFinite(v)) return;
    obs.push({
      ...s, population: s.pop, metric: "aqi", value: v, unit: "AQI",
      display: `AQI ${Math.round(v)}`, context: aqiCategory(v),
      displayImp: `AQI ${Math.round(v)}`, contextImp: aqiCategory(v),
      observedAt: isoOrNow(row.current.time), source: "Open-Meteo AQ",
    });
  });
  return obs;
}

function aqiCategory(v) {
  if (v <= 50) return "Good · clean";
  if (v <= 100) return "Moderate";
  if (v <= 150) return "Unhealthy (sensitive)";
  if (v <= 200) return "Unhealthy";
  if (v <= 300) return "Very unhealthy";
  return "Hazardous";
}

const ADAPTERS = [fromOpenMeteo, fromOpenMeteoAQI];

// The feel-good counterpoint: score the pleasant-place list and return the
// comfiest spot + a Top-5 "where to be right now" leaderboard.
async function sweetSpot() {
  const params = {
    latitude: PLEASANT.map((p) => p.lat).join(","),
    longitude: PLEASANT.map((p) => p.lon).join(","),
    timezone: "auto",
  };
  const [wx, aq] = await Promise.all([
    getJSON(OM_FORECAST, { ...params, current: COMFORT_FIELDS }),
    getJSON(OM_AIRQUALITY, { ...params, current: "us_aqi" }),
  ]);
  const wxr = Array.isArray(wx) ? wx : [wx];
  const aqr = Array.isArray(aq) ? aq : [aq];

  const rows = [];
  PLEASANT.forEach((p, i) => {
    const c = wxr[i]?.current;
    const aqi = aqr[i]?.current?.us_aqi;
    if (!c || !Number.isFinite(c.apparent_temperature) || !Number.isFinite(aqi)) return;
    rows.push({ p, c, aqi, total: scoreComfort(c, aqi).total });
  });
  if (!rows.length) return null;
  rows.sort((a, b) => b.total - a.total);

  const entry = (r, i) => ({
    rank: i + 1,
    name: r.p.name,
    country: r.p.country,
    cc: r.p.cc,
    score: r.total,
    display: String(Math.round(r.total)),
    feels: Math.round(r.c.apparent_temperature),
    aqi: Math.round(r.aqi),
    humidity: Math.round(r.c.relative_humidity_2m),
    isDay: !!r.c.is_day,
  });
  const top = rows.slice(0, 5).map(entry);
  const w = top[0];
  const wr = rows[0];

  return {
    title: "Where to Be Right Now",
    display: w.display,
    score: w.score,
    context:
      `Feels ${w.feels}°C · AQI ${w.aqi} · ${w.humidity}% humidity` +
      (w.isDay ? " · daytime" : " · night"),
    location: { name: wr.p.name, region: "", country: wr.p.country, cc: wr.p.cc, lat: wr.p.lat, lon: wr.p.lon },
    observedAt: new Date().toISOString(),
    source: "Open-Meteo",
    ranking: top,
  };
}

/* ------------------------------------------------------------
   2. NORMALISE — collapse raw observations into one record per
   slot, keeping the most extreme per (kind, selector).
   ------------------------------------------------------------ */

// Which raw observation "wins" each dashboard card.
const SELECTORS = [
  { id: "abs-hot",      kind: "heat",   group: "temperature", pick: "max", title: "Absolute Highest",   subtitle: "Hottest point on Earth", metric: "temp" },
  { id: "abs-cold",     kind: "cold",   group: "temperature", pick: "min", title: "Absolute Lowest",    subtitle: "Coldest point on Earth", metric: "temp" },
  { id: "feels-hot",    kind: "feels",  group: "temperature", pick: "max", title: "Most Dangerous Heat", subtitle: "Highest feels-like temperature", metric: "feels" },
  { id: "city-hot",     kind: "heat",   group: "temperature", pick: "max", title: "Hottest Major City", subtitle: "Urban area over 1M people", metric: "temp", minPop: 1_000_000 },
  { id: "city-cold",    kind: "cold",   group: "temperature", pick: "min", title: "Coldest Major City", subtitle: "Urban area over 1M people", metric: "temp", minPop: 1_000_000 },
  { id: "anomaly-hot",  kind: "heat",   group: "temperature", pick: "max", title: "Hottest vs Normal",  subtitle: "Largest positive anomaly", metric: "anomaly" },
  { id: "anomaly-cold", kind: "cold",   group: "temperature", pick: "min", title: "Coldest vs Normal",  subtitle: "Largest negative anomaly", metric: "anomaly" },
  { id: "humid-high",   kind: "humid",  group: "atmosphere",  pick: "max", title: "Most Saturated",     subtitle: "Highest dew point",        metric: "dewpoint" },
  { id: "humid-low",    kind: "dry",    group: "atmosphere",  pick: "min", title: "Driest Air",         subtitle: "Lowest relative humidity", metric: "humidity" },
  { id: "precip",       kind: "precip", group: "atmosphere",  pick: "max", title: "Heaviest Rainfall",  subtitle: "Accumulated last hour",    metric: "precip3h", floor: 0 },
  { id: "snow",         kind: "snow",   group: "atmosphere",  pick: "max", title: "Deepest Snowpack",   subtitle: "Most snow on the ground",  metric: "snow", floor: 0.005 },
  { id: "wind",         kind: "wind",   group: "atmosphere",  pick: "max", title: "Strongest Wind",     subtitle: "Highest active gust",      metric: "gust" },
  { id: "aqi-clean",    kind: "clean",  group: "atmosphere",  pick: "min", title: "Cleanest Air",       subtitle: "Lowest air quality index", metric: "aqi" },
  { id: "aqi-dirty",    kind: "hazard", group: "atmosphere",  pick: "max", title: "Most Hazardous Air", subtitle: "Highest air quality index", metric: "aqi" },
];

const TOP_N = 5;

function normalise(observations) {
  const records = [];
  for (const sel of SELECTORS) {
    const pool = observations.filter(
      (o) =>
        o.metric === sel.metric &&
        (!sel.minPop || (o.population || 0) >= sel.minPop) &&
        (sel.floor === undefined || o.value > sel.floor)
    );
    if (!pool.length) continue;
    // One entry per station already (each emits one obs per metric); sort + take top N.
    const ranked = [...pool].sort((a, b) =>
      sel.pick === "max" ? b.value - a.value : a.value - b.value
    ).slice(0, TOP_N);
    records.push(toRecord(sel, ranked));
  }
  return records;
}

function toRecord(sel, ranked) {
  const o = ranked[0]; // the headline winner
  const isCity = !!sel.minPop;
  const ctx = (e) => (isCity && e.population ? popLabel(e.population) : e.context || "");
  const ctxImp = (e) => (isCity && e.population ? popLabel(e.population) : e.contextImp || e.context || "");
  return {
    id: sel.id,
    group: sel.group,
    kind: sel.kind,
    title: sel.title,
    subtitle: o.subtitle || sel.subtitle,
    value: o.value,
    unit: o.unit,
    display: o.display,
    displayImp: o.displayImp || o.display,
    context: ctx(o),
    contextImp: ctxImp(o),
    location: {
      name: o.name, region: o.region || "", country: o.country, cc: o.cc,
      lat: o.lat, lon: o.lon,
    },
    observedAt: o.observedAt,
    source: o.source,
    // Top-5 leaderboard (rank 1 = the headline above).
    ranking: ranked.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      region: e.region || "",
      country: e.country,
      cc: e.cc,
      value: e.value,
      display: e.display,
      displayImp: e.displayImp || e.display,
    })),
  };
}

/* ------------------------------------------------------------
   3. ASSEMBLE the final payload (+ derived Thermal Shock Index).
   ------------------------------------------------------------ */
function assemble(records) {
  const hot = records.find((r) => r.id === "abs-hot");
  const cold = records.find((r) => r.id === "abs-cold");
  const deltaC =
    hot && cold ? Math.round((hot.value - cold.value) * 10) / 10 : null;
  const deltaF = deltaC != null ? Math.round(deltaC * 1.8 * 10) / 10 : null;

  return {
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo · curated candidate stations",
    isSample: false,
    thermalShock: { deltaC, deltaF, hotRef: "abs-hot", coldRef: "abs-cold" },
    records,
  };
}

/* ------------------------------------------------------------
   helpers
   ------------------------------------------------------------ */
async function safe(fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`  ! ${fn.name} failed: ${err.message}`);
    return [];
  }
}

async function runDemo() {
  // Re-timestamp the bundled sample so the dashboard looks "fresh"
  // while real adapters are still being wired up.
  const raw = await readFile(resolve(ROOT, "data/extremes.json"), "utf8");
  const data = JSON.parse(raw);
  const now = new Date();
  data.generatedAt = now.toISOString();
  data.isSample = true;
  data.records.forEach(
    (r) => (r.observedAt = new Date(now.getTime() - 30 * 60000).toISOString())
  );
  return data;
}

async function main() {
  console.log(`[aggregate] ${new Date().toISOString()}  mode=${DEMO ? "demo" : "live"}`);
  let payload;

  if (DEMO) {
    payload = await runDemo();
  } else {
    NORMALS = await readFile(resolve(ROOT, "data/normals.json"), "utf8")
      .then(JSON.parse)
      .catch(() => {
        console.warn("  ! data/normals.json missing — anomaly cards skipped (run build-normals.mjs)");
        return { normals: {} };
      });
    const raw = (await Promise.all(ADAPTERS.map((fn) => safe(fn)))).flat();
    console.log(`[aggregate] collected ${raw.length} raw observations`);
    const records = normalise(raw);
    if (!records.length) {
      console.error(
        "[aggregate] no records produced — adapters are still stubs. " +
          "Implement fromOgimet/fromNOAA/fromWAQI, or run with --demo."
      );
      process.exitCode = 1;
      return;
    }
    payload = assemble(records);

    try {
      payload.sweetSpot = await sweetSpot();
      if (payload.sweetSpot)
        console.log(`[aggregate] sweet spot → ${payload.sweetSpot.location.name} (${payload.sweetSpot.display}/100)`);
    } catch (err) {
      console.warn(`  ! sweetSpot failed: ${err.message}`);
    }
  }

  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[aggregate] wrote ${payload.records.length} records → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
