/* ============================================================
   Curated candidate stations.

   The brief's core problem: you can't ask a weather API for the
   global maximum. The solution here is a curated shortlist of
   places that are *plausible* record-holders for each metric —
   the world's hot spots, cold poles, monsoon basins, dust bowls,
   pollution hotspots and pristine coasts. The aggregator queries
   all of them in one batched call and keeps the real extreme.

   Add/remove stations freely — the more candidates, the better
   the coverage. `pop` (absolute) gates the "major city" cards.
   ============================================================ */

export const STATIONS = [
  // ---- Heat / desert candidates ----
  { name: "Death Valley", region: "California", country: "United States", cc: "US", lat: 36.46, lon: -116.87, inhabited: false },
  { name: "Kuwait City", region: "Al Asimah", country: "Kuwait", cc: "KW", lat: 29.37, lon: 47.98, pop: 3_000_000 },
  { name: "Basra", region: "Basra", country: "Iraq", cc: "IQ", lat: 30.51, lon: 47.78, pop: 1_400_000 },
  { name: "Baghdad", region: "Baghdad", country: "Iraq", cc: "IQ", lat: 33.32, lon: 44.37, pop: 7_500_000 },
  { name: "Ahvaz", region: "Khuzestan", country: "Iran", cc: "IR", lat: 31.32, lon: 48.67, pop: 1_300_000 },
  { name: "Nawabshah", region: "Sindh", country: "Pakistan", cc: "PK", lat: 26.24, lon: 68.41, pop: 1_100_000 },
  { name: "Jacobabad", region: "Sindh", country: "Pakistan", cc: "PK", lat: 28.28, lon: 68.44 },
  { name: "Turbat", region: "Balochistan", country: "Pakistan", cc: "PK", lat: 26.0, lon: 63.04 },
  { name: "Mecca", region: "Makkah", country: "Saudi Arabia", cc: "SA", lat: 21.43, lon: 39.83, pop: 2_000_000 },
  { name: "Riyadh", region: "Riyadh", country: "Saudi Arabia", cc: "SA", lat: 24.71, lon: 46.68, pop: 7_000_000 },
  { name: "Dubai", region: "Dubai", country: "United Arab Emirates", cc: "AE", lat: 25.2, lon: 55.27, pop: 3_500_000 },
  { name: "Phoenix", region: "Arizona", country: "United States", cc: "US", lat: 33.45, lon: -112.07, pop: 1_650_000 },
  { name: "Mexicali", region: "Baja California", country: "Mexico", cc: "MX", lat: 32.65, lon: -115.47, pop: 1_000_000 },
  { name: "Khartoum", region: "Khartoum", country: "Sudan", cc: "SD", lat: 15.5, lon: 32.56, pop: 5_300_000 },
  { name: "Niamey", region: "Niamey", country: "Niger", cc: "NE", lat: 13.51, lon: 2.11, pop: 1_300_000 },
  { name: "In Salah", region: "Tamanrasset", country: "Algeria", cc: "DZ", lat: 27.19, lon: 2.46 },
  { name: "Adrar", region: "Adrar", country: "Algeria", cc: "DZ", lat: 27.87, lon: -0.29 },
  { name: "Aswan", region: "Aswan", country: "Egypt", cc: "EG", lat: 24.09, lon: 32.9 },
  { name: "Timbuktu", region: "Tombouctou", country: "Mali", cc: "ML", lat: 16.77, lon: -3.01 },
  { name: "Marble Bar", region: "Western Australia", country: "Australia", cc: "AU", lat: -21.18, lon: 119.74 },
  { name: "Birdsville", region: "Queensland", country: "Australia", cc: "AU", lat: -25.9, lon: 139.35 },

  // ---- Cold / polar / high-altitude candidates ----
  // `inhabited: false` = uninhabited points (ice sheets, mountain peaks, research
  // stations, park outposts). The aggregator skips them: only places where people
  // actually live can win a card, and they'd otherwise top the cold/snow forever.
  { name: "Vostok Station", region: "East Antarctic Plateau", country: "Antarctica", cc: "AQ", lat: -78.46, lon: 106.84, inhabited: false },
  { name: "Concordia (Dome C)", region: "Antarctic Plateau", country: "Antarctica", cc: "AQ", lat: -75.1, lon: 123.33, inhabited: false },
  { name: "Amundsen–Scott", region: "South Pole", country: "Antarctica", cc: "AQ", lat: -89.99, lon: 0.0, inhabited: false },
  { name: "Dome Fuji", region: "Queen Maud Land", country: "Antarctica", cc: "AQ", lat: -77.31, lon: 39.7, inhabited: false },
  { name: "Oymyakon", region: "Sakha Republic", country: "Russia", cc: "RU", lat: 63.46, lon: 142.79 },
  { name: "Verkhoyansk", region: "Sakha Republic", country: "Russia", cc: "RU", lat: 67.55, lon: 133.39 },
  { name: "Yakutsk", region: "Sakha Republic", country: "Russia", cc: "RU", lat: 62.03, lon: 129.73, pop: 360_000 },
  { name: "Norilsk", region: "Krasnoyarsk Krai", country: "Russia", cc: "RU", lat: 69.35, lon: 88.2 },
  { name: "Eureka", region: "Nunavut", country: "Canada", cc: "CA", lat: 79.99, lon: -85.94, inhabited: false },
  { name: "Alert", region: "Nunavut", country: "Canada", cc: "CA", lat: 82.5, lon: -62.34, inhabited: false },
  { name: "Summit Camp", region: "Greenland Ice Sheet", country: "Greenland", cc: "GL", lat: 72.58, lon: -38.46, inhabited: false },
  { name: "Ulaanbaatar", region: "Ulaanbaatar", country: "Mongolia", cc: "MN", lat: 47.89, lon: 106.91, pop: 1_600_000 },
  { name: "El Alto", region: "La Paz", country: "Bolivia", cc: "BO", lat: -16.5, lon: -68.16, pop: 900_000 },
  { name: "La Rinconada", region: "Puno", country: "Peru", cc: "PE", lat: -14.63, lon: -69.44 },
  { name: "Ushuaia", region: "Tierra del Fuego", country: "Argentina", cc: "AR", lat: -54.8, lon: -68.3 },
  { name: "Comodoro Rivadavia", region: "Chubut", country: "Argentina", cc: "AR", lat: -45.86, lon: -67.5 },
  { name: "Sarmiento", region: "Chubut", country: "Argentina", cc: "AR", lat: -45.59, lon: -69.07 },
  { name: "Leh", region: "Ladakh", country: "India", cc: "IN", lat: 34.15, lon: 77.58 },
  { name: "Lhasa", region: "Tibet", country: "China", cc: "CN", lat: 29.65, lon: 91.13 },
  { name: "Yellowknife", region: "Northwest Territories", country: "Canada", cc: "CA", lat: 62.45, lon: -114.37 },
  { name: "Queenstown", region: "Otago", country: "New Zealand", cc: "NZ", lat: -45.03, lon: 168.66 },
  { name: "Coyhaique", region: "Aysén", country: "Chile", cc: "CL", lat: -45.57, lon: -72.07 },
  { name: "Anchorage", region: "Alaska", country: "United States", cc: "US", lat: 61.22, lon: -149.9, pop: 290_000 },
  { name: "Murmansk", region: "Murmansk Oblast", country: "Russia", cc: "RU", lat: 68.97, lon: 33.08 },
  { name: "Tromsø", region: "Troms", country: "Norway", cc: "NO", lat: 69.65, lon: 18.96 },

  // ---- Major cities (urban contrast + cold-city candidates) ----
  { name: "Moscow", region: "Moscow", country: "Russia", cc: "RU", lat: 55.75, lon: 37.62, pop: 12_000_000 },
  { name: "Harbin", region: "Heilongjiang", country: "China", cc: "CN", lat: 45.8, lon: 126.53, pop: 10_000_000 },
  { name: "Bogotá", region: "Cundinamarca", country: "Colombia", cc: "CO", lat: 4.71, lon: -74.07, pop: 7_900_000 },
  { name: "La Paz", region: "La Paz", country: "Bolivia", cc: "BO", lat: -16.5, lon: -68.13, pop: 1_900_000 },
  { name: "Quito", region: "Pichincha", country: "Ecuador", cc: "EC", lat: -0.18, lon: -78.47, pop: 1_900_000 },
  { name: "Lima", region: "Lima", country: "Peru", cc: "PE", lat: -12.05, lon: -77.04, pop: 9_700_000 },

  // ---- Humid coastal candidates (high dew point) ----
  { name: "Bandar-e Mahshahr", region: "Khuzestan", country: "Iran", cc: "IR", lat: 30.56, lon: 49.2 },
  { name: "Jask", region: "Hormozgan", country: "Iran", cc: "IR", lat: 25.64, lon: 57.77 },
  { name: "Dammam", region: "Eastern Province", country: "Saudi Arabia", cc: "SA", lat: 26.43, lon: 50.1, pop: 1_500_000 },
  { name: "Mumbai", region: "Maharashtra", country: "India", cc: "IN", lat: 19.08, lon: 72.88, pop: 20_000_000 },
  { name: "Singapore", region: "Singapore", country: "Singapore", cc: "SG", lat: 1.35, lon: 103.82, pop: 5_900_000 },
  { name: "Manila", region: "Metro Manila", country: "Philippines", cc: "PH", lat: 14.6, lon: 120.98, pop: 13_500_000 },
  { name: "Jakarta", region: "Jakarta", country: "Indonesia", cc: "ID", lat: -6.21, lon: 106.85, pop: 10_500_000 },

  // ---- Aridity candidates (lowest humidity) ----
  { name: "Arica", region: "Arica y Parinacota", country: "Chile", cc: "CL", lat: -18.48, lon: -70.32 },
  { name: "Iquique", region: "Tarapacá", country: "Chile", cc: "CL", lat: -20.21, lon: -70.15 },
  { name: "Antofagasta", region: "Antofagasta", country: "Chile", cc: "CL", lat: -23.65, lon: -70.4 },

  // ---- Monsoon / heavy-rain candidates ----
  { name: "Mawsynram", region: "Meghalaya", country: "India", cc: "IN", lat: 25.3, lon: 91.58 },
  { name: "Cherrapunji", region: "Meghalaya", country: "India", cc: "IN", lat: 25.27, lon: 91.73 },
  { name: "Yangon", region: "Yangon", country: "Myanmar", cc: "MM", lat: 16.87, lon: 96.2, pop: 5_200_000 },
  { name: "Padang", region: "West Sumatra", country: "Indonesia", cc: "ID", lat: -0.95, lon: 100.35 },

  // ---- Windy / Southern Ocean candidates ----
  { name: "Cape Grim", region: "Tasmania", country: "Australia", cc: "AU", lat: -40.68, lon: 144.69, inhabited: false },
  { name: "Punta Arenas", region: "Magallanes", country: "Chile", cc: "CL", lat: -53.16, lon: -70.91 },
  { name: "Wellington", region: "Wellington", country: "New Zealand", cc: "NZ", lat: -41.29, lon: 174.78, pop: 420_000 },
  { name: "Reykjavík", region: "Capital Region", country: "Iceland", cc: "IS", lat: 64.15, lon: -21.94 },
  { name: "Hobart", region: "Tasmania", country: "Australia", cc: "AU", lat: -42.88, lon: 147.33 },

  // ---- Alpine / snowpack candidates (deepest snow) ----
  { name: "Sonnblick", region: "Hohe Tauern", country: "Austria", cc: "AT", lat: 47.05, lon: 12.96, inhabited: false },
  { name: "Mount Washington", region: "New Hampshire", country: "United States", cc: "US", lat: 44.27, lon: -71.3, inhabited: false },
  { name: "Portillo", region: "Valparaíso (Andes)", country: "Chile", cc: "CL", lat: -32.83, lon: -70.13, inhabited: false },
  { name: "Bariloche", region: "Río Negro (Andes)", country: "Argentina", cc: "AR", lat: -41.13, lon: -71.41 },
  { name: "Aoraki / Mt Cook", region: "Southern Alps", country: "New Zealand", cc: "NZ", lat: -43.59, lon: 170.14, inhabited: false },

  // ---- Air-quality hotspots (most hazardous) ----
  { name: "Lahore", region: "Punjab", country: "Pakistan", cc: "PK", lat: 31.55, lon: 74.34, pop: 13_000_000 },
  { name: "Delhi", region: "Delhi", country: "India", cc: "IN", lat: 28.61, lon: 77.21, pop: 32_000_000 },
  { name: "Dhaka", region: "Dhaka", country: "Bangladesh", cc: "BD", lat: 23.81, lon: 90.41, pop: 10_000_000 },
  { name: "Beijing", region: "Beijing", country: "China", cc: "CN", lat: 39.9, lon: 116.41, pop: 21_000_000 },
  { name: "Kolkata", region: "West Bengal", country: "India", cc: "IN", lat: 22.57, lon: 88.36, pop: 15_000_000 },
];
