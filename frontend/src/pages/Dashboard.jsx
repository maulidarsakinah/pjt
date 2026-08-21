import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import KPICard from "../components/KPICard";
import useAuth from "../contexts/useAuth";
import {
  getActiveAnomalySummary,
  getFlowStationData,
  getFlowStations,
} from "../services/api";
import {
  formatDateTime,
  formatNumber,
  formatTime,
  readingToRow,
} from "../utils/flowData";
import "./Dashboard.css";

const DashboardMap = lazy(() => import("../components/DashboardMap"));
const FlowAreaChart = lazy(() => import("../components/FlowAreaChart"));

const VCC_SERIES = [
  { dataKey: "vcc", name: "VCC", color: "#f59e0b", unit: "V" },
];
const FLOW_SERIES = [
  {
    dataKey: "ploso",
    name: "Flowmeter Lamongan",
    color: "#3A4BCF",
    unit: "m3/s",
  },
];
const VCC_DOMAIN = [12.2, 12.5];
const FLOW_DOMAIN = [85, 150];

const STATIC_STATIONS = [
  {
    id: "740",
    station_name: "Flowmeter Lamongan",
    kode_station: "PJT-FLOW-LMG",
    x: 112.2806,
    y: -7.0382,
  },
];

const STATIC_FLOW_CHART_DATA = [
  { time: "10:20", ploso: 139.8 },
  { time: "10:25", ploso: 140.4 },
  { time: "10:30", ploso: 141.1 },
  { time: "10:35", ploso: 141.6 },
  { time: "10:40", ploso: 142.0 },
  { time: "10:45", ploso: 142.5 },
];

const STATIC_VOLTAGE_CHART_DATA = [
  { time: "10:20", vcc: 12.38 },
  { time: "10:25", vcc: 12.39 },
  { time: "10:30", vcc: 12.40 },
  { time: "10:35", vcc: 12.41 },
  { time: "10:40", vcc: 12.42 },
  { time: "10:45", vcc: 12.42 },
];

const STATIC_LATEST_READINGS = [
  {
    station: "Flowmeter Lamongan",
    flow: "142.50",
    totalizer: "452109",
    vcc: "12.42",
    time: "2026-07-13 10:45",
  },
];

const dashboardKpiDescriptions = {
  sensor:
    "Jumlah sensor flowmeter yang aktif dan terdaftar pada sistem monitoring.",
  flow: "Rata-rata debit air berdasarkan data pembacaan terakhir pada dashboard.",
  anomaly:
    "Jumlah kondisi anomali atau peringatan yang perlu diperhatikan operator.",
};

