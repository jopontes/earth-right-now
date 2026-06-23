#!/usr/bin/env node
/* ============================================================
   Build climatological normals for the current month.

   Anomalies need a baseline ("vs normal"). Normals change slowly,
   so we compute them ONCE here (not on every hourly run) from the
   Open-Meteo historical archive (ERA5) and cache to data/normals.json.
   aggregate.mjs reads that file to turn live temps into anomalies.

   Usage:  node scripts/build-normals.mjs   [years]   (default 10)
   ============================================================ */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { STATIONS } from "./stations.mjs";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const YEARS = Number(process.argv[2]) || 8;
const CONCURRENCY = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

const now = new Date();
const month = now.getUTCMonth() + 1;            // 1..12
const mm = String(month).padStart(2, "0");
const endYear = now.getUTCFullYear() - 1;       // archive lags a few days
const startYear = endYear - (YEARS - 1);

async function normalFor(station) {
  const url =
    `${ARCHIVE}?latitude=${station.lat}&longitude=${station.lon}` +
    `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
    `&daily=temperature_2m_mean&timezone=UTC`;

  // Retry with backoff — the archive endpoint throttles bursty data-heavy calls.
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(800 * 2 ** (attempt - 1) + Math.random() * 400);
    try {
      const res = await fetch(url, { headers: { "User-Agent": "global-extremes/1.0" } });
      if (res.status === 429) { lastErr = new Error("429"); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const t = j?.daily?.time || [];
      const v = j?.daily?.temperature_2m_mean || [];
      const samples = v.filter((x, i) => t[i]?.slice(5, 7) === mm && Number.isFinite(x));
      if (!samples.length) throw new Error("no samples");
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Tiny concurrency pool so we don't hammer the archive endpoint.
async function pool(items, size, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return out;
}

async function main() {
  console.log(
    `[normals] ${MONTHS[month - 1]} baseline · ${startYear}-${endYear} (${YEARS}y) · ${STATIONS.length} stations`
  );
  const normals = {};
  let ok = 0;

  await pool(STATIONS, CONCURRENCY, async (s) => {
    try {
      normals[s.name] = Math.round((await normalFor(s)) * 10) / 10;
      ok++;
      process.stdout.write(".");
    } catch (err) {
      process.stdout.write("x");
    }
  });

  const out = {
    month,
    monthName: MONTHS[month - 1],
    baseline: `${startYear}-${endYear}`,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo archive (ERA5)",
    normals,
  };
  await writeFile(resolve(ROOT, "data/normals.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`\n[normals] wrote ${ok}/${STATIONS.length} → data/normals.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
