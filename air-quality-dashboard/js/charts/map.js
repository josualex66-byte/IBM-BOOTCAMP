/**
 * map.js — V-06 choropleth world map (chartjs-chart-geo)
 * TopoJSON world atlas loaded from CDN.
 */
import { computeChoropleth } from "../aggregate.js";

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

let chart = null;
let geoFeatures = null;

function aqiColor(v) {
  if (v <= 50)  return "#4ade80";
  if (v <= 100) return "#facc15";
  if (v <= 150) return "#fb923c";
  if (v <= 200) return "#f87171";
  if (v <= 300) return "#a855f7";
  return "#9f1239";
}

function buildData(features, choroData) {
  const byIso = {};
  for (const d of choroData) byIso[d.iso3] = d;

  return features.map(f => {
    const iso3 = f.properties.iso_a3 || f.id;
    const d    = byIso[iso3];
    return {
      feature: f,
      value:   d ? +d.avg.toFixed(1) : null,
      country: d ? d.country : f.properties.name || iso3,
      n:       d ? d.n : 0,
    };
  });
}

export async function initMap() {
  const canvas = document.getElementById("chartMap");

  try {
    const topo  = await fetch(TOPO_URL).then(r => r.json());
    geoFeatures = ChartGeo.topojson.feature(topo, topo.objects.countries).features;
  } catch {
    canvas.parentElement.innerHTML = '<p class="empty-state">Map unavailable — check internet connection.</p>';
    return;
  }

  const choro = computeChoropleth();
  const data  = buildData(geoFeatures, choro);

  const ctx = canvas.getContext("2d");
  chart = new Chart(ctx, {
    type: "choropleth",
    data: {
      labels:   data.map(d => d.country),
      datasets: [{
        label: "Avg AQI",
        data,
        backgroundColor: d => d.value == null ? "#d1d5db" : aqiColor(d.value),
        borderColor: "rgba(255,255,255,.3)",
        borderWidth: 0.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      showOutline: true,
      showGraticule: false,
      scales: {
        projection: { axis: "x", projection: "naturalEarth1" },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return d.value != null
                ? ` ${d.country}: avg AQI ${d.value} (${d.n} cities)`
                : ` ${d.country}: < 5 cities (excluded)`;
            },
          },
        },
      },
    },
  });
}

export function updateMap() {
  if (!chart || !geoFeatures) return;
  const choro = computeChoropleth();
  const data  = buildData(geoFeatures, choro);
  chart.data.datasets[0].data            = data;
  chart.data.datasets[0].backgroundColor = d => d.value == null ? "#d1d5db" : aqiColor(d.value);
  chart.update("active");
}
