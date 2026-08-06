import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../contexts/useAuth";
import {
  getFlowStationData,
  getFlowStations,
  prefetchFlowStationData,
} from "../services/api";
import {
  MapSkeleton,
  StationListSkeleton,
  TableRowsSkeleton,
} from "../components/PageSkeletons";
import { formatDateTime, formatNumber, readingToRow } from "../utils/flowData";
import "./Monitoring.css";

const MonitoringMap = lazy(() => import("../components/MonitoringMap"));

const DEMO_HISTORY_DATA = [
  {
    id: 1,
    station: "FLOW-Ploso_Lamongan",
    debit: 142.5,
    totalizer: 452109,
    vcc: 12.42,
    temp: 29.5,
    status: "Active",
    time: "2026-07-06 10:45",
  },
  {
    id: 2,
    station: "FLOW-Babat_Hilir",
    debit: 95.4,
    totalizer: 210985,
    vcc: 12.38,
    temp: 30.1,
    status: "Active",
    time: "2026-07-06 10:42",
  },
  {
    id: 3,
    station: "FLOW-Ploso_Lamongan",
    debit: 140.2,
    totalizer: 451900,
    vcc: 12.4,
    temp: 29.4,
    status: "Active",
    time: "2026-07-06 10:40",
  },
  {
    id: 4,
    station: "FLOW-Babat_Hilir",
    debit: 92.1,
    totalizer: 210500,
    vcc: 12.35,
    temp: 29.9,
    status: "Active",
    time: "2026-07-06 10:35",
  },
];

const DEMO_STATIONS = [
  {
    id: "ST-PLS-01",
    kode_station: "ST-PLS-01",
    station_name: "FLOW-Ploso_Lamongan",
    latest_debit: "142.5",
    latest_time: "2 menit yang lalu",
  },
  {
    id: "ST-BBT-02",
    kode_station: "ST-BBT-02",
    station_name: "FLOW-Babat_Hilir",
    latest_debit: "95.4",
    latest_time: "5 menit yang lalu",
  },
];

const DEFAULT_LOCATION = "all";
const DEFAULT_TIME_RANGE = "24h";
const HISTORY_PAGE_SIZE = 10;
const LIVE_STATION_IDS = new Set(["697", "740"]);

function buildRangeQuery(timeRange) {
  const end = new Date();
  const durationMs =
    timeRange === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const start = new Date(end.getTime() - durationMs);

  return {
    mode: "range",
    start: start.toISOString(),
    end: end.toISOString(),
    limit: 200,
    offset: 0,
  };
}

function buildDetailRangeQuery() {
  const end = new Date();

  end.setSeconds(0, 0);

  return {
    mode: "range",
    start: new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    end: end.toISOString(),
    limit: 10,
    offset: 0,
  };
}

function mapHistoryRow(station, reading, index) {
  const row = readingToRow(station, reading);
  const base = {
    id: `${station.id}-${reading.id ?? index}`,
    stationId: String(station.id),
    station: row.stationName,
    status: "Active",
    time: formatDateTime(row.datetime),
    timestamp: row.datetime,
  };

  if (row.schema === "new") {
    return {
      ...base,
      debit: row.flow_avg,
      totalizer: row.totalizer_end,
      vcc: row.vcc_last,
    };
  }

  return {
    ...base,
    debit: row.flow1,
    totalizer: row.totalizer1,
    vcc: row.vcc,
  };
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${safeText.replaceAll('"', '""')}"`;
}