function isFlowmeterLamongan(station) {
  const value =
    `${station?.station_name || ""} ${station?.kode_station || ""} ${station?.table_data || ""} ${station?.id || ""}`.toLowerCase();

  return (
    String(station?.id) === "740" ||
    value.includes("flowmeter lamongan") ||
    value.includes("flow_lamongan") ||
    value.includes("tb_flow_lamongan")
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

const DashboardMobileRow = ({ row }) => (
  <li>
    <div className="dashboard-mobile-log">
      <span className="dashboard-mobile-log-main">
        <span className="dashboard-mobile-log-topline">
          <time>{row.time}</time>
          <span className="dashboard-mobile-status success">Active</span>
        </span>
        <strong>{row.station}</strong>
        <span className="dashboard-mobile-log-meta">
          <span>Debit: {row.flow} m³/s</span>
          <span>VCC: {row.vcc} V</span>
        </span>
      </span>
    </div>
  </li>
);

const Dashboard = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [stations, setStations] = useState([]);
  const [liveReadings, setLiveReadings] = useState([]);
  const [activeAnomalyCount, setActiveAnomalyCount] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [areWidgetsReady, setAreWidgetsReady] = useState(false);
  const formatTimeTick = useCallback((value) => value, []);
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
      setError("");

      try {
        const [stationResponse, anomalyResponse] = await Promise.all([
          getFlowStations({ limit: 20, offset: 0 }),
          getActiveAnomalySummary(),
        ]);
        const stationRows = (stationResponse.data || []).filter(
          isFlowmeterLamongan,
        );
        const primaryStation = stationRows[0];
        let latestRows = [];
        if (primaryStation) {
          try {
            const response = await getFlowStationData(primaryStation.id, {
              mode: "latest",
              limit: 6,
            });
            const readings = response.data || [];
            latestRows = readings.map((reading) =>
              readingToRow(primaryStation, reading),
            );
          } catch {
            latestRows = [readingToRow(primaryStation, {})];
          }
        }

        if (isActive) {
          setStations(stationRows);
          setLiveReadings(latestRows);
          setActiveAnomalyCount(
            Number(anomalyResponse.data?.active_count || 0),
          );
        }
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message || "Gagal memuat data dashboard.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();
    const refreshId = window.setInterval(loadDashboard, 30_000);

    return () => {
      isActive = false;
      window.clearInterval(refreshId);
    };
  }, [isDemoUser]);

  const visibleStations = isDemoUser ? STATIC_STATIONS : stations;
  const chartReadings = useMemo(() => {
    if (!liveReadings.length) return [];
    return [...liveReadings].reverse();
  }, [liveReadings]);

  const latestReadings = useMemo(
    () =>
      liveReadings.length
        ? [liveReadings[0]].map((row) => ({
            station: row.stationName,
            flow:      row.schema === "new" ? formatNumber(row.flow_avg) : formatNumber(row.flow1),
            totalizer: row.schema === "new" ? formatNumber(row.totalizer_end, 0) : formatNumber(row.totalizer1, 0),
            vcc:       row.schema === "new" ? formatNumber(row.vcc_last) : formatNumber(row.vcc),
            time: formatDateTime(row.datetime),
          }))
        : STATIC_LATEST_READINGS,
    [liveReadings],
  );
  const flowChartData = useMemo(
    () =>
      chartReadings.length
        ? chartReadings.map((row) => ({
            time: formatTime(row.datetime),
            ploso: row.schema === "new" ? row.flow_avg : row.flow1,
          }))
        : STATIC_FLOW_CHART_DATA,
    [chartReadings],
  );
  const voltageChartData = useMemo(
    () =>
      chartReadings.length
        ? chartReadings.map((row) => ({
            time: formatTime(row.datetime),
            vcc: row.schema === "new" ? row.vcc_last : row.vcc,
          }))
        : STATIC_VOLTAGE_CHART_DATA,
    [chartReadings],
  );
  const averageFlow = useMemo(
    () =>
      flowChartData.reduce((sum, row) => sum + row.ploso, 0) /
      flowChartData.length,
    [flowChartData],
  );

  const averageVcc = useMemo(() => {
    const validValues = voltageChartData
      .map((row) => Number(row.vcc))
      .filter((v) => Number.isFinite(v));
    if (!validValues.length) return null;
    return (
      validValues.reduce((sum, v) => sum + v, 0) / validValues.length
    );
  }, [voltageChartData]);

  const deviceCondition = useMemo(() => {
    if (averageVcc === null) {
      return {
        title: "Menunggu Data",
        desc: "Belum ada pembacaan tegangan",
        icon: "fa-solid fa-battery-half",
      };
    }

    if (averageVcc >= 12 && averageVcc <= 15) {
      return {
        title: "Daya Baterai Optimal",
        desc: `Rata-rata suplai daya ${formatNumber(averageVcc, 2)}V`,
        icon: "fa-solid fa-battery-full",
      };
    }

    if (averageVcc < 12) {
      return {
        title: "Tegangan Rendah",
        desc: `Rata-rata suplai daya ${formatNumber(averageVcc, 2)}V (di bawah 12V)`,
        icon: "fa-solid fa-battery-quarter",
      };
    }

    return {
      title: "Tegangan Berlebih",
      desc: `Rata-rata suplai daya ${formatNumber(averageVcc, 2)}V (di atas 15V)`,
      icon: "fa-solid fa-triangle-exclamation",
    };
  }, [averageVcc]);

  return (
    <div className="view-section dashboard-page">
      {error && (
        <div
          className="panel"
          style={{ color: "#b91c1c", marginBottom: "12px" }}
        >
          {error}
        </div>
      )}
      <div className="kpi-grid dashboard-kpi-grid">
        <div className="dashboard-kpi-card-wrap">
          <button
            className="dashboard-kpi-info"
            type="button"
            aria-label="Info Lokasi Sensor Aktif"
          >
            <i className="fa-solid fa-info"></i>
            <span>{dashboardKpiDescriptions.sensor}</span>
          </button>
          <KPICard
            title="Lokasi Sensor Aktif"
            value={String(visibleStations.length || 1)}
            icon="fa-satellite-dish"
            badge="LIVE"
            accent="#3A4BCF"
            descIcon="fa-arrow-up"
            descClass="trend-up"
            descText={
              isLoading ? "Memuat data stasiun" : "Stasiun FLOW terdaftar"
            }
          />
        </div>
        <div className="dashboard-kpi-card-wrap">
          <button
            className="dashboard-kpi-info"
            type="button"
            aria-label="Info Rata-rata Debit Air"
          >
            <i className="fa-solid fa-info"></i>
            <span>{dashboardKpiDescriptions.flow}</span>
          </button>
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
        </div>
        <div className="dashboard-kpi-card-wrap">
          <button
            className="dashboard-kpi-info"
            type="button"
            aria-label="Info Peringatan Anomali"
          >
            <i className="fa-solid fa-info"></i>
            <span>{dashboardKpiDescriptions.anomaly}</span>
          </button>
          <KPICard
            title="Peringatan Anomali"
            value={String(activeAnomalyCount)}
            icon="fa-triangle-exclamation"
            badge={activeAnomalyCount > 0 ? "ALERT" : "CLEAR"}
            accent="#ef4444"
            descIcon={
              activeAnomalyCount > 0
                ? "fa-triangle-exclamation"
                : "fa-shield-heart"
            }
            descClass={activeAnomalyCount > 0 ? "alert-text" : "success-text"}
            descText={
              activeAnomalyCount > 0
                ? "Anomali aktif perlu ditangani"
                : "Semua sistem normal"
            }
          />
        </div>
      </div>

      <div className="dash-middle-grid">
        <section className="panel map-panel">
          <div className="panel-header dashboard-panel-header">
            <div>
              <div className="panel-title">Peta Distribusi Sensor</div>
              <div className="panel-subtitle">
                Sebaran node utama di wilayah monitoring Lamongan
              </div>
            </div>
          </div>
          <div className="map-badge">
            <i className="fa-solid fa-map-location-dot"></i> Peta Distribusi
            Sensor
          </div>
          {areWidgetsReady ? (
            <Suspense
              fallback={
                <div className="dashboard-widget-fallback">Memuat peta...</div>
              }
            >
              <DashboardMap stations={visibleStations} />
            </Suspense>
          ) : (
            <div className="dashboard-widget-skeleton dashboard-widget-skeleton--map" />
          )}
        </section>

        <div className="charts-container">
          <section className="panel chart-box">
            <div className="panel-header" style={{ marginBottom: "10px" }}>
              <div className="panel-title" style={{ fontSize: "14px" }}>
                Tegangan Sistem (VCC)
              </div>
            </div>
            <div className="chart-canvas-container">
              {areWidgetsReady ? (
                <Suspense
                  fallback={
                    <div className="dashboard-widget-fallback">
                      Memuat grafik...
                    </div>
                  }
                >
                  <FlowAreaChart
                    title=""
                    description=""
                    badge=""
                    data={voltageChartData}
                    xKey="time"
                    xTickFormatter={formatTimeTick}
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
            <div
              className="panel-title"
              style={{ fontSize: "14px", marginBottom: "16px" }}
            >
              Ringkasan Kondisi Perangkat
            </div>
            <div className="stat-summary">
              <div className="stat-icon">
                <i className={deviceCondition.icon}></i>
              </div>
              <div className="stat-details">
                <h4>{deviceCondition.title}</h4>
                <p>{deviceCondition.desc}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="panel">
        <div
          className="panel-header dashboard-panel-header"
          style={{ marginBottom: "10px" }}
        >
          <div className="panel-title">Debit Air Terbaru</div>
        </div>
        <div className="large-chart-container">
          {areWidgetsReady ? (
            <Suspense
              fallback={
                <div className="dashboard-widget-fallback">
                  Memuat grafik...
                </div>
              }
            >
              <FlowAreaChart
                title=""
                description=""
                badge=""
                data={flowChartData}
                xKey="time"
                xTickFormatter={formatTimeTick}
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
        {isMobile ? (
          <ul className="dashboard-mobile-list">
            {latestReadings.map((row) => (
              <DashboardMobileRow
                key={`${row.station}-${row.time}`}
                row={row}
              />
            ))}
          </ul>
        ) : (
          <div className="table-container dashboard-table-container">
            <table>
              <thead>
                <tr>
                  <th>LOKASI STASIUN</th>
                  <th>DEBIT (m3/s)</th>
                  <th>TOTALIZER (L)</th>
                  <th>VCC (V)</th>
                  <th>STATUS</th>
                  <th>TERAKHIR DIPERBARUI</th>
                </tr>
              </thead>
              <tbody>
                {latestReadings.map((row) => (
                  <tr key={`${row.station}-${row.time}`}>
                    <td>
                      <b>{row.station}</b>
                    </td>
                    <td>{row.flow}</td>
                    <td>{row.totalizer}</td>
                    <td>{row.vcc}</td>
                    <td>
                      <span className="badge-dot"></span>Active
                    </td>
                    <td>{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <div className="page-info">
            Menampilkan {latestReadings.length} entri
          </div>
          <div className="page-controls">
            <button className="page-btn">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="page-btn active">1</button>
            <button className="page-btn">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
