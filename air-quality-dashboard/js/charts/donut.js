/**
 * donut.js — V-01 AQI category doughnut chart
 */
import { computeDonut } from "../aggregate.js";

const AQI_COLORS = {
  "Good":                           "#4ade80",
  "Moderate":                       "#facc15",
  "Unhealthy for Sensitive Groups": "#fb923c",
  "Unhealthy":                      "#f87171",
  "Very Unhealthy":                 "#a855f7",
  "Hazardous":                      "#9f1239",
};

let chart = null;

export function initDonut(onCategoryClick) {
  const ctx = document.getElementById("chartDonut").getContext("2d");
  const data = computeDonut();

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data:            data.map(d => d.value),
        backgroundColor: data.map(d => AQI_COLORS[d.label] ?? "#ccc"),
        borderWidth:     2,
        borderColor:     "transparent",
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 11 }, padding: 12, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.raw.toLocaleString()} cities (${pct}%)`;
            },
          },
        },
      },
      onClick: (_e, elements) => {
        if (!elements.length) return;
        const label = chart.data.labels[elements[0].index];
        onCategoryClick(label);
      },
    },
  });
}

export function updateDonut() {
  if (!chart) return;
  const data = computeDonut();
  chart.data.datasets[0].data   = data.map(d => d.value);
  chart.data.labels              = data.map(d => d.label);
  chart.update("active");
}
