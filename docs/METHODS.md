# Methods: harmonized fire activity calendar for India

**In one sentence:** we count *fire cell-days* (an H3 grid cell of about 5 km² with at least one satellite fire detection on a given day) instead of raw hotspots. We then scale the MODIS years (2000–2011) to VIIRS units with factors fitted where both sensors overlap (2012–2025), so 25 years read as one consistent series.

## 1. Data

All data is the NASA FIRMS active-fire record for India ([FIRMS](https://www.earthdata.nasa.gov/data/tools/firms)). It was downloaded as FIRMS yearly country files (`firms.modaps.eosdis.nasa.gov/data/country/`), with the FIRMS API for 2026.

| Sensor | Product | Pixel | Overpass (local) | Used for |
|---|---|---|---|---|
| Terra MODIS | MCD14ML, Collection 6.1 (FIRMS version strings 6.2 / 6.03 / 61.03) | 1 km | 10:30 / 22:30 | Nov 2000 – Jun 2002 |
| Aqua MODIS | MCD14ML, Collection 6.1 | 1 km | 13:30 / 01:30 | Jul 2002 – Dec 2011 (+ calibration to 2025) |
| Suomi NPP VIIRS | VNP14IMG, 375 m, version 2 | 375 m | 13:30 / 01:30 | 2012 – 2025 (**reference unit**) |
| NOAA-20 VIIRS | VJ114IMG, 375 m, version 2 | 375 m | 13:30 / 01:30 | 2026 (near-real-time) |

Suomi NPP stopped delivering new FIRMS data on 2 Nov 2026, and MODIS is nearing the end of its mission. For that reason the series is expressed in VIIRS units, and NOAA-20 carries it forward.

## 2. Filtering

- **Fire type:** `type = 0` (presumed vegetation fire). This removes volcanoes, static land sources such as industry and gas flares, and offshore detections. Near-real-time API rows have no `type`; they are kept and flagged.
- **Confidence:** MODIS ≥ 30 (nominal and high) and VIIRS `n` or `h`, dropping VIIRS low-confidence detections, which are mostly false alarms ([Giglio et al. 2016](https://doi.org/10.1016/j.rse.2016.02.054); [Schroeder et al. 2014](https://doi.org/10.1016/j.rse.2013.12.008)).
- **Duplicates:** removed on (sensor, date, time, lat, lon). Where final standard-processing (SP) rows exist for a date, they replace the near-real-time (NRT) rows for that date.

## 3. Unit: the fire cell-day

Each detection is assigned to an **H3 resolution-7** cell (about 5.2 km², edge about 1.2 km). A *fire cell-day* is one cell with at least one detection on one date, counted separately for the day and night passes.

Counting cells instead of pixels removes most of the resolution difference: one burning field produces one 1 km MODIS pixel but several 375 m VIIRS pixels, yet both give one cell-day. The rest of the gap, VIIRS's higher sensitivity to small and cool fires, is handled by calibration.

## 4. Calibration (MODIS → VIIRS)

Aqua and S-NPP cross the equator at almost the same time ([Csiszar et al. 2012](https://www.star.nesdis.noaa.gov/JPSS/documents/meetings/2012/AMS_NewOrleans_2012/Oral/2012_AMS_Csiszar_Fire_V1.pdf)), so their detections can be compared month by month over the 2012–2025 overlap. For each 2° block *b*, calendar month *m* and pass *p* (day/night):

```
k_b,m,p = ( V + α · k_nat,m,p · M0 ) / ( M + α · M0 )
```

- *V* and *M* are the S-NPP and Aqua cell-days summed over the overlap years.
- *k_nat* is the national ratio for that month and pass.
- *M0* = 50 and α = 1.

The formula pulls blocks with few fires toward the national factor, so small samples can't produce extreme factors. A 90% interval comes from a bootstrap over years (500 resamples). Fitting per region and season, rather than one global constant, follows [Li et al. 2018](https://repository.library.noaa.gov/view/noaa/49896) and the regional ratio scaling in GFED5 ([Chen et al. 2023](https://doi.org/10.5194/essd-15-5227-2023)).

**The chain of factors:**
- **Aqua:** cell-days × *k* (by block, month and pass).
- **Terra (2000–2002):** first scaled to Aqua with a national Terra/Aqua ratio fitted over 2003–2019, before the orbits drifted. This matters because fire counts depend strongly on overpass time ([Giglio 2007](https://doi.org/10.1016/j.rse.2006.11.018)). Then it is scaled by *k*.
- **NOAA-20 (2026):** scaled to S-NPP with a national ratio fitted where both observed.
- **Months used:** only months observed by both sensors enter a ratio.

Each month uses the best sensor that observed it: S-NPP, then NOAA-20, then Aqua, then Terra. The raw per-sensor counts are kept, so the app can show raw and harmonized side by side.

## 5. Validation

<!-- numbers from docs/figures/validation.json (pipeline/validate.py) -->
VALIDATION_PLACEHOLDER

Figures:
- `docs/figures/annual_raw_vs_harmonized.png`
- `docs/figures/aqua_vs_snpp_scatter.png`
- `docs/figures/k_by_month.png`

## 6. Calendar statistics and anomalies

- **Calendar value:** harmonized fire cell-days per month inside the drawn area.
- **Baseline:** the same calendar month in all other *complete* years, or 2003–2022 when chosen.
- **Shown for each month:**
  - percent of the baseline median;
  - a robust z-score, (x − median) / IQR, with the IQR floored at 1;
  - the percentile rank within the baseline.
- **Labels:** **unusually high** above the baseline 90th percentile and **unusually low** below the 10th. No label is shown when the median is under 5 cell-days, because ratios of tiny counts mislead.
- **Fire season:** the shortest run of consecutive months, wrapping across the year end, that holds at least 80% of the median annual total ([Giglio et al. 2006](https://doi.org/10.1029/2005JG000142)).
- **Colours:** counts use cividis and anomalies use purple–orange (PuOr), both colourblind-safe. Every number is also printed and available as a table.

## 7. Limitations

- **Omission:** satellites miss fires under cloud or thick smoke, small or short fires, and fires burning between overpasses. Counts are therefore an index of burning activity, **not burned area** and not fire size ([Wooster et al. 2021](https://doi.org/10.1016/j.rse.2021.112694)).
- **Provisional data:** NRT months (2026) can change when final data arrives, and are marked provisional.
- **Orbit drift:** Terra and Aqua have drifted to later overpass times since about 2022, which lowers MODIS counts. MODIS is only used for history before 2012, and the Terra/Aqua ratio is fitted on 2003–2019.
- **Terra-only period:** Nov 2000 – Jun 2002 relies on two chained factors and is the least certain part of the record.
- **Sparse areas:** small areas, or months with few fires, give noisy anomalies. This is why labels are suppressed under a median of 5.
- **Region:** India only for this prototype. The method works unchanged for any region, with factors fitted per region.
- **Next step:** footprint-level pairing with a scan-angle correction ([Zheng et al. 2026](https://doi.org/10.3390/rs18101650)), and grouping detections into individual fire events ([Andela et al. 2019](https://doi.org/10.5194/essd-11-529-2019)).

## References

- Andela, N. et al. (2019). The Global Fire Atlas of individual fire size, duration, speed and direction. *Earth Syst. Sci. Data* 11, 529–552. https://doi.org/10.5194/essd-11-529-2019
- Chen, Y. et al. (2023). Multi-decadal trends and variability in burned area from the fifth version of the Global Fire Emissions Database (GFED5). *Earth Syst. Sci. Data* 15, 5227–5259. https://doi.org/10.5194/essd-15-5227-2023
- Csiszar, I. et al. (2012). Active fires from the Suomi NPP VIIRS: product status and first evaluation results (Aqua MODIS continuity). AMS Annual Meeting. https://www.star.nesdis.noaa.gov/JPSS/documents/meetings/2012/AMS_NewOrleans_2012/Oral/2012_AMS_Csiszar_Fire_V1.pdf
- Giglio, L. (2007). Characterization of the tropical diurnal fire cycle using VIRS and MODIS observations. *Remote Sens. Environ.* 108, 407–421. https://doi.org/10.1016/j.rse.2006.11.018
- Giglio, L., Csiszar, I., Justice, C.O. (2006). Global distribution and seasonality of active fires as observed with the Terra and Aqua MODIS sensors. *J. Geophys. Res. Biogeosci.* 111, G02016. https://doi.org/10.1029/2005JG000142
- Giglio, L., Schroeder, W., Justice, C.O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. *Remote Sens. Environ.* 178, 31–41. https://doi.org/10.1016/j.rse.2016.02.054
- Li, F., Zhang, X., Kondragunta, S., Csiszar, I. (2018). Comparison of fire radiative power estimates from VIIRS and MODIS observations. *J. Geophys. Res. Atmos.* 123. https://repository.library.noaa.gov/view/noaa/49896
- Schroeder, W. et al. (2014). The New VIIRS 375 m active fire detection data product: algorithm description and initial assessment. *Remote Sens. Environ.* 143, 85–96. https://doi.org/10.1016/j.rse.2013.12.008
- Wooster, M.J. et al. (2021). Satellite remote sensing of active fires: history and current status, applications and future requirements. *Remote Sens. Environ.* 267, 112694. https://doi.org/10.1016/j.rse.2021.112694
- Zheng, et al. (2026). MYD14 and VNP14IMG active fire fusion. *Remote Sensing* 18(10), 1650. https://doi.org/10.3390/rs18101650
- NASA FIRMS. Fire Information for Resource Management System. https://www.earthdata.nasa.gov/data/tools/firms
