/**
 * main.js — two-phase boot for fast first paint.
 *
 * Phase 1 (fast): fetch summary.json (~115 KB), populate KPIs + all charts,
 *                 hide loading overlay.  User can interact immediately.
 *
 * Phase 2 (background): fetch cities.json (~2.8 MB), populate table,
 *                       enable filter-driven chart re-computation.
 */
import { state }          from "./state.js";
import { applyFilters,
         buildCountryFilter,
         buildCategoryFilter,
         buildPollutantFilter,
         buildSlider,
         resetFilters }   from "./filters.js";
import { computeKPIs }    from "./aggregate.js";
import { initDonut,   updateDonut }       from "./charts/donut.js";
import { initCountriesChart, updateCountriesChart,
         initPollutantChart,  updatePollutantChart } from "./charts/bar.js";
import { initHistogram,  updateHistogram  }          from "./charts/histogram.js";
import { initScatter,    updateScatter    }          from "./charts/scatter.js";
import { initMap,        updateMap        }          from "./charts/map.js";
import { initHeatmap,    updateHeatmap    }          from "./charts/heatmap.js";
import { initRadar,      updateRadar      }          from "./charts/radar.js";

// ---- loading overlay helpers ----
const overlayEl  = document.getElementById("loadingOverlay");
const loadingMsg = document.getElementById("loadingMsg");

function setLoadingMsg(msg) { if (loadingMsg) loadingMsg.textContent = msg; }
function hideOverlay() {
  overlayEl?.classList.add("hidden");
  setTimeout(() => overlayEl?.remove(), 400);
}
function showError(msg) {
  if (overlayEl) overlayEl.innerHTML = `<p style="max-width:400px;text-align:center;color:#f87171">${msg}</p>`;
}

// ---- AQI badge CSS class map ----
const CAT_CLASS = {
  "Good":                           "cat-Good",
  "Moderate":                       "cat-Moderate",
  "Unhealthy for Sensitive Groups": "cat-USG",
  "Unhealthy":                      "cat-Unhealthy",
  "Very Unhealthy":                 "cat-VeryUnhealthy",
  "Hazardous":                      "cat-Hazardous",
};

// ---- KPI renderer ----
function renderKPIs() {
  const k = computeKPIs();
  if (!k) {
    ["kpiCities","kpiCountries","kpiAvg","kpiMedian",
     "kpiGood","kpiUnhealthy","kpiPollutant","kpiWorstCity"]
      .forEach(id => { const el=document.getElementById(id); if(el) el.textContent="—"; });
    return;
  }
  document.getElementById("kpiCities").textContent     = k.cities.toLocaleString();
  document.getElementById("kpiCountries").textContent  = k.countries.toLocaleString();
  document.getElementById("kpiAvg").textContent        = k.avg;
  document.getElementById("kpiMedian").textContent     = k.median;
  document.getElementById("kpiGood").textContent       = k.goodPct + "%";
  document.getElementById("kpiUnhealthy").textContent  = k.unhPct  + "%";
  document.getElementById("kpiPollutant").textContent  = k.dominantPollutant;
  document.getElementById("kpiWorstCity").textContent  = k.worstCity;
}

// ---- table state ----
let tableData    = [];
let tableSortCol = "aqi";
let tableSortAsc = false;
let tablePage    = 1;
const PAGE_SIZE  = 25;
let tableQuery   = "";
let tableReady   = false;   // true once cities.json has loaded

function sortTable() {
  tableData = [...(state.filtered.length ? state.filtered : (state.allRecords || []))];
  const dir = tableSortAsc ? 1 : -1;
  tableData.sort((a,b) => {
    const va=a[tableSortCol], vb=b[tableSortCol];
    if (typeof va==="number") return (va-vb)*dir;
    return String(va).localeCompare(String(vb))*dir;
  });
  if (tableQuery) {
    const q=tableQuery.toLowerCase();
    tableData=tableData.filter(r=>r.city.toLowerCase().includes(q)||r.country.toLowerCase().includes(q));
  }
}

function renderTable() {
  if (!tableReady) {
    document.getElementById("tableBody").innerHTML =
      `<tr><td colspan="8" class="empty-state" style="padding:2rem">⏳ Loading city data in background…</td></tr>`;
    return;
  }
  sortTable();
  tablePage = 1;
  renderPage();
}

