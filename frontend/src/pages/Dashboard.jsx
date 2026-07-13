import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import KPICard from '../components/KPICard';
import useAuth from '../contexts/useAuth';
import { getFlowStationData, getFlowStations } from '../services/api';
import { formatDateTime, formatNumber, formatTime, readingToRow } from '../utils/flowData';
import './Dashboard.css';

const DashboardMap = lazy(() => import('../components/DashboardMap'));
const FlowAreaChart = lazy(() => import('../components/FlowAreaChart'));

const VCC_SERIES = [{ dataKey: 'vcc', name: 'VCC', color: '#f59e0b', unit: 'V' }];
const FLOW_SERIES = [{ dataKey: 'ploso', name: 'Flowmeter Lamongan', color: '#3A4BCF', unit: 'm3/s' }];
const VCC_DOMAIN = [12.2, 12.5];
const FLOW_DOMAIN = [85, 150];

const STATIC_STATIONS = [
  {
    id: 'flow-lamongan',
    station_name: 'Flowmeter Lamongan',
    kode_station: 'PJT-FLOW-LMG',
  },
];

const STATIC_FLOW_CHART_DATA = [
  { time: '00:00', ploso: 135.2, babat: 0 },
  { time: '02:00', ploso: 136.1, babat: 0 },
  { time: '04:00', ploso: 135.8, babat: 0 },
  { time: '06:00', ploso: 136.7, babat: 0 },
  { time: '08:00', ploso: 138.2, babat: 0 },
  { time: '10:00', ploso: 141.0, babat: 0 },
  { time: '12:00', ploso: 142.5, babat: 0 },
  { time: '14:00', ploso: 141.8, babat: 0 },
  { time: '16:00', ploso: 140.7, babat: 0 },
  { time: '18:00', ploso: 139.6, babat: 0 },
  { time: '20:00', ploso: 140.8, babat: 0 },
  { time: '22:00', ploso: 142.1, babat: 0 },
];

const STATIC_VOLTAGE_CHART_DATA = [
  { time: '06:00', vcc: 12.33 },
  { time: '08:00', vcc: 12.35 },
  { time: '10:00', vcc: 12.38 },
  { time: '12:00', vcc: 12.41 },
  { time: '14:00', vcc: 12.43 },
  { time: '16:00', vcc: 12.45 },
  { time: '18:00', vcc: 12.44 },
  { time: '20:00', vcc: 12.42 },
];

const STATIC_LATEST_READINGS = [
  { station: 'Flowmeter Lamongan', flow: '142.50', totalizer: '452109', vcc: '12.42', temp: '29.5', time: '2026-07-13 10:45' },
];

function isFlowmeterLamongan(station) {
  const value = `${station?.station_name || ''} ${station?.kode_station || ''} ${station?.table_data || ''}`.toLowerCase();

  return value.includes('flowmeter lamongan') || value.includes('flow_lamongan') || value.includes('tb_flow_lamongan');
}