function getPaginationItems(currentPage, pageCount) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis-end", pageCount];
  }

  if (currentPage >= pageCount - 2) {
    return [1, "ellipsis-start", pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, "ellipsis-start", currentPage, "ellipsis-end", pageCount];
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

const MonitoringMobileRow = memo(({ row }) => (
  <li>
    <div className="monitoring-mobile-log">
      <span className="monitoring-mobile-log-main">
        <span className="monitoring-mobile-log-topline">
          <time>{row.time}</time>
          <span className="monitoring-mobile-status success">{row.status}</span>
        </span>
        <strong>{row.station}</strong>
        <span className="monitoring-mobile-log-meta">
          <span>Debit: {formatNumber(row.debit)} m³/s</span>
          <span>VCC: {formatNumber(row.vcc)} V</span>
        </span>
      </span>
    </div>
  </li>
));

const StationCard = memo(
  ({ isDemoUser, latestReading, onPrefetch, onShowDetail, station }) => {
    const stationName =
      station.station_name || station.kode_station || `Station ${station.id}`;
    const latestDebit = isDemoUser
      ? station.latest_debit
      : formatNumber(latestReading?.debit);
    const latestTime = isDemoUser
      ? station.latest_time
      : latestReading?.time || "-";

    return (
      <div className="station-card">
        <div className="station-card-top">
          <div className="station-name">{stationName}</div>
          <span className="badge badge-normal">ACTIVE</span>
        </div>
        <div className="station-id">
          ID: {station.kode_station || station.id}
        </div>
        <div className="station-metric">
          <span className="station-metric-val">Debit: {latestDebit} m³/s</span>
          <span className="station-time">{latestTime}</span>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => onShowDetail(station)}
          onFocus={() => onPrefetch(station)}
          onMouseEnter={() => onPrefetch(station)}
        >
          Lihat Detail
        </button>
      </div>
    );
  },
);

