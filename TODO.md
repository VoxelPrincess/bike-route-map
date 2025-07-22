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
  - [ ] 4.1 Create checkbox UI
  - [ ] 4.2 Add support for 6+ surface types
  - [ ] 4.3 Filter features by checkbox state

- [ ] 5. Surface segment styling
  - [ ] 5.1 Add color mapping by surface
  - [ ] 5.2 Apply styles to each feature
  - [ ] 5.3 Add hover popup with surface type

---

## Part 2 — Routing & API Integration

- [ ] 6. A→B route planning
  - [ ] 6.1 Implement address search field
  - [ ] 6.2 Query Digitransit API for route
  - [ ] 6.3 Render returned route on map

- [ ] 7. Styled route overlay
  - [ ] 7.1 Match returned segments to surface types
  - [ ] 7.2 Color route based on surface data

---

## Part 3 — Stats & Backend Planning

- [ ] 8. Surface analytics
  - [ ] 8.1 Calculate surface type percentages
  - [ ] 8.2 Show chart or legend with breakdown

- [ ] 9. Feedback feature
  - [ ] 9.1 Add feedback marker UI
  - [ ] 9.2 Plan data format for feedback

- [ ] 10. Backend API draft  
      _(see [api_plan.md](docs/api_plan.md) for details)_
  - [ ] 10.1 Create FastAPI project scaffold
  - [ ] 10.2 Define endpoints for feedback
  - [ ] 10.3 Plan database schema

- [ ] 11. Early Azure Deployment
  - [ ] 11.1 Deploy current frontend to Azure Static Web Apps
  - [ ] 11.2 Enable GitHub Actions for CI/CD
  - [ ] 11.3 Get temporary Azure subdomain
  - [ ] 11.4 Test updates via `git push`
  - [ ] 11.5 Connect custom domain via Hostinger DNS

## Part 4 — Backend Deployment & Dockerization

- [ ] 12. Containerize FastAPI backend with Docker
- [ ] 13. Add PostgreSQL service via docker-compose
- [ ] 14. Deploy backend to Azure (Container Apps or App Service)
- [ ] 15. Connect frontend to deployed backend

---

## Project Tracker

For full task progress and status, see the  
[GitHub Project Board](https://github.com/users/VoxelPrincess/projects/3/views/1)


  [← Back to README](README.md)
