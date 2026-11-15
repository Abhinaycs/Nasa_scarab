---
description: "Abhinay #6: 7-slide demo deck and Space Apps submission checklist"
---
You are working on Abhinay's track. Time budget: 45 minutes. **The hard deadline is 23:59; aim to submit by 23:30.** Extra notes: $ARGUMENTS

Do this:
1. Pull the latest work (`git pull`). Read docs/SUBMISSION.md, docs/METHODS.md and docs/figures/.
2. Make a 7-slide deck. A Google Slides outline is fine; or, if the user wants a file, `docs/demo/slides.md` rendered with Marp to PDF. Use these slides:
   1. **Title:** project name, tagline, team name, members (Sravani, Abhinay), and the challenge name
   2. **Problem:** MODIS and VIIRS records can't be compared directly; MODIS is ending
   3. **Our approach:** fire cell-days on an H3 grid, plus calibration on the 2012–2025 overlap (the diagram from the method)
   4. **Proof:** the raw vs harmonized annual figure plus the validation numbers
   5. **The app:** screenshots of drawing an area, the burning calendar and the anomaly calendar
   6. **Who it helps:** emergency managers, scientists and land managers; the live URL; the CSV export
   7. **NASA data and what's next:** FIRMS MODIS and VIIRS; global coverage, nightly refresh, alerts
   No NASA logos. Mark any AI-generated image with a visible watermark.
3. Take screenshots of the live app (or ask the user to) and save them to `docs/demo/`.
4. Tell the user to upload the deck to Google Drive or YouTube with public "anyone with the link" access, and to test the link in a private window.
5. Give the user this final checklist for the Space Apps project page, filling in the values from docs/SUBMISSION.md:
   - Project Name
   - High-Level Summary
   - Link to Project Demo
   - Link to Final Project (live URL + GitHub repo, public)
   - Detailed Description
   - Use of SI
   - NASA Data
   - Other References
   - Then: agree to the terms → confirm original work → **Submit for Judging** → check that the confirmation banner appears
6. Make sure the GitHub repo is public and that README.md has the live link, run instructions, credits and the AI-assistance note.
7. Tick the boxes under "/a6-demo-submission", commit `a6: demo + submission`, and run `git pull --rebase && git push`.
