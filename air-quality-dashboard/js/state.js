/**
 * state.js — single source of truth for the dashboard.
 */

export const state = {
  // ---------- loaded from summary.json (available at first paint) ----------
  /** Pre-computed chart data for the unfiltered dataset */
  summary: null,          // full summary.json object

  /** Flat array of {country, avg, n} for all countries — used by V-02 */
  countryStats: [],

  /** Per-country radar averages: { "India": [aqi,pm25,ozone,co,no2], … } */
  radarAll: {},

  /** Sorted list of all country names (for filter UI) */
  countryList: [],

  /** AQI category order */
  aqiOrder: [
    "Good","Moderate","Unhealthy for Sensitive Groups",
    "Unhealthy","Very Unhealthy","Hazardous",
  ],

  // ---------- loaded from cities.json (lazy — after first paint) -----------
  /** Full record array — null until cities.json has finished loading */
  allRecords: null,

  /** Filtered records (subset of allRecords) */
  filtered: [],

  // ---------- active filters -----------------------------------------------
  filters: {
    countries:  [],   // [] = all
    categories: [],   // [] = all
    pollutant:  "aqi",
    aqiMin:     0,
    aqiMax:     500,
  },

  /** Are we currently in "filtered" mode (filters changed from defaults)? */
  get isFiltered() {
    const f = this.filters;
    return f.countries.length > 0 || f.categories.length > 0 ||
           f.aqiMin > 0 || f.aqiMax < 500;
  },

  // ---------- V-08 comparison -----------------------------------------------
  compareCountries: [],
};
