# API Plan — bike-route-map

## 1. External API

### 1.1 Digitransit Routing API (used now)
- Endpoint: `/routing/v1/routers/hsl/index/graphql`
- Protocol: GraphQL
- Method: POST
- Used for: Route search between two locations
- Returns: Route geometry and metadata

## 2. Internal API (future, optional)

### 2.1 Feedback API (planned)
- Endpoint: `POST /feedback`
- Body: `{ lat, lon, surface, comment }`

## 3. Data Formats

- Input: user selects A → B
- Output: GeoJSON / decoded geometry
- Feedback: JSON with location and description

## 4. Tech Stack

- External routing: Digitransit GraphQL
- (Optional) Internal API: FastAPI + PostgreSQL/PostGIS

[← Back to README](../README.md)
