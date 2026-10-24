# bike-route-map

A web application that helps cyclists find safer and more comfortable bike routes,  
with surface type visualization and smart routing using open data.

---

## 1. Features

- Surface type map (asphalt, gravel, cobblestone, etc.)
- Route planning between A → B (via OpenRouteService)
- Route surface type breakdown (percentages)
- (Optional) User feedback for segments

---

## 2. Tech Stack

- **Frontend:** React + Leaflet + Vite  
- **Backend:** FastAPI (Python) — local service, Dockerized for development  
- **Database:** PostgreSQL + PostGIS — *(planned)*  
- **GIS:** Location and surface data via GeoJSON, ORS API, Overpass API  
- **Deployment:** Azure Static Web Apps (frontend), Docker Compose (local backend), Azure Containers *(planned)*

---

## 3. How to Run

### Frontend

Copy `.env.example` to `.env` if you do not already have a local configuration.
For live local routing, set `VITE_USE_SAMPLE=0` and
`VITE_API_BASE=http://localhost:8000`. Restart Vite after changing these values.
The development server uses port 5173 and stops if that port is occupied,
matching the backend's allowed local origins.

Set `VITE_USE_SAMPLE=1` to display the fixed demo route without a backend.
Demo mode is labeled on the map; metrics absent from the sample are not shown.
Live failures never fall back to the demo. The icy-dune build explicitly keeps
sample mode enabled until the cloud backend is connected in #41/#42.

```bash
# install dependencies
npm install

# start the development server (http://localhost:5173)
npm run dev

# build the production bundle
npm run build

# preview the production build locally
npm run preview

# frontend tests and TypeScript checks
npm test
npm run typecheck
```

### Backend (local without Docker)

```bash
# from project root
cd backend

# create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Linux / macOS
# .venv\Scripts\activate   # Windows

# install dependencies
pip install -r requirements.txt

# set the server key in this terminal before starting live routing
export ORS_API_KEY=your_server_key_here

# run the FastAPI server
python -m uvicorn main:app --reload --port 8000
```

### Backend via Docker Compose

Requirements:
- Docker Desktop (or Docker Engine + Compose plugin)
- Port `${BACKEND_PORT:-8000}` available on host

```bash
# from project root
docker compose up --build backend
```

Backend docs: http://localhost:8000/docs

To use a different host port, set `BACKEND_PORT` in `.env` (see `.env.example`):

```bash
BACKEND_PORT=8010 docker compose up --build backend
```

```bash
# stop containers
docker compose down
```

The live frontend sends `POST /api/v1/route` with `start` and `end` coordinate
pairs in `[longitude, latitude]` order and the `cycling-regular` profile. The
backend makes one ORS directions request with `extra_info: ["surface"]`. Route
geometry, distance, duration, the surface summary, and the geometry segments
all come from that same ORS response. The response identifies the surface data
as `ors.extra_info.surface`; the chart labels it as ORS data.

Keep `ORS_API_KEY` only in the backend process environment, never in a `VITE_`
variable. The local Uvicorn command above inherits that environment; the current
Compose file does not yet forward the key into the container. There is no route
cache on `/api/v1/route`.

When routing succeeds but surface extras are missing or invalid, the backend
returns HTTP 200 with `status: "partial"`: the map keeps the route, distance,
and duration, explains that surface coverage is unavailable, and omits the
surface chart and colored segments. Other failures return a non-2xx response
with an error `code` and message. For example, `waypoint_not_found` (422) means
ORS could not attach a selected point to its cycling network; `route_not_found`
(404) means it could not find a path between the points. Failed requests clear
the previous route and offer a retry. Reset or selecting new points cancels
pending work; live failures never fall back to the sample route.
Missing server configuration returns `ors_not_configured` (503), timeouts return
`ors_timeout` (504), and connection or upstream failures return
`ors_unavailable` (503).

### Local live-route verification

On 2026-10-24, a browser check with live mode enabled showed a 2.37 km route
taking 9 min, its route line, and an ORS surface chart for asphalt, unknown,
and paving stones. The returned breakdown was asphalt 2.208 km (93.18%),
unknown 112 m (4.71%), and paving stones 50 m (2.11%); matching colored route
segments were present in the map. The summary totals match the displayed route
after rounding. This verifies that the frontend renders the backend's single
live result; it does not independently validate the mapped surface against the
road on the ground.

Unknown surface remains unknown when OpenStreetMap has no recognized surface
tag. Ferry routes are not excluded. Comparing ORS coverage with an independent
source and checking real-road accuracy remain in [#54](https://github.com/VoxelPrincess/bike-route-map/issues/54).

The surface properties, color mapping, and segment coloring in #19 are covered
by this #66 implementation; #19 remains open and is not closed by this work.

The map no longer calls the legacy `/analyze-surface` endpoint. For that endpoint's
errors, cache behavior, limitations and tests, see
[Surface API notes](backend/SURFACE_API.md).

---

## 4. Folder Structure

```
/src       → React components, map logic
/public    → Static files (e.g., GeoJSON, favicon)
/backend   → FastAPI backend (local + Docker)
/docs      → Diagrams, MVP notes, problem/solution domain docs
```

---

## 5. Docs

- [Problem Domain](docs/problem_domain.md)
- [Problem Domain Diagram](docs/ProblemDomain.png)
- [Solution Domain](docs/solution_domain.md)
- [MVP Description](docs/mvp.md) 
- [Solution Architecture](docs/TechStack.png)
- [Task List / TODO](TODO.md)

---

## 6. Problem Domain Diagram

> View or edit diagram: [https://is.gd/aFSsrB](https://is.gd/aFSsrB)

![Problem Domain Diagram](docs/ProblemDomain.png)

The Problem Domain diagram illustrates potential entities and relationships affecting bicycle route choice (e.g., surface type, weather, safety, and feedback). The current MVP focuses only on route geometry and surface data, while other factors are considered future scope.


---


## 7. Solution Domain Overview

> View or edit diagram: [https://is.gd/oo5vFi](https://is.gd/oo5vFi)

![Solution Architecture](docs/TechStack.png) 

---

## 8. Project Tracker

For full task progress and status, see the  
[GitHub Project Board](https://github.com/users/VoxelPrincess/projects/3/views/1)

---

## PR Preview (Azure SWA)

This project uses **Azure Static Web Apps (SWA)** for pull request previews.  
Each pull request automatically creates a temporary preview environment.  
The preview URL is shown in the PR checks and disappears after the PR is merged.  

For deployment details, see [DEPLOY.md](./DEPLOY.md).

---

## 9. Deployment

### 11.1 — Frontend on Azure Static Web Apps

- **Resource:** `bike-frontend` (Free, Region: West Europe)  
- **Branch:** `main`  
- **App location:** `/` • **Output:** `dist` • **API:** *(empty)*  
- **URL:** https://icy-dune-080042c1e.3.azurestaticapps.net  
- **Notes:** SPA fallback via `staticwebapp.config.json` prevents 404 on deep links.

### 11.4 — Test Updates via Pull Request

Updates are tested through **pull requests**.  
Each PR triggers GitHub Actions → Azure SWA builds a **temporary preview environment**.  
The preview URL is shown in the PR checks and disappears after the PR is merged.

👉 For full deployment details, see [DEPLOY.md](./DEPLOY.md).

---

## Demo

- Local preview (screenshot):
  
  ![Local demo](docs/screenshots/local-demo.png)

- Video demo: [Watch on Google Drive](<https://drive.google.com/file/d/1LXbNfJVwOeqU_r5m7MkkzT5k7p-V8szH/view?usp=drive_link>)
