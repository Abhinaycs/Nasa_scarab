---
description: "Sravani #5: validation figures, METHODS.md and submission text"
---
You are working on Sravani's track. Time budget: 45 minutes. Extra notes: $ARGUMENTS

Do this:
1. `pipeline/validate.py`:
   - Hold-out test: refit aqua_to_snpp on 2012 to 2018 only, predict the S-NPP monthly totals for 2019 to 2025 from Aqua, and report the MAPE and the bias for all of India and for each of 3 regions (Punjab box, central India, northeast).
   - Pettitt change-point test (implement it with numpy) on the annual totals, raw vs harmonized. Report the p-value at 2012 for each.
   - Figures saved to `docs/figures/` as PNG (dpi 150, colorblind-safe): (a) raw MODIS, raw VIIRS and harmonized annual totals for 2001 to 2025; (b) a scatter of monthly Aqua vs S-NPP with the fitted k; (c) the national k by month (day and night).
2. Write `docs/METHODS.md` covering: the data (FIRMS products and versions, with links), the filtering, the H3 cell-day unit, the calibration formula, the validation numbers from step 1, the anomaly definitions, and the limitations (clouds/smoke cause omission; counts are not burned area; NRT is provisional; Aqua orbit drift after 2022; Terra only covers 2000 to 2002). End with references: Giglio et al. 2016, Schroeder et al. 2014, Csiszar et al. 2012, Li et al. 2018, Zheng et al. 2026, Giglio et al. 2006, Andela et al. 2019, Wooster et al. 2021, Chen et al. 2023 (DOIs from the research doc).
3. Write `docs/SUBMISSION.md` with ready-to-paste text for each Space Apps field:
   - project name
   - high-level summary (about 150 words)
   - detailed description (what it does, how it works, its benefits, the tools used)
   - NASA data: FIRMS MODIS C6.1 MCD14ML, VIIRS 375 m VNP14IMG and VJ114IMG, the FIRMS API
   - other references
   - "Use of SI": Claude Code helped with planning, code generation and documentation, and the team reviewed and tested it. Also add a matching AI-assistance note to README.md.
   Leave placeholders for the live URL and the demo link.
4. Tick the boxes under "/s5-validate-methods", commit `s5: validation + methods + submission text`, and run `git pull --rebase && git push`. Report the key validation numbers in 3 lines; Abhinay will put them in the slides.
