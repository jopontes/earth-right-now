/* ============================================================
   Global Extremes — front-end
   Reads one static JSON (built hourly by the backend aggregator)
   and renders the dashboard. No per-user API calls, no maps.
   ============================================================ */

const DATA_URL = "data/extremes.json";
const REFRESH_MS = 5 * 60 * 1000; // auto re-fetch the JSON every 5 minutes
const AGE_TICK_MS = 30 * 1000;    // keep the "x min ago" labels fresh
let lastGeneratedAt = null;       // skip re-render when the data hasn't changed
let lastData = null;              // kept so a language switch can re-render
let hideTip = () => {};           // set by initTooltips; dismiss the custom tooltip

/* ============================================================
   i18n — English / Português / Español
   Card titles are keyed by record id; the live `context` strings
   baked by the backend are localised token-by-token (localizeContext).
   ============================================================ */
const AQI_CATS_EN = ["Good · clean", "Moderate", "Unhealthy (sensitive)", "Unhealthy", "Very unhealthy", "Hazardous"];

const I18N = {
  en: {
    tagline: "The planet's records... in real time.",
    sections: { sweet: "Where to Be Right Now", temp: "Temperature & Anomalies", atmo: "Atmosphere & Environment" },
    hero: { label: "Thermal Shock Index", caption: "the gap between the hottest and coldest points on Earth this hour" },
    moods: { loading: "Reading the planet…", heat: "Heat is running the planet right now", cold: "A deep freeze dominates the globe", storm: "Storms are driving today's extremes", neutral: "A calm hour across the planet" },
    updated: "updated", update: "Update", runners: "Runner-ups", comfort: "Comfort index · live",
    footerMain: "<strong>Earth Right Now</strong>... extremes computed hourly from a curated worldwide station set.",
    live: (t, src) => `Live snapshot · generated ${t} · source: ${src}`,
    sample: "⚠︎ Showing the bundled sample dataset. Run scripts/aggregate.mjs on a cron to publish live records.",
    rel: { now: "just now", min: (n) => `${n} min ago`, hour: (n) => `${n}h ago`, day: (n) => `${n}d ago` },
    titles: { "abs-hot": "Absolute Highest", "abs-cold": "Absolute Lowest", "feels-hot": "Most Dangerous Heat", "city-hot": "Hottest Major City", "city-cold": "Coldest Major City", "anomaly-hot": "Hottest vs Normal", "anomaly-cold": "Coldest vs Normal", "humid-high": "Most Saturated", "humid-low": "Driest Air", "precip": "Heaviest Rainfall", "snow": "Deepest Snowpack", "wind": "Strongest Wind", "aqi-clean": "Cleanest Air", "aqi-dirty": "Most Hazardous Air" },
    tips: { "abs-hot": "The hottest air temperature at any inhabited place on Earth right now.", "abs-cold": "The coldest air temperature at any inhabited place on Earth right now.", "feels-hot": "Highest 'feels-like' temperature... heat plus humidity, wind and sun. The most dangerous place to be outside.", "city-hot": "Hottest city with over 1 million people right now.", "city-cold": "Coldest city with over 1 million people right now.", "anomaly-hot": "Where today's temperature is furthest ABOVE its historical average for this month.", "anomaly-cold": "Where today's temperature is furthest BELOW its historical average for this month.", "humid-high": "Highest dew point... how muggy the air feels. Higher = stickier.", "humid-low": "Lowest relative humidity... the driest air on Earth right now.", "precip": "Most rain accumulated in the last hour.", "snow": "Deepest snow currently on the ground.", "wind": "Strongest wind gust measured right now.", "aqi-clean": "Lowest Air Quality Index... the cleanest air. Lower is better.", "aqi-dirty": "Highest Air Quality Index... the most polluted air. Higher is worse.", "thermal": "The temperature gap between the hottest and coldest points on Earth this hour.", "comfort": "A 0–100 score of how pleasant it is to be outside: feels-like, air quality, humidity, wind, rain and daylight." },
    ctx: { feelsLike: "Feels like", feels: "Feels", dew: "Dew point", relhum: "Relative humidity", rainfall: "Rainfall", lastHour: "last hour", snowGround: "Snow & firn on the ground", gust: "Peak gust", now: "now", normal: "normal", humidity: "humidity", day: "daytime", night: "night" },
    aqi: AQI_CATS_EN,
  },
  pt: {
    tagline: "Os recordes do planeta... em tempo real.",
    sections: { sweet: "Onde Estar Agora", temp: "Temperatura & Anomalias", atmo: "Atmosfera & Ambiente" },
    hero: { label: "Índice de Choque Térmico", caption: "a diferença entre os pontos mais quente e mais frio da Terra nesta hora" },
    moods: { loading: "Lendo o planeta…", heat: "O calor domina o planeta agora", cold: "Um frio intenso domina o globo", storm: "Tempestades comandam os extremos de hoje", neutral: "Uma hora calma pelo planeta" },
    updated: "atualizado", update: "Atualizar", runners: "Vice-líderes", comfort: "Índice de conforto · ao vivo",
    footerMain: "<strong>Earth Right Now</strong>... extremos calculados de hora em hora a partir de uma rede curada de estações.",
    live: (t, src) => `Dados ao vivo · gerado ${t} · fonte: ${src}`,
    sample: "⚠︎ Exibindo o conjunto de amostra. Rode scripts/aggregate.mjs num cron para publicar dados ao vivo.",
    rel: { now: "agora mesmo", min: (n) => `há ${n} min`, hour: (n) => `há ${n}h`, day: (n) => `há ${n}d` },
    titles: { "abs-hot": "Mais Quente", "abs-cold": "Mais Frio", "feels-hot": "Calor Mais Perigoso", "city-hot": "Cidade Mais Quente", "city-cold": "Cidade Mais Fria", "anomaly-hot": "Mais Acima da Média", "anomaly-cold": "Mais Abaixo da Média", "humid-high": "Mais Úmido", "humid-low": "Ar Mais Seco", "precip": "Mais Chuva", "snow": "Mais Neve", "wind": "Vento Mais Forte", "aqi-clean": "Ar Mais Limpo", "aqi-dirty": "Ar Mais Poluído" },
    tips: { "abs-hot": "A maior temperatura do ar em qualquer lugar habitado da Terra agora.", "abs-cold": "A menor temperatura do ar em qualquer lugar habitado da Terra agora.", "feels-hot": "Maior sensação térmica... calor somado à umidade, vento e sol. O lugar mais perigoso pra estar ao ar livre.", "city-hot": "Cidade mais quente com mais de 1 milhão de habitantes agora.", "city-cold": "Cidade mais fria com mais de 1 milhão de habitantes agora.", "anomaly-hot": "Onde a temperatura de hoje está mais ACIMA da média histórica do mês.", "anomaly-cold": "Onde a temperatura de hoje está mais ABAIXO da média histórica do mês.", "humid-high": "Maior ponto de orvalho... o quão abafado o ar está. Quanto maior, mais grudento.", "humid-low": "Menor umidade relativa... o ar mais seco da Terra agora.", "precip": "Maior volume de chuva acumulado na última hora.", "snow": "Maior acúmulo de neve no chão no momento.", "wind": "A maior rajada de vento medida agora.", "aqi-clean": "Menor Índice de Qualidade do Ar... o ar mais limpo. Menor é melhor.", "aqi-dirty": "Maior Índice de Qualidade do Ar... o ar mais poluído. Maior é pior.", "thermal": "A diferença de temperatura entre os pontos mais quente e mais frio da Terra nesta hora.", "comfort": "Uma nota de 0 a 100 de quão agradável é estar ao ar livre: sensação térmica, qualidade do ar, umidade, vento, chuva e luz do dia." },
    ctx: { feelsLike: "Sensação", feels: "Sensação", dew: "Ponto de orvalho", relhum: "Umidade relativa", rainfall: "Chuva", lastHour: "última hora", snowGround: "Neve acumulada", gust: "Rajada máx.", now: "agora", normal: "média", humidity: "umidade", day: "de dia", night: "de noite" },
    aqi: ["Bom · limpo", "Moderado", "Insalubre (sensíveis)", "Insalubre", "Muito insalubre", "Perigoso"],
  },
  es: {
    tagline: "Los récords del planeta... en tiempo real.",
    sections: { sweet: "Dónde Estar Ahora", temp: "Temperatura y Anomalías", atmo: "Atmósfera y Ambiente" },
    hero: { label: "Índice de Choque Térmico", caption: "la diferencia entre los puntos más caliente y más frío de la Tierra esta hora" },
    moods: { loading: "Leyendo el planeta…", heat: "El calor domina el planeta ahora", cold: "Un frío intenso domina el globo", storm: "Las tormentas dominan los extremos de hoy", neutral: "Una hora tranquila por el planeta" },
    updated: "actualizado", update: "Actualizar", runners: "Subcampeones", comfort: "Índice de confort · en vivo",
    footerMain: "<strong>Earth Right Now</strong>... extremos calculados cada hora desde una red curada de estaciones.",
    live: (t, src) => `Datos en vivo · generado ${t} · fuente: ${src}`,
    sample: "⚠︎ Mostrando el conjunto de muestra. Ejecuta scripts/aggregate.mjs en un cron para publicar datos en vivo.",
    rel: { now: "ahora mismo", min: (n) => `hace ${n} min`, hour: (n) => `hace ${n} h`, day: (n) => `hace ${n} d` },
    titles: { "abs-hot": "Más Caluroso", "abs-cold": "Más Frío", "feels-hot": "Calor Más Peligroso", "city-hot": "Ciudad Más Calurosa", "city-cold": "Ciudad Más Fría", "anomaly-hot": "Más Sobre la Media", "anomaly-cold": "Más Bajo la Media", "humid-high": "Más Húmedo", "humid-low": "Aire Más Seco", "precip": "Más Lluvia", "snow": "Más Nieve", "wind": "Viento Más Fuerte", "aqi-clean": "Aire Más Limpio", "aqi-dirty": "Aire Más Contaminado" },
    tips: { "abs-hot": "La mayor temperatura del aire en cualquier lugar habitado de la Tierra ahora.", "abs-cold": "La menor temperatura del aire en cualquier lugar habitado de la Tierra ahora.", "feels-hot": "Mayor sensación térmica... calor más humedad, viento y sol. El lugar más peligroso para estar al aire libre.", "city-hot": "Ciudad más calurosa con más de 1 millón de habitantes ahora.", "city-cold": "Ciudad más fría con más de 1 millón de habitantes ahora.", "anomaly-hot": "Donde la temperatura de hoy está más POR ENCIMA de su media histórica del mes.", "anomaly-cold": "Donde la temperatura de hoy está más POR DEBAJO de su media histórica del mes.", "humid-high": "Mayor punto de rocío... qué tan bochornoso se siente el aire. Más alto = más pegajoso.", "humid-low": "Menor humedad relativa... el aire más seco de la Tierra ahora.", "precip": "Mayor lluvia acumulada en la última hora.", "snow": "Mayor acumulación de nieve en el suelo ahora.", "wind": "La racha de viento más fuerte medida ahora.", "aqi-clean": "Menor Índice de Calidad del Aire... el aire más limpio. Menor es mejor.", "aqi-dirty": "Mayor Índice de Calidad del Aire... el aire más contaminado. Mayor es peor.", "thermal": "La diferencia de temperatura entre los puntos más caliente y más frío de la Tierra esta hora.", "comfort": "Una puntuación de 0 a 100 de lo agradable que es estar al aire libre: sensación térmica, calidad del aire, humedad, viento, lluvia y luz del día." },
    ctx: { feelsLike: "Sensación", feels: "Sensación", dew: "Punto de rocío", relhum: "Humedad relativa", rainfall: "Lluvia", lastHour: "última hora", snowGround: "Nieve acumulada", gust: "Racha máx.", now: "ahora", normal: "media", humidity: "humedad", day: "de día", night: "de noche" },
    aqi: ["Bueno · limpio", "Moderado", "Dañino (sensibles)", "Dañino", "Muy dañino", "Peligroso"],
  },
};

