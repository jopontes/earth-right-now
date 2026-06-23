/* ============================================================
   Pleasant-place candidates + the comfort score.

   Counterpoint to the extremes: where would you actually *want*
   to be right now? Scored from live weather + air quality.
   Used by both scripts/perfect.mjs (CLI) and the aggregator.
   ============================================================ */

export const PLEASANT = [
  // Eternal-spring highlands (mild year-round)
  { name: "Medellín", country: "Colombia", cc: "CO", lat: 6.24, lon: -75.58 },
  { name: "Quito", country: "Ecuador", cc: "EC", lat: -0.18, lon: -78.47 },
  { name: "Cuenca", country: "Ecuador", cc: "EC", lat: -2.9, lon: -79.0 },
  { name: "Nairobi", country: "Kenya", cc: "KE", lat: -1.29, lon: 36.82 },
  { name: "Kunming", country: "China", cc: "CN", lat: 25.04, lon: 102.71 },
  { name: "Mexico City", country: "Mexico", cc: "MX", lat: 19.43, lon: -99.13 },
  { name: "Guadalajara", country: "Mexico", cc: "MX", lat: 20.67, lon: -103.35 },
  { name: "San José", country: "Costa Rica", cc: "CR", lat: 9.93, lon: -84.08 },
  { name: "Guatemala City", country: "Guatemala", cc: "GT", lat: 14.63, lon: -90.51 },
  { name: "Addis Ababa", country: "Ethiopia", cc: "ET", lat: 9.03, lon: 38.74 },
  { name: "Bengaluru", country: "India", cc: "IN", lat: 12.97, lon: 77.59 },
  { name: "Da Lat", country: "Vietnam", cc: "VN", lat: 11.94, lon: 108.46 },
  { name: "Antananarivo", country: "Madagascar", cc: "MG", lat: -18.88, lon: 47.51 },
  { name: "Windhoek", country: "Namibia", cc: "NA", lat: -22.56, lon: 17.08 },
  { name: "Johannesburg", country: "South Africa", cc: "ZA", lat: -26.2, lon: 28.05 },

  // Mediterranean / mild coasts
  { name: "San Diego", country: "United States", cc: "US", lat: 32.72, lon: -117.16 },
  { name: "Santa Barbara", country: "United States", cc: "US", lat: 34.42, lon: -119.7 },
  { name: "San Francisco", country: "United States", cc: "US", lat: 37.77, lon: -122.42 },
  { name: "Honolulu", country: "United States", cc: "US", lat: 21.31, lon: -157.86 },
  { name: "Lisbon", country: "Portugal", cc: "PT", lat: 38.72, lon: -9.14 },
  { name: "Funchal", country: "Portugal", cc: "PT", lat: 32.65, lon: -16.91 },
  { name: "Las Palmas", country: "Spain", cc: "ES", lat: 28.12, lon: -15.43 },
  { name: "Barcelona", country: "Spain", cc: "ES", lat: 41.39, lon: 2.17 },
  { name: "Nice", country: "France", cc: "FR", lat: 43.7, lon: 7.27 },
  { name: "Rome", country: "Italy", cc: "IT", lat: 41.9, lon: 12.5 },
  { name: "Cape Town", country: "South Africa", cc: "ZA", lat: -33.92, lon: 18.42 },
  { name: "Sydney", country: "Australia", cc: "AU", lat: -33.87, lon: 151.21 },
  { name: "Brisbane", country: "Australia", cc: "AU", lat: -27.47, lon: 153.03 },
  { name: "Perth", country: "Australia", cc: "AU", lat: -31.95, lon: 115.86 },
  { name: "Auckland", country: "New Zealand", cc: "NZ", lat: -36.85, lon: 174.76 },
  { name: "Buenos Aires", country: "Argentina", cc: "AR", lat: -34.6, lon: -58.38 },
  { name: "Santiago", country: "Chile", cc: "CL", lat: -33.45, lon: -70.67 },
  { name: "Montevideo", country: "Uruguay", cc: "UY", lat: -34.9, lon: -56.16 },

  // Temperate (NH summer, mild now)
  { name: "Vancouver", country: "Canada", cc: "CA", lat: 49.28, lon: -123.12 },
  { name: "Victoria", country: "Canada", cc: "CA", lat: 48.43, lon: -123.37 },
  { name: "Seattle", country: "United States", cc: "US", lat: 47.61, lon: -122.33 },
  { name: "Portland", country: "United States", cc: "US", lat: 45.52, lon: -122.68 },
  { name: "Denver", country: "United States", cc: "US", lat: 39.74, lon: -104.99 },
  { name: "Munich", country: "Germany", cc: "DE", lat: 48.14, lon: 11.58 },
  { name: "Zurich", country: "Switzerland", cc: "CH", lat: 47.37, lon: 8.54 },
  { name: "Vienna", country: "Austria", cc: "AT", lat: 48.21, lon: 16.37 },
  { name: "Ljubljana", country: "Slovenia", cc: "SI", lat: 46.05, lon: 14.51 },
  { name: "Paris", country: "France", cc: "FR", lat: 48.85, lon: 2.35 },
  { name: "Copenhagen", country: "Denmark", cc: "DK", lat: 55.68, lon: 12.57 },
  { name: "Edinburgh", country: "United Kingdom", cc: "GB", lat: 55.95, lon: -3.19 },
  { name: "Tbilisi", country: "Georgia", cc: "GE", lat: 41.72, lon: 44.79 },
];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const gauss = (x, mu, sigma) => Math.exp(-(((x - mu) / sigma) ** 2));

// `c` = Open-Meteo current block; returns total 0..100 + sub-scores.
export function scoreComfort(c, aqi) {
  const sTemp = gauss(c.apparent_temperature, 22, 8);          // peak 22 °C
  const sHum = gauss(c.relative_humidity_2m, 45, 22);          // peak ~45 %
  const sAir = clamp(1 - (aqi - 15) / 135);                    // 15→1, 150→0
  const sWind = clamp(1 - Math.max(0, c.wind_gusts_10m - 20) / 45);
  const sDry = c.precipitation > 0 ? clamp(1 - c.precipitation / 2) : 1;
  const sDay = c.is_day ? 1 : 0.45;

  const total =
    0.35 * sTemp + 0.25 * sAir + 0.15 * sHum + 0.1 * sWind + 0.1 * sDry + 0.05 * sDay;
  return { total: Math.round(total * 1000) / 10, sTemp, sAir, sHum, sWind, sDry, sDay };
}

export const COMFORT_FIELDS =
  "temperature_2m,apparent_temperature,relative_humidity_2m,wind_gusts_10m,precipitation,is_day";
