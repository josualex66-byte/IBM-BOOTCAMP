/**
 * histogram.js — V-04 AQI value distribution
 */
import { computeHistogram } from "../aggregate.js";
import { state } from "../state.js";

const AQI_BIN_COLOR = (start) => {
  if (start <= 50)  return "#4ade80";
  if (start <= 100) return "#facc15";
  if (start <= 150) return "#fb923c";
  if (start <= 200) return "#f87171";
  if (start <= 300) return "#a855f7";
  return "#9f1239";
};

let chart = null;

export function initHistogram() {
  const ctx  = document.getElementById("chartHistogram").getContext("2d");
  const data = computeHistogram();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: "Cities",
        data:  data.map(d => d.count),
        backgroundColor: data.map((_, i) => AQI_BIN_COLOR(i * 25)),
        borderRadius: 3,
        barPercentage: 0.95,
        categoryPercentage: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()} cities` } },
      },
      scales: {
        y: {
          title: { display: true, text: "Number of cities", font: { size: 11 } },
          grid: { color: "rgba(128,128,128,.15)" },
        },
        x: {
          title: { display: true, text: "AQI Value", font: { size: 11 } },
          ticks: { maxRotation: 45, font: { size: 9 } },
        },
      },
    },
  });
}

export function updateHistogram() {
  if (!chart) return;
  const data = computeHistogram();
  chart.data.labels = data.map(d => d.label);
  chart.data.datasets[0].data = data.map(d => d.count);
  chart.update("active");
}