const Monitoring = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const isMobile = useMediaQuery("(max-width: 760px)");
  const navigate = useNavigate();
  const location = useLocation();
  const detailQueriesRef = useRef(new Map());
  const detailBasePath = location.pathname.startsWith("/admin")
    ? "/admin/detail"
    : "/dashboard/detail";
  const [stations, setStations] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [locationFilter, setLocationFilter] = useState(DEFAULT_LOCATION);
  const [timeRange, setTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [appliedLocation, setAppliedLocation] = useState(DEFAULT_LOCATION);
  const [appliedTimeRange, setAppliedTimeRange] = useState(DEFAULT_TIME_RANGE);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDemoUser) {
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadMonitoringData() {
      setIsLoading(true);
      setError("");

      try {
        const stationResponse = await getFlowStations(
          { limit: 100, offset: 0 },
          { signal: controller.signal },
        );
        const stationRows = (stationResponse.data || []).filter((station) =>
          LIVE_STATION_IDS.has(String(station.id)),
        );
        const results = await Promise.allSettled(
          stationRows.map(async (station) => {
            const response = await getFlowStationData(
              station.id,
              buildRangeQuery(appliedTimeRange),
              { signal: controller.signal },
            );

            return (response.data || []).map((reading, index) =>
              mapHistoryRow(station, reading, index),
            );
          }),
        );
        const failedRequestCount = results.filter(
          (result) => result.status === "rejected",
        ).length;
        const rows = results
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => result.value)
          .sort(
            (left, right) =>
              Date.parse(right.timestamp || 0) -
              Date.parse(left.timestamp || 0),
          );

        if (isActive) {
          setStations(stationRows);
          setHistoryData(rows);

          if (failedRequestCount > 0) {
            setError(`Data dari ${failedRequestCount} stasiun gagal dimuat.`);
          }
        }
      } catch (requestError) {
        if (isActive && requestError.name !== "AbortError") {
          setStations([]);
          setHistoryData([]);
          setError(requestError.message || "Gagal memuat data monitoring.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadMonitoringData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [appliedTimeRange, isDemoUser]);

  const availableStations = isDemoUser ? DEMO_STATIONS : stations;
  const allHistoryData = isDemoUser ? DEMO_HISTORY_DATA : historyData;
  const visibleStations = useMemo(
    () =>
      appliedLocation === DEFAULT_LOCATION
        ? availableStations
        : availableStations.filter(
            (station) => String(station.id) === appliedLocation,
          ),
    [appliedLocation, availableStations],
  );
  const visibleHistoryData = useMemo(
    () =>
      appliedLocation === DEFAULT_LOCATION
        ? allHistoryData
        : allHistoryData.filter((row) => {
            if (isDemoUser) {
              const selectedStation = availableStations.find(
                (station) => String(station.id) === appliedLocation,
              );

              return row.station === selectedStation?.station_name;
            }

            return row.stationId === appliedLocation;
          }),
    [allHistoryData, appliedLocation, availableStations, isDemoUser],
  );
  const historyPageCount = Math.max(
    1,
    Math.ceil(visibleHistoryData.length / HISTORY_PAGE_SIZE),
  );
  const activeHistoryPage = Math.min(historyPage, historyPageCount);
  const historyPaginationItems = getPaginationItems(
    activeHistoryPage,
    historyPageCount,
  );
  const pagedHistoryData = useMemo(() => {
    const startIndex = (activeHistoryPage - 1) * HISTORY_PAGE_SIZE;

    return visibleHistoryData.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);
  }, [activeHistoryPage, visibleHistoryData]);
  const firstVisibleHistoryRow = visibleHistoryData.length
    ? (activeHistoryPage - 1) * HISTORY_PAGE_SIZE + 1
    : 0;
  const lastVisibleHistoryRow = Math.min(
    activeHistoryPage * HISTORY_PAGE_SIZE,
    visibleHistoryData.length,
  );
  const latestReadingByStation = useMemo(() => {
    const readings = new Map();
    const stationByName = new Map(
      availableStations.map((station) => [
        isDemoUser ? station.station_name : String(station.id),
        station,
      ]),
    );

    allHistoryData.forEach((row) => {
      const station = stationByName.get(
        isDemoUser ? row.station : row.stationId,
      );
      const key = station ? String(station.id) : null;

      if (key && !readings.has(key)) {
        readings.set(key, row);
      }
    });

    return readings;
  }, [allHistoryData, availableStations, isDemoUser]);

  const getDetailQuery = useCallback((station) => {
    const cacheKey = String(station.id);

    if (!detailQueriesRef.current.has(cacheKey)) {
      detailQueriesRef.current.set(cacheKey, buildDetailRangeQuery());
    }

    return detailQueriesRef.current.get(cacheKey);
  }, []);

  const handlePrefetchDetail = useCallback(
    (station) => {
      const prefetchTasks = [import("./Detail")];

      if (!isDemoUser) {
        prefetchTasks.push(
          prefetchFlowStationData(station.id, getDetailQuery(station)),
        );
      }

      void Promise.all(prefetchTasks).catch((error) => {
        console.warn("Detail prefetch failed.", error);
      });
    },
    [getDetailQuery, isDemoUser],
  );

  const handleShowDetail = useCallback(
    (station) => {
      const stationKey = isDemoUser
        ? station.station_name
        : station.kode_station || station.station_name;

      navigate(`${detailBasePath}/${encodeURIComponent(stationKey)}`, {
        state: {
          historyQuery: getDetailQuery(station),
          station,
        },
      });
    },
    [detailBasePath, getDetailQuery, isDemoUser, navigate],
  );

  const handleApplyFilter = () => {
    setHistoryPage(1);
    setAppliedLocation(locationFilter);
    setAppliedTimeRange(timeRange);
  };

  const handleResetFilter = () => {
    setLocationFilter(DEFAULT_LOCATION);
    setTimeRange(DEFAULT_TIME_RANGE);
    setHistoryPage(1);
    setAppliedLocation(DEFAULT_LOCATION);
    setAppliedTimeRange(DEFAULT_TIME_RANGE);
  };

  const handleExportCsv = () => {
    const headers = [
      "Lokasi Stasiun",
      "Debit (m3/s)",
      "Totalizer (L)",
      "VCC (V)",
      "Status",
      "Last Update",
    ];
    const rows = visibleHistoryData.map((row) => [
      row.station,
      formatNumber(row.debit),
      formatNumber(row.totalizer, 0),
      formatNumber(row.vcc),
      row.status,
      row.time,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = "monitoring-flow.csv";
    link.click();
    window.URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="view-section">
      {error && (
        <div className="panel" style={{ color: "#b91c1c" }}>
          {error}
        </div>
      )}

      <div className="header-section">
        <h1>Monitoring</h1>
        <p>Status jaringan sensor hidrologi real-time</p>
      </div>


      <div className="monitoring-layout">
        <div className="map-monitoring-container">
          <Suspense fallback={<MapSkeleton />}>
            <MonitoringMap />
          </Suspense>
        </div>

        <div className="station-list">
          <div className="station-list-header">
            <h3>Daftar Stasiun</h3>
            <span>{visibleStations.length} Ditemukan</span>
          </div>
          <div className="station-items">
            {isLoading && visibleStations.length === 0 ? (
              <StationListSkeleton />
            ) : visibleStations.length > 0 ? (
              visibleStations.map((station) => (
                <StationCard
                  isDemoUser={isDemoUser}
                  key={station.id}
                  latestReading={latestReadingByStation.get(String(station.id))}
                  onPrefetch={handlePrefetchDetail}
                  onShowDetail={handleShowDetail}
                  station={station}
                />
              ))
            ) : (
              <div>Tidak ada stasiun ditemukan.</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: "8px" }}>
        <div className="panel-header" style={{ marginBottom: "20px", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <div className="panel-title">Historical Monitoring Data</div>
          <div className="panel-subtitle">Menampilkan riwayat data hasil pemantauan sistem HydroTrack secara berkala.</div>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Lokasi Pemasangan</label>
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value={DEFAULT_LOCATION}>Semua Lokasi</option>
              {availableStations.map((station) => (
                <option key={station.id} value={String(station.id)}>
                  {station.station_name || station.kode_station}
                </option>
              ))}
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
            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value)}
            >
              <option value="24h">24 Jam Terakhir</option>
              <option value="7d">7 Hari Terakhir</option>
            </select>
          </div>

          <div className="filter-actions">
            <button
              className="btn btn-primary"
              onClick={handleApplyFilter}
              disabled={isLoading}
            >
              FILTER
            </button>
            <button
              className="btn btn-outline"
              onClick={handleResetFilter}
              disabled={isLoading}
            >
              RESET
            </button>
          </div>
        </div>

        <hr className="monitoring-divider" />

        <div style={{ marginBottom: "15px" }}>
          <button
            className="btn btn-outline"
            style={{ fontSize: "12px", padding: "8px 14px" }}
            onClick={handleExportCsv}
            disabled={visibleHistoryData.length === 0}
          >
            <i className="fa-solid fa-download"></i> EXPORT
          </button>
        </div>
        <div className="table-container">
          {isLoading && visibleHistoryData.length === 0 ? (
            <TableRowsSkeleton />
          ) : isMobile ? (
            <ul className="monitoring-mobile-list">
              {pagedHistoryData.length > 0 ? (
                pagedHistoryData.map((row) => (
                  <MonitoringMobileRow key={row.id} row={row} />
                ))
              ) : (
                <li style={{ padding: "24px", textAlign: "center" }}>
                  {isLoading
                    ? "Memuat data monitoring..."
                    : "Tidak ada data monitoring."}
                </li>
              )}
            </ul>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>LOKASI STASIUN</th>
                  <th>DEBIT (m³/s)</th>
                  <th>TOTALIZER (L)</th>
                  <th>VCC (V)</th>
                  <th>STATUS</th>
                  <th>LAST UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {pagedHistoryData.length > 0 ? (
                  pagedHistoryData.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.station}</b>
                      </td>
                      <td>{formatNumber(row.debit)}</td>
                      <td>{formatNumber(row.totalizer, 0)}</td>
                      <td>{formatNumber(row.vcc)}</td>
                      <td>
                        <span className="badge-dot"></span>
                        {row.status}
                      </td>
                      <td>{row.time}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      style={{ padding: "30px", textAlign: "center" }}
                    >
                      {isLoading
                        ? "Memuat data monitoring..."
                        : "Tidak ada data monitoring."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="pagination">
          <div className="page-info">
            Menampilkan {firstVisibleHistoryRow}-{lastVisibleHistoryRow} dari{" "}
            {visibleHistoryData.length} entri
          </div>
          <div className="page-controls">
            <button
              className="page-btn"
              aria-label="Halaman sebelumnya"
              disabled={activeHistoryPage === 1}
              onClick={() => setHistoryPage(Math.max(1, activeHistoryPage - 1))}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            {historyPaginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  className={`page-btn ${item === activeHistoryPage ? "active" : ""}`}
                  aria-current={item === activeHistoryPage ? "page" : undefined}
                  key={item}
                  onClick={() => setHistoryPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span
                  className="monitoring-page-ellipsis"
                  aria-hidden="true"
                  key={item}
                >
                  …
                </span>
              ),
            )}
            <button
              className="page-btn"
              aria-label="Halaman berikutnya"
              disabled={activeHistoryPage === historyPageCount}
              onClick={() =>
                setHistoryPage(
                  Math.min(historyPageCount, activeHistoryPage + 1),
                )
              }
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
