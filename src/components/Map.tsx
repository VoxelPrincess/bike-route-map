import { MapContainer, TileLayer } from "react-leaflet";

const helsinki = [60.1699, 24.9384];

const Map = () => (
  <MapContainer center={helsinki} zoom={13} style={{ height: "100vh", width: "100%" }}>
    <TileLayer
      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  </MapContainer>
);

export default Map;
