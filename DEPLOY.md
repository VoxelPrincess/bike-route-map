## 11.1 — Frontend on Azure Static Web Apps

- **Resource:** `bike-frontend` (Free, Region: West Europe)  
- **Branch:** `main`  
- **App location:** `/` • **Output:** `dist` • **API:** *(empty)*  
- **URL:** https://kind-river-099ad551e.2.azurestaticapps.net  
- **Notes:** SPA fallback via `staticwebapp.config.json` prevents 404 on deep links.

## 11.4 — Test Updates via Pull Request

Updates are tested through **pull requests**.  
Each PR triggers GitHub Actions → Azure SWA builds a **temporary preview environment**.  
The preview URL is shown in the PR checks and disappears after the PR is merged.