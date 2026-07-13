import { useState, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import FlowAreaChart from '../components/FlowAreaChart';
import './Detail.css';

const chartData = [
  { time: '01:00', debit: 138.10, totalizer: 450420, vcc: 12.45, suhu: 28.5 },
  { time: '02:00', debit: 137.00, totalizer: 450605, vcc: 12.48, suhu: 28.2 },
  { time: '03:00', debit: 136.20, totalizer: 450780, vcc: 12.49, suhu: 27.9 },
  { time: '04:00', debit: 135.50, totalizer: 450950, vcc: 12.49, suhu: 27.8 },
  { time: '05:00', debit: 136.00, totalizer: 451125, vcc: 12.48, suhu: 28.0 },
  { time: '06:00', debit: 137.10, totalizer: 451320, vcc: 12.48, suhu: 28.5 },
  { time: '07:00', debit: 138.50, totalizer: 451510, vcc: 12.45, suhu: 29.0 },
  { time: '08:00', debit: 139.80, totalizer: 451705, vcc: 12.43, suhu: 29.2 },
  { time: '09:00', debit: 141.20, totalizer: 451900, vcc: 12.40, suhu: 29.4 },
  { time: '10:00', debit: 142.50, totalizer: 452109, vcc: 12.42, suhu: 29.5 },
];

const initialTableData = [...chartData].reverse();

const Detail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = location.pathname.startsWith('/admin') ? '/admin/monitoring' : '/dashboard/monitoring';
  const locationName = id || 'FLOW-Ploso';

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let filteredData = initialTableData.filter((item) => {
      const searchString = searchTerm.toLowerCase();
      return (
        locationName.toLowerCase().includes(searchString) ||
        item.debit.toString().includes(searchString) ||
        item.totalizer.toString().includes(searchString) ||
        item.vcc.toString().includes(searchString) ||
        item.suhu.toString().includes(searchString) ||
        item.time.toLowerCase().includes(searchString) ||
        'active'.includes(searchString)
      );
    });

    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'location') aVal = locationName;
        if (sortConfig.key === 'location') bVal = locationName;
        if (sortConfig.key === 'status') aVal = 'Active';
        if (sortConfig.key === 'status') bVal = 'Active';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filteredData;
  }, [searchTerm, sortConfig, locationName]);

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <i className="fa-solid fa-sort" style={{ color: '#cbd5e1', marginLeft: '6px' }}></i>;
    if (sortConfig.direction === 'asc') return <i className="fa-solid fa-sort-up" style={{ color: 'var(--text-primary)', marginLeft: '6px' }}></i>;
    return <i className="fa-solid fa-sort-down" style={{ color: 'var(--text-primary)', marginLeft: '6px' }}></i>;
  };

  return (
    <div className="view-section">
      <div className="back-nav" onClick={() => navigate(backPath)}>
        <i className="fa-solid fa-arrow-left"></i> Kembali ke Monitoring
      </div>
      
      <div className="header-section">
        <h1>Detail Stasiun: {locationName}</h1>
        <p>Analisis historis dan tren operasional stasiun</p>
      </div>

      <div className="panel">
        <div className="panel-header" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div className="panel-title">Data Monitoring Historis (Detail)</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '13px' }}></i>
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '8px 14px 8px 32px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', outline: 'none', width: '200px' }}
              />
            </div>
            <button className="btn btn-outline" style={{ fontSize: '12px', padding: '8px 14px' }}>
              <i className="fa-solid fa-download"></i> Export CSV
            </button>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('location')} style={{ cursor: 'pointer' }}>LOKASI STASIUN {getSortIcon('location')}</th>
                <th onClick={() => handleSort('debit')} style={{ cursor: 'pointer' }}>DEBIT (m³/s) {getSortIcon('debit')}</th>
                <th onClick={() => handleSort('totalizer')} style={{ cursor: 'pointer' }}>TOTALIZER (L) {getSortIcon('totalizer')}</th>
                <th onClick={() => handleSort('vcc')} style={{ cursor: 'pointer' }}>VCC (V) {getSortIcon('vcc')}</th>
                <th onClick={() => handleSort('suhu')} style={{ cursor: 'pointer' }}>SUHU (°C) {getSortIcon('suhu')}</th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>STATUS {getSortIcon('status')}</th>
                <th onClick={() => handleSort('time')} style={{ cursor: 'pointer' }}>WAKTU {getSortIcon('time')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((row) => (
                  <tr key={row.time}>
                    <td><b>{locationName}</b></td>
                    <td>{row.debit.toFixed(2)}</td>
                    <td>{row.totalizer}</td>
                    <td>{row.vcc.toFixed(2)}</td>
                    <td>{row.suhu.toFixed(1)}</td>
                    <td><span className="badge-dot"></span>Active</td>
                    <td>2026-07-06 {row.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>Tidak ada data yang cocok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <div className="page-info">Menampilkan 1-{filteredAndSortedData.length} dari {filteredAndSortedData.length} entri</div>
          <div className="page-controls">
            <button className="page-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </div>

      <div className="detail-charts-grid">
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>Grafik Debit Air (m³/s)</div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <FlowAreaChart
              data={chartData}
              xKey="time"
              yDomain={[130, 150]}
              height={180}
              showLegend={false}
              compact
              series={[{ dataKey: 'debit', name: 'Debit', color: '#3A4BCF', unit: 'm³/s' }]}
            />
          </div>
        </div>
        
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>Grafik Totalizer (L)</div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <FlowAreaChart
              data={chartData}
              xKey="time"
              yDomain={[450000, 453000]}
              height={180}
              showLegend={false}
              compact
              series={[{ dataKey: 'totalizer', name: 'Totalizer', color: '#10b981', unit: 'L' }]}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>Grafik Tegangan VCC (V)</div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <FlowAreaChart
              data={chartData}
              xKey="time"
              yDomain={[12.2, 12.6]}
              height={180}
              showLegend={false}
              compact
              series={[{ dataKey: 'vcc', name: 'VCC', color: '#f59e0b', unit: 'V' }]}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>Grafik Suhu (°C)</div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <FlowAreaChart
              data={chartData}
              xKey="time"
              yDomain={[25, 32]}
              height={180}
              showLegend={false}
              compact
              series={[{ dataKey: 'suhu', name: 'Suhu', color: '#ef4444', unit: '°C' }]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;
