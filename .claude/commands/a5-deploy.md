---
description: "Abhinay #5: deploy API + frontend on Render with one blueprint, plus keep-warm ping"
---
You are working on Abhinay's track. Time budget: 45 minutes. Extra notes: $ARGUMENTS

Hosting choice: **Render**, with one `render.yaml` blueprint for both services, deployed from the GitHub repo `sravani6130/Nasa_scarab`. The frontend is a static site on Render's CDN, so it never sleeps. The API is a free Python web service, kept awake by a ping.

Do this:
1. Write `render.yaml` at the repo root:
   ```yaml
   services:
     - type: web
       name: fire-calendar-api
       runtime: python
       plan: free
       buildCommand: pip install -r backend/requirements.txt
       startCommand: uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
       healthCheckPath: /api/health
       envVars:
         - key: PYTHON_VERSION
           value: 3.11.9
         - key: ALLOWED_ORIGINS
           value: https://fire-calendar.onrender.com
     - type: web
       name: fire-calendar
       runtime: static
       rootDir: frontend
       buildCommand: npm ci && npm run build
       staticPublishPath: dist
       envVars:
         - key: VITE_API_URL
           value: https://fire-calendar-api.onrender.com
         - key: VITE_USE_MOCKS
           value: "false"
       routes:
         - type: rewrite
           source: /*
           destination: /index.html
   ```
   Change the names or URLs if Render assigns different ones. Check that `pipeline/harmonize.py` can be imported from the API. If it needs any packages that are not in backend/requirements.txt, add them there.
2. Commit and push, then tell the user exactly what to click: Render dashboard → New → Blueprint → connect the GitHub repo → Apply. Wait for both deploys. Once the real URLs are known, update `ALLOWED_ORIGINS` and `VITE_API_URL` if they differ, and redeploy.
3. Write `.github/workflows/keepwarm.yml`, which runs `curl -fsS https://<api>/api/health` on the schedule `*/10 * * * *` and also on workflow_dispatch.
4. Smoke test the live site: `curl` the health check and a Punjab `/api/calendar` POST, and time both. Then ask the user to open the site in a private window on desktop and on a phone, draw an area, and download the CSV.
5. Add the live URL to README.md (Live demo section) and to docs/SUBMISSION.md.
6. Fallback: if the Render API build fails because of memory or size, deploy the API to Hugging Face Spaces (Docker) or Fly.io, and point `VITE_API_URL` at it.
7. Tick the boxes under "/a5-deploy", commit `a5: deploy`, and run `git pull --rebase && git push`. Report both live URLs.
