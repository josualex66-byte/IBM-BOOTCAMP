/**
 * aggregate.js
 *
 * Two modes:
 *  - DEFAULT (no active filters): return pre-computed data from state.summary
 *  - FILTERED: compute from state.filtered (single pass per function)
 *
 * Chart modules call these functions; they never need to know which mode
 * they are in.
 */
import { state } from "./state.js";

const POLLUTANTS       = ["co","ozone","no2","pm25"];
const POLL_LABEL       = { aqi:"AQI", co:"CO", ozone:"Ozone", no2:"NO2", pm25:"PM2.5" };
const CORR_FIELDS      = ["aqi","pm25","ozone","co","no2"];
const CORR_LABELS      = ["AQI","PM2.5","Ozone","CO","NO2"];
const MIN_CITIES       = 5;
const SCATTER_MAX      = 3000;

// ---- helpers ---------------------------------------------------------------

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++){
    const dx=xs[i]-mx, dy=ys[i]-my;
    num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy;
  }
  return dx2&&dy2 ? +(num/Math.sqrt(dx2*dy2)).toFixed(2) : 0;
}

// ---- KPIs ------------------------------------------------------------------

export function computeKPIs() {
  if (!state.isFiltered && state.summary) {
    return state.summary.kpis;
  }
  const recs = state.filtered;
  if (!recs.length) return null;

  let sum=0; const vals=[], catCount={}, pollCount={co:0,ozone:0,no2:0,pm25:0};
  let worstAqi=-1, worstCity="";

  for (const r of recs) {
    sum += r.aqi; vals.push(r.aqi);
    catCount[r.aqiCat] = (catCount[r.aqiCat]||0)+1;
    if      (r.pm25===r.aqi)  pollCount.pm25++;
    else if (r.ozone===r.aqi) pollCount.ozone++;
    else if (r.co===r.aqi)    pollCount.co++;
    else if (r.no2===r.aqi)   pollCount.no2++;
    if (r.aqi>worstAqi){ worstAqi=r.aqi; worstCity=`${r.city}, ${r.country}`; }
  }

  vals.sort((a,b)=>a-b);
  const mid=Math.floor(vals.length/2);
  const median = vals.length%2 ? vals[mid] : (vals[mid-1]+vals[mid])/2;

  const n = recs.length;
  const goodPct  = ((catCount["Good"]||0)/n*100).toFixed(1);
  const unhPct   = (((catCount["Unhealthy"]||0)+(catCount["Very Unhealthy"]||0)+(catCount["Hazardous"]||0))/n*100).toFixed(1);
  const domP     = Object.entries(pollCount).sort((a,b)=>b[1]-a[1])[0][0];

  return {
    cities:              n,
    countries:           new Set(recs.map(r=>r.country)).size,
    avg:                 (sum/n).toFixed(1),
    median:              median.toFixed(1),
    goodPct, unhPct,
    dominantPollutant:   POLL_LABEL[domP],
    worstCity:           `${worstCity} (${worstAqi})`,
  };
}

// ---- V-01 doughnut ---------------------------------------------------------

export function computeDonut() {
  if (!state.isFiltered && state.summary) return state.summary.donut;
  const counts = {};
  for (const r of state.filtered) counts[r.aqiCat]=(counts[r.aqiCat]||0)+1;
  return state.aqiOrder.map(cat=>({ label:cat, value:counts[cat]||0 }));
}

// ---- V-02 top/bottom countries ---------------------------------------------

export function computeTopBottomCountries() {
  if (!state.isFiltered && state.summary) {
    return { top10: state.summary.top10, bottom10: state.summary.bottom10 };
  }
  const totals={}, cnts={};
  for (const r of state.filtered) {
    if (r.country==="Unknown") continue;
    totals[r.country]=(totals[r.country]||0)+r.aqi;
    cnts[r.country]=(cnts[r.country]||0)+1;
  }
  const avgs = Object.keys(totals)
    .filter(c=>cnts[c]>=MIN_CITIES)
    .map(c=>({ country:c, avg:totals[c]/cnts[c], n:cnts[c] }))
    .sort((a,b)=>a.avg-b.avg);
  return { top10: avgs.slice(-10).reverse(), bottom10: avgs.slice(0,10) };
}

// ---- V-03 pollutant averages -----------------------------------------------

export function computePollutantAvgs() {
  if (!state.isFiltered && state.summary) return state.summary.pollutantAvgs;
  const sums={co:0,ozone:0,no2:0,pm25:0}, n=state.filtered.length;
  if (!n) return [];
  for (const r of state.filtered) { sums.co+=r.co; sums.ozone+=r.ozone; sums.no2+=r.no2; sums.pm25+=r.pm25; }
  return POLLUTANTS.map(p=>({ label:POLL_LABEL[p], avg:+(sums[p]/n).toFixed(2) }));
}

// ---- V-04 histogram --------------------------------------------------------

export function computeHistogram() {
  if (!state.isFiltered && state.summary) return state.summary.histogram;
  const bins={};
  for (let i=0;i<=500;i+=25) bins[i]=0;
  for (const r of state.filtered) { const b=Math.min(Math.floor(r.aqi/25)*25,500); bins[b]=(bins[b]||0)+1; }
  return Object.entries(bins).map(([s,c])=>({ label:`${s}–${+s+24}`, count:c }));
}

// ---- V-05 scatter ----------------------------------------------------------

export function computeScatter() {
  if (!state.isFiltered && state.summary) return state.summary.scatter;
  const data=state.filtered;
  const step=data.length>SCATTER_MAX ? Math.ceil(data.length/SCATTER_MAX) : 1;
  const pts=[];
  for (let i=0;i<data.length;i+=step) pts.push({ x:data[i].pm25, y:data[i].aqi, cat:data[i].aqiCat });
  return pts;
}

// ---- V-06 choropleth -------------------------------------------------------

export function computeChoropleth() {
  if (!state.isFiltered && state.summary) return state.summary.choropleth;
  const totals={}, cnts={}, isos={};
  for (const r of state.filtered) {
    if (!r.iso3||r.country==="Unknown") continue;
    totals[r.iso3]=(totals[r.iso3]||0)+r.aqi;
    cnts[r.iso3]=(cnts[r.iso3]||0)+1;
    isos[r.iso3]=r.country;
  }
  return Object.keys(totals)
    .filter(iso=>cnts[iso]>=MIN_CITIES)
    .map(iso=>({ iso3:iso, country:isos[iso], avg:totals[iso]/cnts[iso], n:cnts[iso] }));
}

// ---- V-07 correlation heatmap ----------------------------------------------

export function computeCorrelation() {
  if (!state.isFiltered && state.summary) return state.summary.correlation;
  const cols=CORR_FIELDS.map(f=>state.filtered.map(r=>r[f]));
  const cells=[];
  for (let r=0;r<cols.length;r++)
    for (let c=0;c<cols.length;c++)
      cells.push({ x:c, y:r, v:pearson(cols[r],cols[c]) });
  return { cells, labels:CORR_LABELS };
}

// ---- V-08 radar ------------------------------------------------------------

export function computeCountryRadar(countries) {
  // always use pre-computed per-country data regardless of filters
  return countries.map(c => ({
    country: c,
    avgs: state.radarAll[c] || [0,0,0,0,0],
  }));
}
