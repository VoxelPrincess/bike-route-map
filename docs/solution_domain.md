# Solution Domain — bike-route-map

## 1. Overview

To solve the problem of surface-unaware route planning, the solution is a web application  
that visualizes surface types on a map and integrates route planning via open APIs.  
The application helps users make more informed decisions when selecting cycling routes.

## 2. Key Solution Components

### 2.1 Interactive Map UI

- Built with React and Leaflet
- Displays segments of routes with color-coded surface types
- Provides a clean, user-friendly interface for filtering and exploring

### 2.2 Surface Type Filters

- Users can select which surface types (e.g., asphalt, gravel, cobblestone) to show or hide
- Helps users personalize their route planning based on preferences and conditions

### 2.3 Route Planning Integration

- Digitransit API planned for routing between point A and B
- Future route overlay will be styled based on surface data per segment

### 2.4 Route Breakdown (Planned)

- Shows percentage of each surface type along the route
- Useful for evaluating the comfort and safety of a suggested path

## 3. Architecture Snapshot

Architecture diagram: https://is.gd/oo5vFi

![Solution Architecture](TechStack.png)

- Frontend: React, Vite, Leaflet (TypeScript)
- Backend: FastAPI (planned)
- Database: PostgreSQL + PostGIS (planned spatial storage for surface and route data)
- APIs: Digitransit, OpenStreetMap, HRI GeoJSON
- Deployment: Dockerized containers, Azure-hosted (planned)

## 4. Benefits of This Approach

- Uses open data and public APIs
- Focuses on visual clarity and simplicity
- Designed for future scaling (backend, user feedback, mobile support)

## 5. Next Steps

1. Integrate routing via Digitransit API
2. Add mobile responsiveness
3. Build backend endpoints for user feedback and saved preferences
4. Extend support beyond Helsinki

[← Back to README](../README.md)
