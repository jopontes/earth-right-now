#!/usr/bin/env node
/* ============================================================
   Earth Right Now — CLI / cron wrapper around scripts/build.mjs.
   Writes data/extremes.json (the published snapshot used for the
   fast first paint; the live front-end recomputes in the browser).

   Usage:
     node scripts/aggregate.mjs            # live
     node scripts/aggregate.mjs --demo     # re-timestamp the snapshot
     node scripts/aggregate.mjs --out path/to/extremes.json
   Node 18+ (global fetch), no dependencies.
   ============================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPayload } from "./build.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const args = process.argv.slice(2);
const DEMO = args.includes("--demo");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : resolve(ROOT, "data/extremes.json");

async function runDemo() {
  const data = JSON.parse(await readFile(resolve(ROOT, "data/extremes.json"), "utf8"));
  const now = new Date();
  data.generatedAt = now.toISOString();
  data.isSample = true;
  data.records.forEach((r) => (r.observedAt = new Date(now.getTime() - 30 * 60000).toISOString()));
  return data;
}

async function main() {
  console.log(`[aggregate] ${new Date().toISOString()}  mode=${DEMO ? "demo" : "live"}`);
  let payload;
  if (DEMO) {
    payload = await runDemo();
  } else {
    const normals = await readFile(resolve(ROOT, "data/normals.json"), "utf8")
      .then(JSON.parse)
      .catch(() => {
        console.warn("  ! data/normals.json missing — anomaly cards skipped (run build-normals.mjs)");
        return { normals: {} };
      });
    payload = await buildPayload(normals);
    console.log(
      `[aggregate] ${payload.records.length} records` +
        (payload.sweetSpot ? ` + sweet spot → ${payload.sweetSpot.location.name}` : "")
    );
  }
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(`[aggregate] wrote → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
