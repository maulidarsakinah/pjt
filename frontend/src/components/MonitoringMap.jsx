import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-7.0382, 112.2806];
const MAP_STYLE = {
  height: "100%",
  width: "100%",
  zIndex: 1,
};

const MonitoringMap = ({ stations = [] }) => {
  const station740 = stations.find((s) => String(s.id) === "740") || stations[0];
  const position =
    station740?.y != null && station740?.x != null
      ? [Number(station740.y), Number(station740.x)]
      : DEFAULT_CENTER;

  return (
    <MapContainer center={position} zoom={13} style={MAP_STYLE}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      <Marker position={position}>
        <Popup>
          <b>
            {station740?.station_name ||
              station740?.kode_station ||
              "Flowmeter Lamongan"}
          </b>
          <br />
          <span>
            {position[0].toFixed(4)}° S, {position[1].toFixed(4)}° E
          </span>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default MonitoringMap;