let lang = "en";
const L = () => I18N[lang];

// Unit system — "metric" | "imperial". Backend bakes both, we just pick.
let units = "metric";
const imperial = () => units === "imperial";
const pickD = (o) => (imperial() && o.displayImp ? o.displayImp : o.display);
const pickC = (o) => (imperial() && o.contextImp ? o.contextImp : o.context || "");
const cToDisp = (c) => (imperial() ? `${Math.round(c * 1.8 + 32)}°F` : `${Math.round(c)}°C`);

// Localise a backend-baked context string token by token (longest first).
function localizeContext(s) {
  if (!s) return s;
  const i = AQI_CATS_EN.indexOf(s);
  if (i >= 0) return L().aqi[i];
  const en = I18N.en.ctx, tr = L().ctx;
  let out = s;
  for (const k of ["feelsLike", "snowGround", "dew", "relhum", "rainfall", "gust", "lastHour", "feels", "now", "normal", "humidity", "day", "night"]) {
    if (en[k] && tr[k] && en[k] !== tr[k]) out = out.split(en[k]).join(tr[k]);
  }
  return out;
}

/* Per-kind presentation: icon, accent colour var, and theme weight. */
const KIND = {
  heat:   { icon: "🔥", accent: "var(--k-heat)" },
  cold:   { icon: "❄️", accent: "var(--k-cold)" },
  feels:  { icon: "🥵", accent: "var(--k-feels)" },
  humid:  { icon: "💧", accent: "var(--k-humid)" },
  dry:    { icon: "🏜️", accent: "var(--k-dry)" },
  precip: { icon: "🌧️", accent: "var(--k-precip)" },
  snow:   { icon: "🌨️", accent: "var(--k-snow)" },
  wind:   { icon: "🌀", accent: "var(--k-wind)" },
  clean:  { icon: "🍃", accent: "var(--k-clean)" },
  hazard: { icon: "☣️", accent: "var(--k-hazard)" },
};

