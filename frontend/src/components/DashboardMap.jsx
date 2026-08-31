import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-7.0382, 112.2806];
const MAP_STYLE = {
  height: "100%",
  width: "100%",
  borderRadius: "inherit",
  zIndex: 1,
};

const FALLBACK_STATIONS = [
  {
    id: "740",
    station_name: "Flowmeter Lamongan",
    kode_station: "PJT-FLOW-LMG",
    x: 112.2806,
    y: -7.0382,
  },
];

function getCoordinates(station) {
  const lat = Number(station?.y);
  const lng = Number(station?.x);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng];
  }

  return DEFAULT_CENTER;
}

const DashboardMap = ({ stations = [] }) => {
  const stationList = stations.length ? stations : FALLBACK_STATIONS;
  const targetStation =
    stationList.find((station) => String(station.id) === "740") ||
    stationList[0];

  const position = getCoordinates(targetStation);

  return (
    <MapContainer
      center={position}
      zoom={13}
      zoomControl={false}
      style={MAP_STYLE}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {targetStation && (
        <Marker position={position}>
          <Popup>
            <b>
              {targetStation.station_name ||
                targetStation.kode_station ||
                "Flowmeter Lamongan"}
            </b>
            <br />
            <span>
              {position[0].toFixed(4)}° S, {position[1].toFixed(4)}° E
            </span>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
};

export default DashboardMap;
