# `extremes.json` — schema

One static file, published hourly by `scripts/aggregate.mjs`, read by the
front-end. This is the contract between backend and UI.

## Top level

| field          | type            | notes |
|----------------|-----------------|-------|
| `generatedAt`  | ISO 8601 string | when the aggregator ran |
| `source`       | string          | human label for the upstream sources |
| `isSample`     | boolean         | `true` shows the "sample data" footer notice |
| `thermalShock` | object          | derived hero stat (see below) |
| `sweetSpot`    | object \| null  | "Where to be right now" — comfiest place + Top-5 (see below) |
| `records`      | `Record[]`      | one entry per dashboard card |

### `thermalShock`

| field      | type   | notes |
|------------|--------|-------|
| `deltaC`   | number | `abs-hot.value − abs-cold.value`, °C |
| `hotRef`   | string | record `id` of the hot endpoint (`"abs-hot"`) |
| `coldRef`  | string | record `id` of the cold endpoint (`"abs-cold"`) |

### `sweetSpot`

The feel-good counterpoint to the extremes — a live **comfort index** over a
curated list of pleasant places (`scripts/pleasant.mjs`).

| field        | type     | notes |
|--------------|----------|-------|
| `display`    | string   | winner's score, e.g. `"95"` (0–100) |
| `score`      | number   | winner's comfort score |
| `context`    | string   | `"Feels 20°C · AQI 23 · 47% humidity · daytime"` |
| `location`   | object   | the winning place (same shape as `Record.location`) |
| `observedAt` | ISO 8601 | run time |
| `source`     | string   | attribution |
| `ranking`    | array    | Top-5: `{rank, name, country, cc, score, display, feels, aqi, humidity, isDay}` |

Score weights (tunable in `scripts/pleasant.mjs`): feels-like 35%, air quality
25%, humidity 15%, wind 10%, dryness 10%, daytime 5%.

## `Record`

| field        | type   | notes |
|--------------|--------|-------|
| `id`         | string | stable slot id (see list below) |
| `group`      | enum   | `"temperature"` \| `"atmosphere"` — which section it renders in |
| `kind`       | enum   | `heat` `cold` `humid` `dry` `precip` `wind` `clean` `hazard` — drives icon + accent + theme weight |
| `title`      | string | card heading, e.g. "Hottest Major City" |
| `subtitle`   | string | one-line description |
| `value`      | number | raw numeric value (used by the theme engine & animations) |
| `unit`       | string | `"°C"`, `"%"`, `"mm"`, `"km/h"`, `"m"`, `"AQI"` (metric base) |
| `display`    | string | pre-formatted **metric** value, e.g. `"48.0°C"` |
| `displayImp` | string | pre-formatted **imperial** value, e.g. `"118.4°F"` (front-end picks by toggle) |
| `context`    | string | secondary line (metric), e.g. `"Pop. 7.5M"`, `"Dew point"` |
| `contextImp` | string | secondary line (imperial); same labels, imperial values |
| `location`   | object | the #1 place (see below) |
| `observedAt` | ISO 8601 | when the measurement was taken |
| `source`     | string | attribution shown in the card footer |
| `ranking`    | `RankEntry[]` | Top-5 leaderboard; `ranking[0]` is the headline above |

### `RankEntry`

| field     | type   | notes |
|-----------|--------|-------|
| `rank`    | number | 1–5 |
| `name`    | string | place name |
| `region`  | string | state / province / sea area |
| `country` | string | full country name |
| `cc`      | string | ISO 3166-1 alpha-2 (flag) |
| `value`   | number | raw value (for sorting) |
| `display` | string | pre-formatted value, e.g. `"40.3°C"` |
| `context` | string | optional secondary label (e.g. population for city cards) |

> **Permanent stations:** entries flagged `permanent: true` in `scripts/stations.mjs`
> (Antarctic plateau, Greenland ice sheet) are excluded from every card — they
> would otherwise win the cold & snow records forever. Only dynamic places compete.

### `location`

| field     | type   | notes |
|-----------|--------|-------|
| `name`    | string | station / city name |
| `region`  | string | state / province / sea area |
| `country` | string | full country name |
| `cc`      | string | ISO 3166-1 alpha-2 — rendered as a flag emoji |
| `lat`     | number | marker latitude |
| `lon`     | number | marker longitude |

## Record ids (the 12 cards)

`abs-hot`, `abs-cold`, `city-hot`, `city-cold`, `anomaly-hot`, `anomaly-cold`
(group `temperature`) · `humid-high`, `humid-low`, `precip`, `wind`,
`aqi-clean`, `aqi-dirty` (group `atmosphere`).

Missing records degrade gracefully — the UI only renders what's present.
