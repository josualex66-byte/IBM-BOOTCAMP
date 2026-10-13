/**
 * bar.js — V-02 top/bottom countries + V-03 pollutant comparison
 */
import { computeTopBottomCountries, computePollutantAvgs } from "../aggregate.js";

const POLLUTANT_COLORS = {
  "PM2.5": "#f87171",
  "Ozone": "#60a5fa",
  "CO":    "#a3e635",
  "NO2":   "#fbbf24",
};

let chartCountries = null;
let chartPollutant = null;

// ---- V-02 ----------------------------------------------------------------

export function initCountriesChart(onCountryClick) {
  const ctx  = document.getElementById("chartCountries").getContext("2d");
  const d    = computeTopBottomCountries();

  const labels  = [...d.top10.map(r => r.country), ...d.bottom10.map(r => r.country)];
  const values  = [...d.top10.map(r => +r.avg.toFixed(1)), ...d.bottom10.map(r => +r.avg.toFixed(1))];
  const colors  = [
    ...d.top10.map(()   => "rgba(248,113,113,.85)"),
    ...d.bottom10.map(() => "rgba(74,222,128,.85)"),
  ];

  chartCountries = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Avg AQI: ${ctx.raw}`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Average AQI", font: { size: 11 } },
          grid: { color: "rgba(128,128,128,.15)" },
        },
        y: { ticks: { font: { size: 11 } } },
      },
      onClick: (_e, els) => {
        if (!els.length) return;
        const country = chartCountries.data.labels[els[0].index];
        onCountryClick(country);
      },
    },
  });
}

export function updateCountriesChart() {
  if (!chartCountries) return;
  const d      = computeTopBottomCountries();
  const labels = [...d.top10.map(r => r.country), ...d.bottom10.map(r => r.country)];
  const values = [...d.top10.map(r => +r.avg.toFixed(1)), ...d.bottom10.map(r => +r.avg.toFixed(1))];
  const colors = [
    ...d.top10.map(()   => "rgba(248,113,113,.85)"),
    ...d.bottom10.map(() => "rgba(74,222,128,.85)"),
  ];
  chartCountries.data.labels = labels;
  chartCountries.data.datasets[0].data            = values;
  chartCountries.data.datasets[0].backgroundColor = colors;
  chartCountries.update("active");
}

// ---- V-03 ----------------------------------------------------------------

export function initPollutantChart() {
  const ctx  = document.getElementById("chartPollutant").getContext("2d");
  const data = computePollutantAvgs();

  chartPollutant = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        label: "Avg AQI",
        data:  data.map(d => d.avg),
        backgroundColor: data.map(d => POLLUTANT_COLORS[d.label] ?? "#94a3b8"),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Avg AQI: ${ctx.raw}` } },
      },
      scales: {
        y: {
          title: { display: true, text: "Average AQI", font: { size: 11 } },
          grid: { color: "rgba(128,128,128,.15)" },
        },
        x: { ticks: { font: { size: 11 } } },
      },
    },
  });
}

export function updatePollutantChart() {
  if (!chartPollutant) return;
  const data = computePollutantAvgs();
  chartPollutant.data.labels = data.map(d => d.label);
  chartPollutant.data.datasets[0].data = data.map(d => d.avg);
  chartPollutant.update("active");
}