const $ = (sel, root = document) => root.querySelector(sel);

/* ---- utilities ---- */
const flagEmoji = (cc) =>
  (cc || "").toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

function coords(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
}

const mapsUrl = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

function relativeTime(iso) {
  const r = L().rel;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(mins)) return "—";
  if (mins < 1) return r.now;
  if (mins < 60) return r.min(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return r.hour(hrs);
  return r.day(Math.round(hrs / 24));
}

function localTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ---- live clock ---- */
function startClock() {
  const el = $("#clock");
  const tick = () => (el.textContent = new Date().toLocaleTimeString());
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   Theme engine — pick the page mood from the data.
   ============================================================ */
function decideTheme(data) {
  const by = (id) => data.records.find((r) => r.id === id);
  const scores = { heat: 0, cold: 0, storm: 0 };

  const hot = by("abs-hot");
  const cold = by("abs-cold");
  const wind = by("wind");
  const precip = by("precip");

  if (hot) scores.heat = Math.max(0, (hot.value - 38) / 17);          // 38..55 °C
  if (cold) scores.cold = Math.max(0, (-cold.value - 40) / 50);       // -40..-90 °C
  if (wind) scores.storm = Math.max(scores.storm, (wind.value - 90) / 130);
  if (precip) scores.storm = Math.max(scores.storm, (precip.value - 40) / 120);

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const theme = winner && winner[1] > 0.15 ? winner[0] : "neutral";
  document.documentElement.setAttribute("data-theme", theme);
  $("#status-mood").textContent = L().moods[theme];

  // Match the mobile browser chrome to the theme.
  const chrome = { heat: "#1c0b07", cold: "#071527", storm: "#130b27", neutral: "#0c1122" };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = chrome[theme];
}

/* ============================================================
   Hero — Thermal Shock Index
   ============================================================ */
function renderHero(data) {
  const delta = imperial() ? data.thermalShock?.deltaF : data.thermalShock?.deltaC;
  $(".hero-unit").textContent = imperial() ? "°F" : "°C";
  if (delta != null) animateNumber($("#shock-delta"), delta, 1);

  const hot = data.records.find((r) => r.id === data.thermalShock?.hotRef);
  const cold = data.records.find((r) => r.id === data.thermalShock?.coldRef);
  const box = $("#hero-endpoints");
  box.innerHTML = "";

  const chip = (rec, cls) => {
    if (!rec) return;
    const el = document.createElement("div");
    el.className = `endpoint ${cls}`;
    el.innerHTML = `<span class="ep-val">${pickD(rec)}</span>
      <span class="ep-place">${flagEmoji(rec.location.cc)} ${rec.location.name}, ${rec.location.country}</span>`;
    box.appendChild(el);
  };
  chip(hot, "hot");
  chip(cold, "cold");
}

/* ============================================================
   Sweet Spot — "where to be right now" feature card
   ============================================================ */
function renderSweetSpot(ss) {
  const host = $("#sweetspot");
  const section = $("#sec-sweet");
  if (!host) return;
  if (!ss) {
    host.innerHTML = "";
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  const top = ss.location;
  const w = ss.ranking && ss.ranking[0];
  const sweetCtx = w
    ? `${L().ctx.feels} ${cToDisp(w.feels)} · AQI ${w.aqi} · ${w.humidity}% ${L().ctx.humidity} · ${w.isDay ? L().ctx.day : L().ctx.night}`
    : localizeContext(ss.context);
  const rows = (ss.ranking || [])
    .slice(1)
    .map(
      (e) =>
        `<li class="rank-row">
           <span class="rank-n">${e.rank}</span>
           <span class="rank-flag">${flagEmoji(e.cc)}</span>
           <span class="rank-name">${e.name}<small>${e.country}</small></span>
           <span class="sweet-meta">${cToDisp(e.feels)} · AQI ${e.aqi}${e.isDay ? "" : " 🌙"}</span>
           <span class="rank-val">${e.display}</span>
         </li>`
    )
    .join("");

  host.innerHTML = `
    <article class="card sweet" style="--card-accent: var(--k-perfect)">
      <span class="card-glow" aria-hidden="true"></span>
      <div class="sweet-main">
        <div class="card-head">
          <span class="card-kind term" tabindex="0" data-tip="${L().tips.comfort}">${L().comfort}</span>
          <span class="card-chip"><span class="card-icon">😎</span></span>
        </div>
        <div class="sweet-score">
          <span class="sweet-num">${ss.display}</span>
          <span class="sweet-den">/100</span>
        </div>
        <div class="sweet-place">
          <span class="card-flag">${flagEmoji(top.cc)}</span>
          <div class="card-place-text">
            <span class="card-place-name">${top.name}</span>
            <span class="card-place-sub">${top.country}</span>
            <a class="card-geo" href="${mapsUrl(top.lat, top.lon)}" target="_blank" rel="noopener noreferrer" title="Open in Google Maps">${coords(top.lat, top.lon)}</a>
          </div>
        </div>
        <div class="card-context">${sweetCtx}</div>
      </div>
      <div class="sweet-side">
        <div class="sweet-side-label">${L().runners}</div>
        <ol class="card-rank sweet-rank">${rows}</ol>
        <div class="card-foot">
          <span class="card-source">${ss.source || "—"}</span>
          <span class="card-time" data-iso="${ss.observedAt}">${relativeTime(ss.observedAt)}</span>
        </div>
      </div>
    </article>`;
}

function animateNumber(el, target, decimals = 0) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = target.toFixed(decimals);
    return;
  }
  const dur = 1100;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = (target * ease(t)).toFixed(decimals);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ============================================================
   Cards
   ============================================================ */
function renderCard(rec, index) {
  const tpl = $("#card-template").content.cloneNode(true);
  const card = $(".card", tpl);
  const meta = KIND[rec.kind] || { icon: "•", accent: "var(--accent)" };

  card.style.setProperty("--card-accent", meta.accent);
  card.style.animationDelay = `${index * 60}ms`;

  const kindEl = $(".card-kind", card);
  kindEl.textContent = L().titles[rec.id] || rec.title;
  if (L().tips[rec.id]) {
    kindEl.classList.add("term");
    kindEl.setAttribute("data-tip", L().tips[rec.id]);
    kindEl.setAttribute("tabindex", "0");
  }
  $(".card-icon", card).textContent = meta.icon;
  $(".card-value", card).textContent = pickD(rec);
  $(".card-context", card).textContent = localizeContext(pickC(rec) || rec.subtitle || "");

  $(".card-flag", card).textContent = flagEmoji(rec.location.cc);
  $(".card-place-name", card).textContent = rec.location.name;
  $(".card-place-sub", card).textContent =
    [rec.location.region, rec.location.country].filter(Boolean).join(" · ");
  const geo = $(".card-geo", card);
  geo.textContent = coords(rec.location.lat, rec.location.lon);
  geo.href = mapsUrl(rec.location.lat, rec.location.lon);
  geo.title = "Open in Google Maps";

  // Top-5 leaderboard: ranks 2-5 (rank 1 is the headline above).
  const list = $(".card-rank", card);
  (rec.ranking || []).slice(1).forEach((e) => {
    const li = document.createElement("li");
    li.className = "rank-row";
    li.innerHTML =
      `<span class="rank-n">${e.rank}</span>` +
      `<span class="rank-flag">${flagEmoji(e.cc)}</span>` +
      `<span class="rank-name">${e.name}<small>${e.country}</small></span>` +
      `<span class="rank-val">${pickD(e)}</span>`;
    list.appendChild(li);
  });
  if (!list.childElementCount) list.remove();

  $(".card-source", card).textContent = rec.source || "—";
  const timeEl = $(".card-time", card);
  timeEl.dataset.iso = rec.observedAt;
  timeEl.textContent = relativeTime(rec.observedAt);

  // Accessible label for the whole card.
  card.setAttribute(
    "aria-label",
    `${rec.title}: ${rec.display} at ${rec.location.name}, ${rec.location.country}`
  );
  return card;
}

function renderGrid(targetId, records) {
  const grid = $(`#${targetId}`);
  grid.innerHTML = "";
  records.forEach((rec, i) => grid.appendChild(renderCard(rec, i)));
}

function render(data) {
  hideTip();
  decideTheme(data);
  renderHero(data);
  renderSweetSpot(data.sweetSpot);
  renderGrid("grid-temperature", data.records.filter((r) => r.group === "temperature"));
  renderGrid("grid-atmosphere", data.records.filter((r) => r.group === "atmosphere"));
  $("#footer-note").textContent = data.isSample
    ? L().sample
    : L().live(localTime(data.generatedAt), data.source);
}

/* ---- static UI chrome (everything not driven by a record) ---- */
function applyStaticI18n() {
  const t = L();
  $(".tagline").textContent = t.tagline;
  $("#sweet-title span").textContent = t.sections.sweet;
  $("#sec-temp span").textContent = t.sections.temp;
  $("#sec-atmo span").textContent = t.sections.atmo;
  const heroLabel = $(".hero-label");
  heroLabel.textContent = t.hero.label;
  heroLabel.setAttribute("data-tip", t.tips.thermal);
  $(".hero-caption").textContent = t.hero.caption;
  $("#updated-label").textContent = t.updated;
  $(".refresh-label").textContent = t.update;
  $("#refresh-btn").setAttribute("aria-label", t.update);
  $("#footer-main").innerHTML = t.footerMain;
  document.documentElement.lang = lang;
  document.querySelectorAll("#lang-switch button").forEach((b) =>
    b.classList.toggle("active", b.dataset.lang === lang)
  );
}

function setLang(next) {
  if (!I18N[next] || next === lang) return;
  lang = next;
  try { localStorage.setItem("ge-lang", lang); } catch {}
  applyStaticI18n();
  if (lastData) render(lastData);
  updateAges();
}

function markUnits() {
  document.querySelectorAll("#unit-switch button").forEach((b) =>
    b.classList.toggle("active", b.dataset.units === units)
  );
}

function setUnits(next) {
  if ((next !== "metric" && next !== "imperial") || next === units) return;
  units = next;
  try { localStorage.setItem("ge-units", units); } catch {}
  markUnits();
  if (lastData) render(lastData);
}

// Refresh all relative-time labels without re-rendering the cards.
function updateAges() {
  if (lastGeneratedAt) $("#data-age").textContent = relativeTime(lastGeneratedAt);
  document.querySelectorAll(".card-time[data-iso]").forEach((el) => {
    el.textContent = relativeTime(el.dataset.iso);
  });
}

function setBanner(show) {
  let banner = $("#load-banner");
  if (show && !banner) {
    banner = document.createElement("div");
    banner.id = "load-banner";
    banner.className = "banner";
    banner.textContent =
      "Couldn't load data/extremes.json. Serve the folder over HTTP (e.g. node scripts/serve.mjs) so the browser can fetch the JSON.";
    $(".shell").insertBefore(banner, $("#hero"));
  } else if (!show && banner) {
    banner.remove();
  }
}

/* ============================================================
   Data loading — auto every REFRESH_MS, or on manual button click.
   Only re-renders when generatedAt actually changes (no flicker).
   ============================================================ */
async function loadData({ manual = false } = {}) {
  const btn = $("#refresh-btn");
  if (manual) btn.classList.add("busy");
  const startedAt = performance.now();
  try {
    // Manual click forces the backend to recompute fresh data first.
    // No-op (404) on static hosting — we just re-read the JSON in that case.
    if (manual) {
      try { await fetch("/api/refresh", { method: "POST", cache: "no-store" }); } catch {}
    }
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lastData = data;

    if (data.generatedAt !== lastGeneratedAt) {
      lastGeneratedAt = data.generatedAt;
      render(data);
    }
    updateAges();
    setBanner(false);
  } catch (err) {
    console.error(err);
    setBanner(true);
  } finally {
    if (manual) {
      // Keep the spinner visible briefly so the click always feels responsive.
      const wait = Math.max(0, 550 - (performance.now() - startedAt));
      setTimeout(() => btn.classList.remove("busy"), wait);
    }
  }
}

/* ============================================================
   Custom tooltip — one floating glass box, positioned in JS so it
   escapes the cards' overflow:hidden. Driven by [data-tip].
   ============================================================ */
function initTooltips() {
  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let current = null;

  const place = (el) => {
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const m = 10;
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - tr.width - m));
    let top = r.top - tr.height - 10, placement = "top";
    if (top < m) { top = r.bottom + 10; placement = "bottom"; }
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.dataset.placement = placement;
    tip.style.setProperty("--arrow-x", `${Math.round(Math.max(14, Math.min(r.left + r.width / 2 - left, tr.width - 14)))}px`);
  };

  const show = (el) => {
    const text = el.getAttribute("data-tip");
    if (!text) return;
    current = el;
    tip.textContent = text;
    tip.classList.add("visible");
    place(el);
  };
  hideTip = () => { current = null; tip.classList.remove("visible"); };

  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (el && el !== current) show(el);
  });
  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (el) show(el);
  });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", () => current && hideTip(), true);
  window.addEventListener("keydown", (e) => e.key === "Escape" && hideTip());
}

