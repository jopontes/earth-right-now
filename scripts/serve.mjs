#!/usr/bin/env node
/* Minimal static file server for local preview (no dependencies).
   Usage: node scripts/serve.mjs [port]   (default 8137) */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, normalize, extname, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8137;
// Re-aggregate live data on an interval so the page always has fresh numbers.
// Set REFRESH_MIN=0 to disable (e.g. when you run aggregate.mjs from a real cron).
const REFRESH_MIN = Number(process.env.REFRESH_MIN ?? 10);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Run the aggregator, de-duplicating concurrent requests behind one job.
let aggJob = null;
function runAggregate() {
  if (aggJob) return aggJob;
  aggJob = new Promise((done) => {
    const p = spawn(process.execPath, [resolve(ROOT, "scripts/aggregate.mjs")], { cwd: ROOT, stdio: "inherit" });
    const finish = (ok) => { aggJob = null; done(ok); };
    p.on("exit", (code) => finish(code === 0));
    p.on("error", (e) => { console.warn(`[serve] aggregate failed: ${e.message}`); finish(false); });
  });
  return aggJob;
}

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);

    // On-demand refresh — the front-end's ↻ Update button hits this to force
    // a fresh aggregation, then re-fetches the JSON. (No-op in static hosting.)
    if (pathname === "/api/refresh") {
      const ok = await runAggregate();
      res.writeHead(ok ? 200 : 500, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok }));
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    await stat(filePath);
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Earth Right Now → http://localhost:${PORT}`);
  if (REFRESH_MIN > 0) {
    runAggregate(); // fresh data the moment the server boots
    setInterval(runAggregate, REFRESH_MIN * 60 * 1000);
    console.log(`[serve] auto-aggregating now + every ${REFRESH_MIN} min (REFRESH_MIN=0 to disable)`);
  }
});
