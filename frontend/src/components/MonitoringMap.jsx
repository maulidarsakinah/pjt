import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { stationMarkerIcon } from "../utils/leafletIcon";

const DEFAULT_CENTER = [-7.1197, 112.4168];
const MAP_STYLE = {
  height: "100%",
  width: "100%",
  zIndex: 1,
};

const FALLBACK_STATIONS = [
  {
    id: "740",
    station_name: "Flowmeter Lamongan",
    kode_station: "FLOW_LAMONGAN",
    x: 112.4168,
    y: -7.1197,
  },
];

const MonitoringMap = ({ stations = [] }) => {
  const stationList = stations.length > 0 ? stations : FALLBACK_STATIONS;
  const primaryStation =
    stationList.find((s) => String(s.id) === "740") || stationList[0];
  const centerLat = Number(primaryStation?.y);
  const centerLng = Number(primaryStation?.x);
  const centerPosition =
    Number.isFinite(centerLat) && Number.isFinite(centerLng)
      ? [centerLat, centerLng]
      : DEFAULT_CENTER;

  return (
    <MapContainer center={centerPosition} zoom={13} style={MAP_STYLE}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stationList.map((station) => {
        const lat = Number(station.y);
        const lng = Number(station.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const pos = [lat, lng];

        return (
          <Marker key={station.id} position={pos} icon={stationMarkerIcon}>
            <Popup>
              <b>
                {station.station_name ||
                  station.nama ||
                  station.kode_station ||
                  `Station ${station.id}`}
              </b>
              <br />
              <span>
                {pos[0].toFixed(4)}° S, {pos[1].toFixed(4)}° E
              </span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MonitoringMap;
