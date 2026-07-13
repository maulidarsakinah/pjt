import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import './Monitoring.css';

const Monitoring = () => {
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
              <tr><td><b>FLOW-Ploso_Lamongan</b></td><td>142.50</td><td>452109</td><td>12.42</td><td>29.5</td><td><span className="badge-dot"></span>Active</td><td>2026-07-06 10:45</td></tr>
              <tr><td><b>FLOW-Babat_Hilir</b></td><td>95.40</td><td>210985</td><td>12.38</td><td>30.1</td><td><span className="badge-dot"></span>Active</td><td>2026-07-06 10:42</td></tr>
              <tr><td><b>FLOW-Ploso_Lamongan</b></td><td>140.20</td><td>451900</td><td>12.40</td><td>29.4</td><td><span className="badge-dot"></span>Active</td><td>2026-07-06 10:40</td></tr>
              <tr><td><b>FLOW-Babat_Hilir</b></td><td>92.10</td><td>210500</td><td>12.35</td><td>29.9</td><td><span className="badge-dot"></span>Active</td><td>2026-07-06 10:35</td></tr>
            </tbody>
          </table>
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