const Dashboard = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const [stations, setStations] = useState([]);
  const [liveReadings, setLiveReadings] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [areWidgetsReady, setAreWidgetsReady] = useState(false);
  const formatHourTick = useCallback((value) => value.replace(':00', ''), []);
  const formatVoltageTick = useCallback((value) => `${value.toFixed(1)}V`, []);
  const formatFlowTick = useCallback((value) => `${value.toFixed(0)}`, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setAreWidgetsReady(true);
    }, 2500);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (isDemoUser) {
      return;
    }

    let isActive = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError('');

      try {
        const stationResponse = await getFlowStations({ limit: 20, offset: 0 });
        const stationRows = (stationResponse.data || []).filter(isFlowmeterLamongan);
        const latestRows = await Promise.all(
          stationRows.slice(0, 1).map(async (station) => {
            try {
              const response = await getFlowStationData(station.id, { mode: 'latest' });
              return readingToRow(station, response.data?.[0] || {});
            } catch {
              return readingToRow(station, {});
            }
          })
        );

        if (isActive) {
          setStations(stationRows);
          setLiveReadings(latestRows);
        }
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message || 'Gagal memuat data dashboard.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, [isDemoUser]);

  const visibleStations = isDemoUser ? STATIC_STATIONS : stations;
  const latestReadings = useMemo(() => (
    liveReadings.length
      ? liveReadings.map((row) => ({
        station: row.stationName,
        flow: formatNumber(row.flow1),
        totalizer: formatNumber(row.totalizer1, 0),
        vcc: formatNumber(row.vcc),
        temp: formatNumber(row.temp, 1),
        time: formatDateTime(row.datetime),
      }))
      : STATIC_LATEST_READINGS
  ), [liveReadings]);
  const flowChartData = useMemo(() => (
    liveReadings.length
      ? liveReadings.map((row) => ({
        time: formatTime(row.datetime),
        ploso: row.flow1,
      }))
      : STATIC_FLOW_CHART_DATA
  ), [liveReadings]);
  const voltageChartData = useMemo(() => (
    liveReadings.length
      ? liveReadings.map((row) => ({
        time: formatTime(row.datetime),
        vcc: row.vcc,
      }))
      : STATIC_VOLTAGE_CHART_DATA
  ), [liveReadings]);
  const averageFlow = useMemo(
    () => flowChartData.reduce((sum, row) => sum + row.ploso, 0) / flowChartData.length,
    [flowChartData]
  );

  return (
    <div className="view-section dashboard-page">
      {error && <div className="panel" style={{ color: '#b91c1c', marginBottom: '12px' }}>{error}</div>}
      <div className="kpi-grid dashboard-kpi-grid">
        <KPICard
          title="Lokasi Sensor Aktif"
          value={String(visibleStations.length || 1)}
          icon="fa-satellite-dish"
          badge="LIVE"
          accent="#3A4BCF"
          descIcon="fa-arrow-up"
          descClass="trend-up"
          descText={isLoading ? 'Memuat data stasiun' : 'Stasiun FLOW terdaftar'}
        />
        <KPICard
          title="Rata-rata Debit Air"
          value={formatNumber(averageFlow)}
          unit="m3/s"
          icon="fa-droplet"
          badge="STABLE"
          accent="#10b981"
          descIcon="fa-wave-square"
          descClass="success-text"
          descText="Berdasarkan data terakhir"
        />
        <KPICard
          title="Peringatan Anomali"
          value="0"
          icon="fa-triangle-exclamation"
          badge="CLEAR"
          accent="#ef4444"
          descIcon="fa-shield-heart"
          descClass="success-text"
          descText="Semua sistem normal"
        />
      </div>

      <div className="dash-middle-grid">
        <section className="panel map-panel">
          <div className="panel-header dashboard-panel-header">
            <div>
              <div className="panel-title">Peta Distribusi Sensor</div>
              <div className="panel-subtitle">Sebaran node utama di wilayah monitoring Lamongan</div>
            </div>
          </div>
          <div className="map-badge">
            <i className="fa-solid fa-map-location-dot"></i> Peta Distribusi Sensor
          </div>
          {areWidgetsReady ? (
            <Suspense fallback={<div className="dashboard-widget-fallback">Memuat peta...</div>}>
              <DashboardMap stations={visibleStations} />
            </Suspense>
          ) : (
            <div className="dashboard-widget-skeleton dashboard-widget-skeleton--map" />
          )}
        </section>

        <div className="charts-container">
          <section className="panel chart-box">
            <div className="panel-header" style={{ marginBottom: '10px' }}>
              <div className="panel-title" style={{ fontSize: '14px' }}>Tegangan Sistem (VCC)</div>
            </div>
            <div className="chart-canvas-container">
              {areWidgetsReady ? (
                <Suspense fallback={<div className="dashboard-widget-fallback">Memuat grafik...</div>}>
                  <FlowAreaChart
                    title=""
                    description=""
                    badge=""
                    data={voltageChartData}
                    xKey="time"
                    xTickFormatter={formatHourTick}
                    yTickFormatter={formatVoltageTick}
                    yDomain={VCC_DOMAIN}
                    height="100%"
                    showLegend={false}
                    compact
                    series={VCC_SERIES}
                  />
                </Suspense>
              ) : (
                <div className="dashboard-widget-skeleton dashboard-widget-skeleton--chart" />
              )}
            </div>
          </section>

          <section className="panel device-summary-panel">
            <div className="panel-title" style={{ fontSize: '14px', marginBottom: '16px' }}>Ringkasan Kondisi Perangkat</div>
            <div className="stat-summary">
              <div className="stat-icon"><i className="fa-solid fa-battery-full"></i></div>
              <div className="stat-details">
                <h4>Daya Baterai Optimal</h4>
                <p>Rata-rata suplai daya 12.4V</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header dashboard-panel-header" style={{ marginBottom: '10px' }}>
          <div className="panel-title">Debit Air Terbaru</div>
        </div>
        <div className="large-chart-container">
          {areWidgetsReady ? (
            <Suspense fallback={<div className="dashboard-widget-fallback">Memuat grafik...</div>}>
              <FlowAreaChart
                title=""
                description=""
                badge=""
                data={flowChartData}
                xKey="time"
                xTickFormatter={formatHourTick}
                yTickFormatter={formatFlowTick}
                yDomain={FLOW_DOMAIN}
                height="100%"
                showLegend={false}
                compact
                series={FLOW_SERIES}
              />
            </Suspense>
          ) : (
            <div className="dashboard-widget-skeleton dashboard-widget-skeleton--large-chart" />
          )}
        </div>
        <div className="table-container dashboard-table-container">
          <table>
            <thead>
              <tr>
                <th>LOKASI STASIUN</th>
                <th>DEBIT (m3/s)</th>
                <th>TOTALIZER (L)</th>
                <th>VCC (V)</th>
                <th>SUHU (C)</th>
                <th>STATUS</th>
                <th>LAST UPDATE</th>
              </tr>
            </thead>
            <tbody>
              {latestReadings.map((row) => (
                <tr key={`${row.station}-${row.time}`}>
                  <td><b>{row.station}</b></td>
                  <td>{row.flow}</td>
                  <td>{row.totalizer}</td>
                  <td>{row.vcc}</td>
                  <td>{row.temp}</td>
                  <td><span className="badge-dot"></span>Active</td>
                  <td>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <div className="page-info">Menampilkan {latestReadings.length} entri</div>
          <div className="page-controls">
            <button className="page-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
