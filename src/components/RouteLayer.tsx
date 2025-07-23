import { GeoJSON } from "react-leaflet";

function RouteLayer({ routeData }: { routeData: any }) {
    if (!routeData) return null;

    const routeStyle = {
        color: "#1976d2",
        weight: 4,
        opacity: 0.7
    };

    return (
    <GeoJSON
      data={routeData}
      style={routeStyle}
    />
  );
}

export default RouteLayer;
