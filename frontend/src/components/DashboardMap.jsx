import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

const FALLBACK_STATIONS = [{ id: 'fallback-1', station_name: 'Flowmeter Lamongan' }];
const MAP_CENTER = [-7.1147, 112.4146];
const MAP_STYLE = {
  height: '100%',
  width: '100%',
  borderRadius: 'inherit',
  zIndex: 1,
};

function markerPosition(index) {
  const baseLat = -7.1147;
  const baseLng = 112.4146;
  const row = Math.floor(index / 3);
  const column = index % 3;

  return [baseLat + (row - 1) * 0.018, baseLng + (column - 1) * 0.025];
}

const DashboardMap = ({ stations }) => {
  const visibleStations = (stations.length ? stations : FALLBACK_STATIONS).slice(0, 1);

  return (
    <MapContainer center={MAP_CENTER} zoom={11} zoomControl={false} style={MAP_STYLE}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      {visibleStations.map((station, index) => (
        <Marker key={station.id} position={markerPosition(index)}>
          <Popup><b>{station.station_name || station.kode_station}</b></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default DashboardMap;