function detectLang() {
  try {
    const saved = localStorage.getItem("ge-lang");
    if (saved && I18N[saved]) return saved;
  } catch {}
  const nav = (navigator.language || "en").slice(0, 2);
  return I18N[nav] ? nav : "en";
}

function detectUnits() {
  try {
    const saved = localStorage.getItem("ge-units");
    if (saved === "metric" || saved === "imperial") return saved;
  } catch {}
  // Imperial-leaning locales (US, Liberia, Myanmar)
  return /-(us|lr|mm)$/i.test(navigator.language || "") ? "imperial" : "metric";
}

function boot() {
  initTooltips();
  lang = detectLang();
  units = detectUnits();
  applyStaticI18n();
  markUnits();
  $("#status-mood").textContent = L().moods.loading;
  document.querySelectorAll("#lang-switch button").forEach((b) =>
    b.addEventListener("click", () => setLang(b.dataset.lang))
  );
  document.querySelectorAll("#unit-switch button").forEach((b) =>
    b.addEventListener("click", () => setUnits(b.dataset.units))
  );

  startClock();
  $("#refresh-btn").addEventListener("click", () => loadData({ manual: true }));
  loadData();
  setInterval(() => loadData(), REFRESH_MS);
  setInterval(updateAges, AGE_TICK_MS);

  // Refresh immediately when the tab regains focus after being away.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadData();
  });
}

document.addEventListener("DOMContentLoaded", boot);
