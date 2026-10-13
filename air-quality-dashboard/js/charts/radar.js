/**
 * radar.js — V-08 country comparison radar (up to 3 countries)
 */
import { computeCountryRadar } from "../aggregate.js";
import { state } from "../state.js";

const RADAR_LABELS = ["AQI", "PM2.5", "Ozone", "CO", "NO2"];
const PALETTE = ["#3b82d4", "#f87171", "#4ade80"];

let chart = null;

function buildDatasets(radarData) {
  return radarData.map((d, i) => ({
    label: d.country,
    data:  d.avgs,
    borderColor:       PALETTE[i] ?? "#ccc",
    backgroundColor:   (PALETTE[i] ?? "#ccc").replace(")", ",.15)").replace("rgb", "rgba"),
    pointBackgroundColor: PALETTE[i] ?? "#ccc",
    borderWidth: 2,
    fill: true,
  }));
}

export function initRadar() {
  const ctx = document.getElementById("chartRadar").getContext("2d");

  chart = new Chart(ctx, {
    type: "radar",
    data: {
      labels:   RADAR_LABELS,
      datasets: [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks:   { font: { size: 9 }, stepSize: 50 },
          grid:    { color: "rgba(128,128,128,.2)" },
          pointLabels: { font: { size: 11 } },
        },
      },
    },
  });

  buildCompareUI();
}

export function updateRadar() {
  if (!chart) return;
  const data = computeCountryRadar(state.compareCountries);
  chart.data.datasets = buildDatasets(data);
  chart.update("active");
}

// ---------- comparison country picker ----------

function buildCompareUI() {
  const allCountries = state.countryList.filter(c => c !== "Unknown");

  const searchEl = document.getElementById("compareSearch");
  const dropEl   = document.getElementById("compareDropdown");
  const tagsEl   = document.getElementById("compareTags");

  function renderDrop(q) {
    const lower = q.toLowerCase();
    const items = allCountries
      .filter(c => c.toLowerCase().includes(lower) && !state.compareCountries.includes(c))
      .slice(0, 20);
    dropEl.innerHTML = items.map(c =>
      `<div class="multiselect-option" data-value="${c}">${c}</div>`
    ).join("");
    dropEl.classList.toggle("open", items.length > 0 && q.length > 0);
  }

  function renderTags() {
    tagsEl.innerHTML = state.compareCountries.map((c, i) =>
      `<span class="tag" style="border-left:3px solid ${PALETTE[i]}">${c}<button class="tag-remove" data-value="${c}" aria-label="Remove ${c}">×</button></span>`
    ).join("");
  }

  searchEl.addEventListener("focus", () => renderDrop(searchEl.value));
  searchEl.addEventListener("input", () => renderDrop(searchEl.value));
  document.addEventListener("click", e => {
    if (!e.target.closest(".compare-controls")) dropEl.classList.remove("open");
  });

  dropEl.addEventListener("click", e => {
    const opt = e.target.closest(".multiselect-option");
    if (!opt) return;
    if (state.compareCountries.length >= 3) return;
    state.compareCountries.push(opt.dataset.value);
    searchEl.value = "";
    renderDrop("");
    renderTags();
    updateRadar();
  });

  tagsEl.addEventListener("click", e => {
    const btn = e.target.closest(".tag-remove");
    if (!btn) return;
    state.compareCountries = state.compareCountries.filter(c => c !== btn.dataset.value);
    renderTags();
    renderDrop(searchEl.value);
    updateRadar();
  });
}
