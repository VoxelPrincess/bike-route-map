# TODO: bike-route-map

---

## Part 1 — Frontend: Map MVP

- [ ] 1. Initialize project
  - [ ] 1.1 Create Vite + React + TypeScript app [#1](https://github.com/VoxelPrincess/bike-route-map/issues/1)
  - [ ] 1.2 Set up folder structure [#2](https://github.com/VoxelPrincess/bike-route-map/issues/2)

- [ ] 2. Display base map
  - [ ] 2.1 Install Leaflet and configure tiles [#3](https://github.com/VoxelPrincess/bike-route-map/issues/3)
  - [ ] 2.2 Center map on Helsinki [#4](https://github.com/VoxelPrincess/bike-route-map/issues/4)
  - [ ] 2.3 Style base map container [#5](https://github.com/VoxelPrincess/bike-route-map/issues/5)

- [ ] 3. Load and display surface data 
  - [ ] 3.1 Add test GeoJSON to public folder [#6](https://github.com/VoxelPrincess/bike-route-map/issues/6)
  - [ ] 3.2 Load GeoJSON using fetch [#7](https://github.com/VoxelPrincess/bike-route-map/issues/7)
  - [ ] 3.3 Render GeoJSON layer on map [#8](https://github.com/VoxelPrincess/bike-route-map/issues/8)

- [ ] 4. Surface filter UI
  - [ ] 4.1 Create checkbox UI [#9](https://github.com/VoxelPrincess/bike-route-map/issues/9)
  - [ ] 4.2 Add support for 6+ surface types [#10](https://github.com/VoxelPrincess/bike-route-map/issues/10)
  - [ ] 4.3 Filter features by checkbox state [#11](https://github.com/VoxelPrincess/bike-route-map/issues/11)

- [ ] 5. Surface segment styling
  - [ ] 5.1 Add color mapping by surface [#12](https://github.com/VoxelPrincess/bike-route-map/issues/12)
  - [ ] 5.2 Apply styles to each feature [#13](https://github.com/VoxelPrincess/bike-route-map/issues/13)
  - [ ] 5.3 Add hover popup with surface type [#14](https://github.com/VoxelPrincess/bike-route-map/issues/14)

---

## Part 2 — Routing & API Integration

- [ ] 6. A→B route planning
  - [ ] 6.1 Use fixed A/B coordinates for testing [#15](https://github.com/VoxelPrincess/bike-route-map/issues/15)
  - [ ] 6.2 Query OpenRouteService API (cycling-regular, GeoJSON) [#16](https://github.com/VoxelPrincess/bike-route-map/issues/16)
  - [ ] 6.3 Render returned route as GeoJSON layer [#17](https://github.com/VoxelPrincess/bike-route-map/issues/17)
  - [ ] 6.4* Add A and B markers on map [#44](https://github.com/VoxelPrincess/bike-route-map/issues/44)

- [ ] 7. Styled route overlay
  - [ ] 7.1 Style route line (color, opacity, weight) [#18](https://github.com/VoxelPrincess/bike-route-map/issues/18)
  - [ ] 7.2* Color route segments by surface type (if available) [#19](https://github.com/VoxelPrincess/bike-route-map/issues/19)

---

## Part 3 — Stats & Backend Planning

- [ ] 8. Surface analytics
  - [ ] 8.1 Calculate surface type percentages [#20](https://github.com/VoxelPrincess/bike-route-map/issues/20)
  - [ ] 8.2 Show chart or legend with breakdown [#21](https://github.com/VoxelPrincess/bike-route-map/issues/21)

- [ ] 9. Feedback feature
  - [ ] 9.1 Add feedback marker UI [#22](https://github.com/VoxelPrincess/bike-route-map/issues/22)
  - [ ] 9.2 Plan data format for feedback [#23](https://github.com/VoxelPrincess/bike-route-map/issues/23)

- [ ] 10. Backend API draft  
      _(see [api_plan.md](docs/api_plan.md) for details)_
  - [ ] 10.1 Create FastAPI project scaffold [#24](https://github.com/VoxelPrincess/bike-route-map/issues/24)
  - [ ] 10.2 Define endpoints for feedback [#25](https://github.com/VoxelPrincess/bike-route-map/issues/25)
  - [ ] 10.3 Plan database schema [#26](https://github.com/VoxelPrincess/bike-route-map/issues/26)

- [ ] 11. Early Azure Deployment
  - [ ] 11.1 Deploy current frontend to Azure Static Web Apps [#34](https://github.com/VoxelPrincess/bike-route-map/issues/34)
  - [ ] 11.2 Enable GitHub Actions for CI/CD [#35](https://github.com/VoxelPrincess/bike-route-map/issues/35)
  - [ ] 11.3 Get temporary Azure subdomain [#36](https://github.com/VoxelPrincess/bike-route-map/issues/36)
  - [ ] 11.4 Test updates via `git push` [#37](https://github.com/VoxelPrincess/bike-route-map/issues/37)
  - [ ] 11.5 Connect custom domain via Hostinger DNS [#38](https://github.com/VoxelPrincess/bike-route-map/issues/38)
  - [ ] 11.6* Deploy OpenLayers version (optional, subpath `/ol`)

---

## Part 4 — Backend Deployment & Dockerization

- [ ] 12. Containerize FastAPI backend with Docker [#39](https://github.com/VoxelPrincess/bike-route-map/issues/39)
- [ ] 13. Add PostgreSQL service via docker-compose [#40](https://github.com/VoxelPrincess/bike-route-map/issues/40)
- [ ] 14. Deploy backend to Azure (Container Apps or App Service) [#41](https://github.com/VoxelPrincess/bike-route-map/issues/41)
- [ ] 15. Connect frontend to deployed backend [#42](https://github.com/VoxelPrincess/bike-route-map/issues/42)

---

## Part X* — Optional: OpenLayers Migration (Post-MVP)

> This section is reserved for a potential future migration to OpenLayers, if required for more advanced geospatial features or projection support.

- [ ] X.1 Create new Vite project under `openlayers-version/` folder
- [ ] X.2 Rebuild base map using `ol.Map` and `ol.layer.Tile`
- [ ] X.3 Load surface GeoJSON using `ol.source.Vector` + `ol.format.GeoJSON`
- [ ] X.4 Implement feature styling using `ol.style.Style` and `ol.style.Stroke`
- [ ] X.5 Rebuild surface filtering UI (manual or custom React logic)
- [ ] X.6 Query ORS API and render route as vector layer
- [ ] X.7 Evaluate pros/cons of OL vs Leaflet for current use case
- [ ] X.8 Write internal comparison summary (optional)

---

## Project Tracker

For full task progress and status, see the  
[GitHub Project Board](https://github.com/users/VoxelPrincess/projects/3/views/1)


  [← Back to README](README.md)
