import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MAP_STYLE = {
  height: "100%",
  width: "100%",
  zIndex: 1,
};

const MonitoringMap = () => (
  <MapContainer center={[-7.1147, 112.4146]} zoom={11} style={MAP_STYLE}>
    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
    <Marker position={[-7.121, 112.414]}>
      <Popup>
        <b>FLOW-Ploso_Lamongan</b>
      </Popup>
    </Marker>
    <Marker position={[-7.1, 112.45]}>
      <Popup>
        <b>FLOW-Babat_Hilir</b>
      </Popup>
    </Marker>
  </MapContainer>
);

export default MonitoringMap;
