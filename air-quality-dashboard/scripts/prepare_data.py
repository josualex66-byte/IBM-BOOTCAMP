"""
prepare_data.py
Reads global_air_pollution_dataset.csv, cleans and normalises it, then writes:

  data/summary.json      — pre-aggregated chart data + KPIs  (~115 KB)
  data/cities.json       — slim per-row records for the table (~2.8 MB)

Run from the project root:
    python scripts/prepare_data.py
"""

import json, math, os
import pandas as pd

# ---------------------------------------------------------------------------
# ISO-3 country-code mapping
# ---------------------------------------------------------------------------
ISO3_MAP = {
    "Afghanistan":"AFG","Albania":"ALB","Algeria":"DZA","Argentina":"ARG",
    "Armenia":"ARM","Australia":"AUS","Austria":"AUT","Azerbaijan":"AZE",
    "Bahrain":"BHR","Bangladesh":"BGD","Belarus":"BLR","Belgium":"BEL",
    "Bolivia":"BOL","Bosnia and Herzegovina":"BIH","Brazil":"BRA",
    "Bulgaria":"BGR","Cambodia":"KHM","Cameroon":"CMR","Canada":"CAN",
    "Chile":"CHL","China":"CHN","Colombia":"COL","Congo":"COG",
    "Costa Rica":"CRI","Croatia":"HRV","Cuba":"CUB","Cyprus":"CYP",
    "Czech Republic":"CZE","Czechia":"CZE","Denmark":"DNK",
    "Dominican Republic":"DOM","Ecuador":"ECU","Egypt":"EGY",
    "El Salvador":"SLV","Estonia":"EST","Ethiopia":"ETH","Finland":"FIN",
    "France":"FRA","Georgia":"GEO","Germany":"DEU","Ghana":"GHA",
    "Greece":"GRC","Guatemala":"GTM","Honduras":"HND","Hungary":"HUN",
    "India":"IND","Indonesia":"IDN","Iran":"IRN","Iraq":"IRQ",
    "Ireland":"IRL","Israel":"ISR","Italy":"ITA","Jamaica":"JAM",
    "Japan":"JPN","Jordan":"JOR","Kazakhstan":"KAZ","Kenya":"KEN",
    "Kuwait":"KWT","Kyrgyzstan":"KGZ","Latvia":"LVA","Lebanon":"LBN",
    "Libya":"LBY","Lithuania":"LTU","Luxembourg":"LUX","Malaysia":"MYS",
    "Mexico":"MEX","Moldova":"MDA","Mongolia":"MNG","Morocco":"MAR",
    "Mozambique":"MOZ","Myanmar":"MMR","Nepal":"NPL","Netherlands":"NLD",
    "New Zealand":"NZL","Nicaragua":"NIC","Nigeria":"NGA","Norway":"NOR",
    "Oman":"OMN","Pakistan":"PAK","Panama":"PAN","Paraguay":"PRY",
    "Peru":"PER","Philippines":"PHL","Poland":"POL","Portugal":"PRT",
    "Puerto Rico":"PRI","Qatar":"QAT","Romania":"ROU",
    "Russian Federation":"RUS","Russia":"RUS","Saudi Arabia":"SAU",
    "Senegal":"SEN","Serbia":"SRB","Singapore":"SGP","Slovakia":"SVK",
    "Slovenia":"SVN","South Africa":"ZAF","South Korea":"KOR",
    "Korea, Republic of":"KOR","Spain":"ESP","Sri Lanka":"LKA",
    "Sudan":"SDN","Sweden":"SWE","Switzerland":"CHE","Syria":"SYR",
    "Taiwan":"TWN","Tajikistan":"TJK","Tanzania":"TZA","Thailand":"THA",
    "Tunisia":"TUN","Turkey":"TUR","Turkmenistan":"TKM","Uganda":"UGA",
    "Ukraine":"UKR","United Arab Emirates":"ARE",
    "United Kingdom":"GBR","United States of America":"USA",
    "United States":"USA","Uruguay":"URY","Uzbekistan":"UZB",
    "Venezuela":"VEN","Vietnam":"VNM","Yemen":"YEM","Zambia":"ZMB",
    "Zimbabwe":"ZWE",
}

