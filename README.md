# bike-route-map

A web application that helps cyclists find safer and more comfortable bike routes,  
with surface type visualization and smart routing using open data.

---

## 1. Features

- Surface type map (asphalt, gravel, cobblestone, etc.)
- Route planning between A → B (via Digitransit API)
- Route surface type breakdown (percentages)
- (Optional) User feedback for segments

---

## 2. Tech Stack

- **Frontend:** React + Leaflet + Vite
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL + PostGIS
- **Deployment:** Docker + Azure Containers

---

## 3. How to Run

```bash
npm install
npm run dev
```

---

## 4. Folder Structure

```
/src     → React components, map logic  
/public  → Static files (GeoJSON, favicon)  
/docs    → Diagrams, MVP, problem domain  
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


## 7. Solution Domain Overview

> View or edit diagram: [https://is.gd/1QElLX](https://is.gd/1QElLX)

![Solution Architecture](docs/TechStack.png) 

---

## 8. Project Tracker

For full task progress and status, see the  
[📋 GitHub Project Board](https://github.com/users/VoxelPrincess/projects/3/views/1)

