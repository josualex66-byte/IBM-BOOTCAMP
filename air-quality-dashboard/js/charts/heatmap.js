/**
 * heatmap.js — V-07 correlation matrix (chartjs-chart-matrix)
 */
import { computeCorrelation } from "../aggregate.js";

let chart = null;

function corrColor(v) {
  // red (neg) → white (0) → blue (pos)
  if (v >= 0) {
    const a = Math.min(v, 1);
    return `rgba(59,130,212,${a.toFixed(2)})`;
  }
  const a = Math.min(-v, 1);
  return `rgba(248,113,113,${a.toFixed(2)})`;
}

export function initHeatmap() {
  const ctx = document.getElementById("chartHeatmap").getContext("2d");
  const { cells, labels } = computeCorrelation();

  chart = new Chart(ctx, {
    type: "matrix",
    data: {
      datasets: [{
        label: "Pearson r",
        data:  cells,
        backgroundColor: d => corrColor(d.raw.v),
        borderColor:     "transparent",
        borderWidth:     2,
        width:  ({ chart }) => (chart.chartArea?.width  || 250) / labels.length - 2,
        height: ({ chart }) => (chart.chartArea?.height || 250) / labels.length - 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => "",
            label: ctx => {
              const { x, y, v } = ctx.raw;
              return ` ${labels[y]} × ${labels[x]}: ${v}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "category",
          labels,
          offset: true,
          ticks: { font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          type: "category",
          labels,
          offset: true,
          reverse: true,
          ticks: { font: { size: 10 } },
          grid: { display: false },
        },
      },
    },
    plugins: [{
      // draw correlation value text inside each cell
      id: "matrixLabels",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const ds = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        meta.data.forEach((el, i) => {
          const v = ds.data[i].v;
          ctx.fillStyle = Math.abs(v) > 0.5 ? "#fff" : "#1f2328";
          ctx.fillText(v.toFixed(2), el.x, el.y);
        });
        ctx.restore();
      },
    }],
  });
}

export function updateHeatmap() {
  if (!chart) return;
  const { cells } = computeCorrelation();
  chart.data.datasets[0].data = cells;
  chart.update("active");
}