AQI_ORDER = [
    "Good","Moderate","Unhealthy for Sensitive Groups",
    "Unhealthy","Very Unhealthy","Hazardous",
]
POLLUTANTS = ["co","ozone","no2","pm25"]
CORR_FIELDS = ["aqi","pm25","ozone","co","no2"]
CORR_LABELS = ["AQI","PM2.5","Ozone","CO","NO2"]
MIN_CITIES  = 5
SCATTER_MAX = 3000

# ---------------------------------------------------------------------------

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, "data", "global_air_pollution_dataset.csv")

    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f"Loaded {len(df)} rows")

    # --- cleaning ---
    df = df.dropna(subset=["City"])
    df["Country"] = df["Country"].fillna("Unknown")
    df["AQI Category"] = df["AQI Category"].str.strip()
    df["iso3"] = df["Country"].map(ISO3_MAP).fillna("")

    num_cols = ["AQI Value","CO AQI Value","Ozone AQI Value","NO2 AQI Value","PM2.5 AQI Value"]
    for c in num_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["AQI Value"])

    # short aliases
    df = df.rename(columns={
        "AQI Value":"aqi","CO AQI Value":"co","Ozone AQI Value":"ozone",
        "NO2 AQI Value":"no2","PM2.5 AQI Value":"pm25",
        "AQI Category":"aqiCat","Country":"country","City":"city",
        "CO AQI Category":"coCat","Ozone AQI Category":"ozoneCat",
        "NO2 AQI Category":"no2Cat","PM2.5 AQI Category":"pm25Cat",
    })
    for c in ["aqi","co","ozone","no2","pm25"]:
        df[c] = df[c].fillna(0).astype(int)

    N = len(df)
    print(f"After cleaning: {N} rows")

    # -----------------------------------------------------------------------
    # 1. SUMMARY.JSON — everything the charts need
    # -----------------------------------------------------------------------

    # KPIs (default, no filter)
    vals_sorted = sorted(df["aqi"].tolist())
    mid = len(vals_sorted)//2
    median_aqi = vals_sorted[mid] if len(vals_sorted)%2 else (vals_sorted[mid-1]+vals_sorted[mid])/2
    cat_counts = df["aqiCat"].value_counts().to_dict()
    good_pct   = round((cat_counts.get("Good",0)/N)*100,1)
    unh_pct    = round(((cat_counts.get("Unhealthy",0)+
                         cat_counts.get("Very Unhealthy",0)+
                         cat_counts.get("Hazardous",0))/N)*100,1)

    poll_dom = {"co":0,"ozone":0,"no2":0,"pm25":0}
    unmatched = pd.Series(True, index=df.index)
    for p in POLLUTANTS:
        matches = df[p].eq(df["aqi"]) & unmatched
        poll_dom[p] = int(matches.sum())
        unmatched &= ~matches
    dom_poll = max(poll_dom, key=poll_dom.get)
    poll_label_map = {"co":"CO","ozone":"Ozone","no2":"NO2","pm25":"PM2.5"}

    worst = df.loc[df["aqi"].idxmax()]
    kpis = {
        "cities":       N,
        "countries":    int(df[df["country"]!="Unknown"]["country"].nunique()),
        "avg":          round(df["aqi"].mean(),1),
        "median":       float(median_aqi),
        "goodPct":      good_pct,
        "unhPct":       unh_pct,
        "dominantPollutant": poll_label_map[dom_poll],
        "worstCity":    f"{worst['city']}, {worst['country']} ({worst['aqi']})",
    }

    # V-01 doughnut
    donut = [{"label":cat,"value":int(cat_counts.get(cat,0))} for cat in AQI_ORDER]

    # V-02 top/bottom countries
    grp = df[df["country"]!="Unknown"].groupby("country")["aqi"]
    country_stats = grp.agg(["mean","count"]).reset_index()
    country_stats = country_stats[country_stats["count"]>=MIN_CITIES]
    country_stats = country_stats.sort_values("mean")
    bottom10 = [{"country":r["country"],"avg":round(r["mean"],1),"n":int(r["count"])}
                for _,r in country_stats.head(10).iterrows()]
    top10    = [{"country":r["country"],"avg":round(r["mean"],1),"n":int(r["count"])}
                for _,r in country_stats.tail(10).sort_values("mean",ascending=False).iterrows()]

    # V-03 pollutant averages
    poll_avgs = [{"label":poll_label_map[p],"avg":round(float(df[p].mean()),2)} for p in POLLUTANTS]

    # V-04 histogram (bins of 25)
    bins={}
    for i in range(0,501,25): bins[i]=0
    for v in df["aqi"]:
        b=min((v//25)*25,500)
        bins[b]=bins.get(b,0)+1
    histogram=[{"label":f"{s}–{s+24}","count":bins.get(s,0)} for s in range(0,501,25)]

    # V-05 scatter — sample SCATTER_MAX rows, store only x/y/cat
    step = max(1, math.ceil(N/SCATTER_MAX))
    scatter = (
        df.iloc[::step][["pm25","aqi","aqiCat"]]
        .rename(columns={"pm25":"x","aqi":"y","aqiCat":"cat"})
        .to_dict(orient="records")
    )

    # V-06 choropleth
    geo_grp = df[df["iso3"]!=""].groupby("iso3")
    geo_agg = geo_grp["aqi"].agg(["mean","count","first"]).reset_index()
    # attach country name
    iso_country = df[df["iso3"]!=""].groupby("iso3")["country"].first().to_dict()
    choropleth = [{"iso3":r["iso3"],"country":iso_country.get(r["iso3"],r["iso3"]),
                   "avg":round(r["mean"],1),"n":int(r["count"])}
                  for _,r in geo_agg.iterrows() if r["count"]>=MIN_CITIES]

    # V-07 correlation matrix
    corr_matrix = df[CORR_FIELDS].corr(method="pearson")
    corr_cells=[]
    for ri,rf in enumerate(CORR_FIELDS):
        for ci,cf in enumerate(CORR_FIELDS):
            value = corr_matrix.loc[rf,cf]
            corr_cells.append({"x":ci,"y":ri,"v":round(float(value),4) if pd.notna(value) else 0.0})

    # V-08 radar — pre-compute per-country averages for ALL countries (for the picker)
    radar_all = {}
    for c, grp_df in df[df["country"]!="Unknown"].groupby("country"):
        radar_all[c] = [round(float(grp_df[f].mean()),1) for f in ["aqi","pm25","ozone","co","no2"]]

    # country list for filter UI
    country_list = sorted(df[df["country"]!="Unknown"]["country"].unique().tolist())

    summary = {
        "generated":   pd.Timestamp.now().isoformat(timespec="seconds"),
        "totalRows":   N,
        "aqiOrder":    AQI_ORDER,
        "countryList": country_list,
        "kpis":        kpis,
        "donut":       donut,
        "top10":       top10,
        "bottom10":    bottom10,
        "pollutantAvgs": poll_avgs,
        "histogram":   histogram,
        "scatter":     scatter,
        "choropleth":  choropleth,
        "correlation": {"cells":corr_cells,"labels":CORR_LABELS},
        "radarAll":    radar_all,
    }

    summary_path = os.path.join(base_dir, "data", "summary.json")
    with open(summary_path,"w",encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, separators=(",",":"))
    sz = os.path.getsize(summary_path)/1024
    print(f"Written summary.json  ({sz:.0f} KB)")

    # -----------------------------------------------------------------------
    # 2. CITIES.JSON — slim per-row records for the table + filter engine
    # -----------------------------------------------------------------------
    records = df[
        ["country","city","iso3","aqi","aqiCat","co","ozone","no2","pm25"]
    ].to_dict(orient="records")

    cities_path = os.path.join(base_dir, "data", "cities.json")
    with open(cities_path,"w",encoding="utf-8") as f:
        json.dump({"records":records}, f, ensure_ascii=False, separators=(",",":"))
    sz2 = os.path.getsize(cities_path)/1024
    print(f"Written cities.json   ({sz2:.0f} KB, {len(records)} records)")

if __name__ == "__main__":
    main()
