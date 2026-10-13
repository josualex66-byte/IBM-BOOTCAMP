/**
 * scatter.js — V-05 PM2.5 vs overall AQI
 */
import { computeScatter } from "../aggregate.js";

const CAT_COLOR = {
  "Good":                           "rgba(74,222,128,.5)",
  "Moderate":                       "rgba(250,204,21,.5)",
  "Unhealthy for Sensitive Groups": "rgba(251,146,60,.5)",
  "Unhealthy":                      "rgba(248,113,113,.5)",
  "Very Unhealthy":                 "rgba(168,85,247,.5)",
  "Hazardous":                      "rgba(159,18,57,.7)",
};

let chart = null;

function buildDatasets(pts) {
  const groups = {};
  for (const p of pts) {
    const cat = p.cat || "Unknown";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ x: p.x, y: p.y });
  }
  return Object.entries(groups).map(([cat, data]) => ({
    label: cat,
    data,
    backgroundColor: CAT_COLOR[cat] ?? "rgba(148,163,184,.4)",
    pointRadius: 3,
    pointHoverRadius: 5,
  }));
}

export function initScatter() {
  const ctx  = document.getElementById("chartScatter").getContext("2d");
  const pts  = computeScatter();

  chart = new Chart(ctx, {
    type: "scatter",
    data: { datasets: buildDatasets(pts) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => ` PM2.5 AQI: ${ctx.raw.x}  |  Overall AQI: ${ctx.raw.y}`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "PM2.5 AQI Value", font: { size: 11 } },
          grid:  { color: "rgba(128,128,128,.15)" },
        },
        y: {
          title: { display: true, text: "Overall AQI Value", font: { size: 11 } },
          grid:  { color: "rgba(128,128,128,.15)" },
        },
      },
    },
  });
}

export function updateScatter() {
  if (!chart) return;
  const pts = computeScatter();
  chart.data.datasets = buildDatasets(pts);
  chart.update("active");
}