function renderPage() {
  const start = (tablePage-1)*PAGE_SIZE;
  const slice = tableData.slice(start, start+PAGE_SIZE);
  const tbody = document.getElementById("tableBody");

  if (tableData.length===0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No cities match the current filters.</td></tr>`;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  tbody.innerHTML = slice.map(r=>`
    <tr>
      <td>${r.country}</td>
      <td>${r.city}</td>
      <td>${r.aqi}</td>
      <td><span class="aqi-badge ${CAT_CLASS[r.aqiCat]??""}">${r.aqiCat}</span></td>
      <td>${r.pm25}</td>
      <td>${r.ozone}</td>
      <td>${r.co}</td>
      <td>${r.no2}</td>
    </tr>`).join("");

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(tableData.length/PAGE_SIZE);
  const pag   = document.getElementById("pagination");
  if (total<=1){ pag.innerHTML=""; return; }

  const pages=[];
  pages.push(`<button class="page-btn" ${tablePage===1?"disabled":""} data-p="${tablePage-1}">‹ Prev</button>`);
  const w=2;
  for(let p=1;p<=total;p++){
    if(p===1||p===total||Math.abs(p-tablePage)<=w)
      pages.push(`<button class="page-btn ${p===tablePage?"active":""}" data-p="${p}">${p}</button>`);
    else if(Math.abs(p-tablePage)===w+1)
      pages.push(`<span style="padding:.3rem .2rem">…</span>`);
  }
  pages.push(`<button class="page-btn" ${tablePage===total?"disabled":""} data-p="${tablePage+1}">Next ›</button>`);
  pag.innerHTML = pages.join("");
}

function initTableSort() {
  document.querySelectorAll("thead th.sortable").forEach(th=>{
    const activate=()=>{
      const col=th.dataset.col;
      if(tableSortCol===col) tableSortAsc=!tableSortAsc;
      else{ tableSortCol=col; tableSortAsc=col==="country"||col==="city"; }
      document.querySelectorAll("thead th").forEach(h=>h.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort",tableSortAsc?"ascending":"descending");
      renderTable();
    };
    th.addEventListener("click",activate);
    th.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); activate(); } });
  });

  document.getElementById("pagination").addEventListener("click",e=>{
    const btn=e.target.closest(".page-btn");
    if(!btn||btn.disabled) return;
    tablePage=+btn.dataset.p;
    renderPage();
  });

  document.getElementById("tableSearch").addEventListener("input",e=>{
    tableQuery=e.target.value.trim();
    renderTable();
  });
}

// ---- PNG download ----
function initDownloads() {
  document.querySelectorAll(".btn-dl").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const canvas=document.getElementById(btn.dataset.chart);
      if(!canvas) return;
      const a=document.createElement("a");
      a.download=`${btn.dataset.chart}.png`;
      a.href=canvas.toDataURL("image/png");
      a.click();
    });
  });
}

// ---- CSV export ----
function initExport() {
  document.getElementById("btnExport").addEventListener("click",()=>{
    if(!tableReady){ alert("City data is still loading, please wait."); return; }
    const header=["country","city","aqi","aqiCat","pm25","ozone","co","no2"];
    const src = state.isFiltered ? state.filtered : (state.allRecords||[]);
    const rows=[header.join(",")];
    for(const r of src)
      rows.push([r.country,`"${r.city}"`,r.aqi,`"${r.aqiCat}"`,r.pm25,r.ozone,r.co,r.no2].join(","));
    const blob=new Blob([rows.join("\n")],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="air_quality_filtered.csv"; a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- theme toggle ----
function initTheme() {
  const btn=document.getElementById("btnTheme");
  const root=document.documentElement;
  btn.addEventListener("click",()=>{
    const isDark=root.getAttribute("data-theme")==="dark";
    root.setAttribute("data-theme",isDark?"light":"dark");
    btn.textContent=isDark?"🌙 Dark":"☀️ Light";
    Chart.defaults.color=isDark?"#1f2328":"#e6edf3";
  });
}

// ---- cross-filter helpers ----
function crossFilterCategory(cat) {
  const chk=document.querySelector(`#filterCategory input[value="${cat}"]`);
  if(!chk) return;
  chk.checked=!chk.checked;
  const all=[...document.querySelectorAll("#filterCategory input")];
  const checked=all.filter(i=>i.checked).map(i=>i.value);
  state.filters.categories=checked.length===state.aqiOrder.length?[]:checked;
  onFilterChange();
}

function crossFilterCountry(country) {
  const idx=state.filters.countries.indexOf(country);
  if(idx===-1) state.filters.countries.push(country);
  else          state.filters.countries.splice(idx,1);
  const tagsEl=document.getElementById("countryTags");
  tagsEl.innerHTML=state.filters.countries.map(c=>
    `<span class="tag">${c}<button class="tag-remove" data-value="${c}" aria-label="Remove ${c}">×</button></span>`
  ).join("");
  onFilterChange();
}

// ---- master update (called on every filter change) ----
function onFilterChange() {
  applyFilters();   // no-op if allRecords not yet loaded
  renderKPIs();
  updateDonut();
  updateCountriesChart();
  updatePollutantChart();
  updateHistogram();
  updateScatter();
  updateMap();
  updateHeatmap();
  if (tableReady) renderTable();
}

// =========================================================================
//  PHASE 1 — load summary.json, paint everything, hide overlay
// =========================================================================
async function phase1() {
  setLoadingMsg("Loading dashboard…");

  let summary;
  try {
    const res = await fetch("data/summary.json");
    if (!res.ok) throw new Error(res.statusText);
    summary = await res.json();
  } catch (e) {
    showError(
      `⚠️ Could not load <code>data/summary.json</code>.<br><br>
       Serve from a local web server:<br>
       <code>py -m http.server 8080</code><br>
       then open <a href="http://localhost:8080" style="color:#60a5fa">http://localhost:8080</a>`
    );
    return false;
  }

  // populate state from pre-computed summary
  state.summary     = summary;
  state.aqiOrder    = summary.aqiOrder;
  state.countryList = summary.countryList;
  state.radarAll    = summary.radarAll;

  // build filter UI (uses state.countryList — no records needed)
  buildCountryFilter(onFilterChange);
  buildCategoryFilter(onFilterChange);
  buildPollutantFilter(onFilterChange);
  buildSlider(onFilterChange);
  document.getElementById("btnReset").addEventListener("click", () => resetFilters(onFilterChange));

  // render KPIs from pre-computed data
  renderKPIs();

  // init all charts — all use pre-computed data, no heavy loops
  Chart.defaults.animation = false;
  initDonut(crossFilterCategory);
  initCountriesChart(crossFilterCountry);
  initPollutantChart();
  initHistogram();
  initScatter();
  initHeatmap();
  initRadar();
  initMap();  // async, non-blocking

  // wire table (shows placeholder until phase 2 completes)
  initTableSort();
  initDownloads();
  initExport();
  initTheme();
  renderTable();  // shows "loading" placeholder

  hideOverlay();
  return true;
}

// =========================================================================
//  PHASE 2 — load cities.json in background, enable table + filtered charts
// =========================================================================
async function phase2() {
  let cities;
  try {
    const res = await fetch("data/cities.json");
    if (!res.ok) throw new Error(res.statusText);
    cities = await res.json();
  } catch {
    document.getElementById("tableBody").innerHTML =
      `<tr><td colspan="8" class="empty-state">⚠️ Could not load city data.</td></tr>`;
    return;
  }

  state.allRecords = cities.records;
  tableReady = true;

  // if filters are already active, apply them now
  if (state.isFiltered) {
    applyFilters();
    renderKPIs();
    updateDonut();
    updateCountriesChart();
    updatePollutantChart();
    updateHistogram();
    updateScatter();
    updateMap();
    updateHeatmap();
  }

  renderTable();
}

// =========================================================================
//  BOOT
// =========================================================================
async function boot() {
  try {
    const ok = await phase1();
    if (ok) phase2();   // fire-and-forget — does not block phase 1 result
  } catch (error) {
    console.error("Dashboard initialization failed:", error);
    showError(
      "⚠️ The dashboard could not be initialized. Check that the data files and chart libraries are available, then refresh the page."
    );
  }
}

boot();
