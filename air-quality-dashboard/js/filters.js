/**
 * filters.js — builds filter UI and computes state.filtered.
 */
import { state } from "./state.js";

const AQI_ORDER = [
  "Good", "Moderate", "Unhealthy for Sensitive Groups",
  "Unhealthy", "Very Unhealthy", "Hazardous",
];

// ---------- helpers ----------

function getField(r) {
  return r[state.filters.pollutant] ?? r.aqi;
}

/** Apply all active filters and write to state.filtered */
export function applyFilters() {
  if (!state.allRecords) { state.filtered = []; return; }
  const { countries, categories, aqiMin, aqiMax } = state.filters;
  const countrySet = new Set(countries);
  const categorySet = new Set(categories);

  state.filtered = state.allRecords.filter(r => {
    if (countrySet.size  && !countrySet.has(r.country)) return false;
    if (categorySet.size && !categorySet.has(r.aqiCat)) return false;
    const v = getField(r);
    if (v < aqiMin || v > aqiMax) return false;
    return true;
  });
}

// ---------- country multi-select ----------

let allCountries = [];

export function buildCountryFilter(onChange) {
  // use pre-built list from summary.json — no need to scan allRecords
  allCountries = state.countryList;

  const searchEl   = document.getElementById("filterCountrySearch");
  const dropEl     = document.getElementById("countryDropdown");
  const tagsEl     = document.getElementById("countryTags");

  function renderDropdown(query) {
    const q = query.toLowerCase();
    const items = allCountries.filter(c => c.toLowerCase().includes(q));
    dropEl.innerHTML = items.map(c => {
      const sel = state.filters.countries.includes(c);
      return `<div class="multiselect-option" role="option" aria-selected="${sel}" data-value="${c}">${c}</div>`;
    }).join("");
    dropEl.classList.toggle("open", items.length > 0 && document.activeElement === searchEl);
  }

  function renderTags() {
    tagsEl.innerHTML = state.filters.countries.map(c =>
      `<span class="tag">${c}<button class="tag-remove" data-value="${c}" aria-label="Remove ${c}">×</button></span>`
    ).join("");
  }

  searchEl.addEventListener("focus",  () => renderDropdown(searchEl.value));
  searchEl.addEventListener("input",  () => renderDropdown(searchEl.value));
  document.addEventListener("click", e => {
    if (!e.target.closest(".multiselect-wrapper")) dropEl.classList.remove("open");
  });

  dropEl.addEventListener("click", e => {
    const opt = e.target.closest(".multiselect-option");
    if (!opt) return;
    const val = opt.dataset.value;
    const idx = state.filters.countries.indexOf(val);
    if (idx === -1) state.filters.countries.push(val);
    else            state.filters.countries.splice(idx, 1);
    renderDropdown(searchEl.value);
    renderTags();
    onChange();
  });

  tagsEl.addEventListener("click", e => {
    const btn = e.target.closest(".tag-remove");
    if (!btn) return;
    state.filters.countries = state.filters.countries.filter(c => c !== btn.dataset.value);
    renderTags();
    renderDropdown(searchEl.value);
    onChange();
  });
}

// ---------- category checkboxes ----------

export function buildCategoryFilter(onChange) {
  const container = document.getElementById("filterCategory");
  container.innerHTML = AQI_ORDER.map(cat => {
    const id = `chk-${cat.replace(/\s+/g, "-")}`;
    return `
      <label for="${id}">
        <input type="checkbox" id="${id}" value="${cat}" checked />
        ${cat.replace("Unhealthy for Sensitive Groups", "Sensitive")}
      </label>`;
  }).join("");

  container.addEventListener("change", () => {
    const checked = [...container.querySelectorAll("input:checked")].map(i => i.value);
    // if all checked, treat as "no filter"
    state.filters.categories = checked.length === AQI_ORDER.length ? [] : checked;
    onChange();
  });
}

// ---------- pollutant select ----------

export function buildPollutantFilter(onChange) {
  const sel = document.getElementById("filterPollutant");
  sel.addEventListener("change", () => {
    state.filters.pollutant = sel.value;
    onChange();
  });
}

// ---------- AQI range slider ----------

export function buildSlider(onChange) {
  const minEl  = document.getElementById("sliderMin");
  const maxEl  = document.getElementById("sliderMax");
  const dispEl = document.getElementById("sliderDisplay");

  function update() {
    let lo = +minEl.value, hi = +maxEl.value;
    if (lo > hi) { [lo, hi] = [hi, lo]; }
    dispEl.textContent = `${lo} – ${hi}`;
    state.filters.aqiMin = lo;
    state.filters.aqiMax = hi;
    onChange();
  }

  let timer;
  function debounced() {
    clearTimeout(timer);
    timer = setTimeout(update, 80);
  }

  minEl.addEventListener("input", debounced);
  maxEl.addEventListener("input", debounced);
}

// ---------- reset ----------

export function resetFilters(onChange) {
  state.filters.countries  = [];
  state.filters.categories = [];
  state.filters.pollutant  = "aqi";
  state.filters.aqiMin     = 0;
  state.filters.aqiMax     = 500;

  // reset DOM
  document.getElementById("filterCountrySearch").value = "";
  document.getElementById("countryTags").innerHTML = "";
  document.getElementById("countryDropdown").classList.remove("open");
  document.getElementById("filterPollutant").value = "aqi";
  document.getElementById("sliderMin").value  = 0;
  document.getElementById("sliderMax").value  = 500;
  document.getElementById("sliderDisplay").textContent = "0 – 500";
  document.querySelectorAll("#filterCategory input").forEach(i => i.checked = true);

  onChange();
}
