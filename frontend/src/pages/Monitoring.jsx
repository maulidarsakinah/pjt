import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Monitoring.css';

const monitoringHistoryData = [
  { id: 1, station: 'FLOW-Ploso_Lamongan', debit: 142.50, totalizer: 452109, vcc: 12.42, temp: 29.5, status: 'Active', time: '2026-07-06 10:45' },
  { id: 2, station: 'FLOW-Babat_Hilir', debit: 95.40, totalizer: 210985, vcc: 12.38, temp: 30.1, status: 'Active', time: '2026-07-06 10:42' },
  { id: 3, station: 'FLOW-Ploso_Lamongan', debit: 140.20, totalizer: 451900, vcc: 12.40, temp: 29.4, status: 'Active', time: '2026-07-06 10:40' },
  { id: 4, station: 'FLOW-Babat_Hilir', debit: 92.10, totalizer: 210500, vcc: 12.35, temp: 29.9, status: 'Active', time: '2026-07-06 10:35' }
];

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

const MonitoringMobileRow = ({ row }) => (
  <li>
    <div className="monitoring-mobile-log">
      <span className="monitoring-mobile-log-main">
        <span className="monitoring-mobile-log-topline">
          <time>{row.time}</time>
          <span className="monitoring-mobile-status success">{row.status}</span>
        </span>
        <strong>{row.station}</strong>
        <span className="monitoring-mobile-log-meta">
          <span>Debit: {row.debit.toFixed(2)} m³/s</span>
          <span>VCC: {row.vcc.toFixed(2)} V</span>
          <span className="monitoring-mobile-latency">Suhu: {row.temp} °C</span>
        </span>
      </span>
    </div>
  </li>
);

const Monitoring = () => {
  const isMobile = useMediaQuery('(max-width: 760px)');
  const navigate = useNavigate();
  const location = useLocation();
  const detailBasePath = location.pathname.startsWith('/admin') ? '/admin/detail' : '/dashboard/detail';

  const handleShowDetail = (stationName) => {
    navigate(`${detailBasePath}/${stationName}`);
  };

  return (
    <div className="view-section">
      <div className="header-section">
        <h1>Monitoring</h1>
        <p>Status jaringan sensor hidrologi real-time</p>
      </div>

      <div className="filter-section">
        <div className="filter-group">
          <label>Lokasi Pemasangan</label>
          <select defaultValue="Semua Lokasi">
            <option>Semua Lokasi</option>
            <option>FLOW-Ploso_Lamongan</option>
            <option>FLOW-Babat_Hilir</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status Perangkat</label>
          <select defaultValue="Semua Status">
            <option>Semua Status</option>
            <option>Online (Active)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Rentang Waktu</label>
          <select defaultValue="24 Jam Terakhir">
            <option>24 Jam Terakhir</option>
            <option>7 Hari Terakhir</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="btn btn-dark">Apply Filter</button>
          <button className="btn btn-outline" style={{ marginLeft: '10px' }}>Reset</button>
        </div>
      </div>

      <div className="monitoring-layout">
        <div className="map-monitoring-container">
          <MapContainer center={[-7.1147, 112.4146]} zoom={11} style={{ height: '100%', width: '100%', zIndex: 1 }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <Marker position={[-7.121, 112.414]}>
              <Popup><b>FLOW-Ploso_Lamongan</b></Popup>
            </Marker>
            <Marker position={[-7.100, 112.450]}>
              <Popup><b>FLOW-Babat_Hilir</b></Popup>
            </Marker>
          </MapContainer>
        </div>
        
        <div className="station-list">
          <div className="station-list-header">
            <h3>Daftar Stasiun</h3>
            <span>2 Ditemukan</span>
          </div>
          <div className="station-items">
            <div className="station-card">
              <div className="station-card-top">
                <div className="station-name">FLOW-Ploso_Lamongan</div>
                <span className="badge badge-normal">ACTIVE</span>
              </div>
              <div className="station-id">ID: ST-PLS-01</div>
              <div className="station-metric">
                <span className="station-metric-val">Debit: 142.5 m³/s</span>
                <span className="station-time">2 menit yang lalu</span>
              </div>
              <button className="btn btn-outline btn-block" onClick={() => handleShowDetail('FLOW-Ploso_Lamongan')}>
                Lihat Detail
              </button>
            </div>
            <div className="station-card">
              <div className="station-card-top">
                <div className="station-name">FLOW-Babat_Hilir</div>
                <span className="badge badge-normal">ACTIVE</span>
              </div>
              <div className="station-id">ID: ST-BBT-02</div>
              <div className="station-metric">
                <span className="station-metric-val">Debit: 95.4 m³/s</span>
                <span className="station-time">5 menit yang lalu</span>
              </div>
              <button className="btn btn-outline btn-block" onClick={() => handleShowDetail('FLOW-Babat_Hilir')}>
                Lihat Detail
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '8px' }}>
        <div className="panel-header" style={{ marginBottom: '10px' }}>
          <div className="panel-title">Data Monitoring Historis</div>
          <button className="btn btn-outline" style={{ fontSize: '12px', padding: '8px 14px' }}>
            <i className="fa-solid fa-download"></i> Export CSV
          </button>
        </div>
        <div className="table-container">
          {isMobile ? (
            <ul className="monitoring-mobile-list">
              {monitoringHistoryData.map((row) => (
                <MonitoringMobileRow key={row.id} row={row} />
              ))}
            </ul>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>LOKASI STASIUN</th>
                  <th>DEBIT (m³/s)</th>
                  <th>TOTALIZER (L)</th>
                  <th>VCC (V)</th>
                  <th>SUHU (°C)</th>
                  <th>STATUS</th>
                  <th>LAST UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {monitoringHistoryData.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.station}</b></td>
                    <td>{row.debit.toFixed(2)}</td>
                    <td>{row.totalizer}</td>
                    <td>{row.vcc.toFixed(2)}</td>
                    <td>{row.temp.toFixed(1)}</td>
                    <td><span className="badge-dot"></span>{row.status}</td>
                    <td>{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="pagination">
          <div className="page-info">Menampilkan 1-4 dari 4 entri</div>
          <div className="page-controls">
            <button className="page-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
