#!/usr/bin/env node
/* ============================================================
   "The most pleasant place on Earth, right now." (CLI)

   Scores the curated pleasant-place list on a live comfort index:
     feels-like (35%) · air quality (25%) · humidity (15%)
     · wind (10%) · dryness (10%) · daytime (5%)

   Usage:  node scripts/perfect.mjs   [topN]   (default 10)
   ============================================================ */

import { PLEASANT, scoreComfort, COMFORT_FIELDS } from "./pleasant.mjs";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIRQUALITY = "https://air-quality-api.open-meteo.com/v1/air-quality";
const TOP = Number(process.argv[2]) || 10;

async function getJSON(base, params) {
  const res = await fetch(`${base}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": "global-extremes/1.0" },
  });
  if (!res.ok) throw new Error(`${base} → HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const params = {
    latitude: PLEASANT.map((p) => p.lat).join(","),
    longitude: PLEASANT.map((p) => p.lon).join(","),
    timezone: "auto",
  };
  const [wx, aq] = await Promise.all([
    getJSON(FORECAST, { ...params, current: COMFORT_FIELDS }),
    getJSON(AIRQUALITY, { ...params, current: "us_aqi" }),
  ]);

  const rows = [];
  PLEASANT.forEach((p, i) => {
    const c = wx[i]?.current;
    const aqi = aq[i]?.current?.us_aqi;
    if (!c || !Number.isFinite(c.apparent_temperature) || !Number.isFinite(aqi)) return;
    rows.push({ ...p, c, aqi, total: scoreComfort(c, aqi).total });
  });
  rows.sort((a, b) => b.total - a.total);

  console.log(`\n🌍  Most pleasant places on Earth right now (${new Date().toISOString().slice(0, 16)}Z)\n`);
  console.log("  #  score  place                          temp  feels  hum  AQI  wind");
  rows.slice(0, TOP).forEach((r, i) => {
    const day = r.c.is_day ? "" : "  🌙";
    console.log(
      `  ${String(i + 1).padStart(2)}  ${String(r.total).padStart(4)}  ` +
        `${(r.name + ", " + r.country).padEnd(30).slice(0, 30)} ` +
        `${String(Math.round(r.c.temperature_2m)).padStart(3)}°  ` +
        `${String(Math.round(r.c.apparent_temperature)).padStart(3)}°  ` +
        `${String(Math.round(r.c.relative_humidity_2m)).padStart(3)}%  ` +
        `${String(Math.round(r.aqi)).padStart(3)}  ` +
        `${String(Math.round(r.c.wind_gusts_10m)).padStart(3)}km/h${day}`
    );
  });

  const win = rows[0];
  if (win)
    console.log(
      `\n🏆  ${win.name}, ${win.country} — score ${win.total}/100 ` +
        `(${Math.round(win.c.apparent_temperature)}°C feels-like, AQI ${Math.round(win.aqi)}, ` +
        `${Math.round(win.c.relative_humidity_2m)}% humidity${win.c.is_day ? ", daytime" : ", night"})\n`
    );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
