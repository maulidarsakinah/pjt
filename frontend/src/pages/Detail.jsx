import { memo, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DeferredFlowChart from '../components/DeferredFlowChart';
import useAuth from '../contexts/useAuth';
import {
  getFlowStationData,
  getFlowStations,
  prefetchFlowStationData,
} from '../services/api';
import {
  formatDateTime,
  formatNumber,
  formatTime,
  readingToRow,
} from '../utils/flowData';
import './Detail.css';

const generateDemoData = () => {
  const dates = ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'];
  const data = [];
  let totalizer = 445000;
  
  dates.forEach((date) => {
    for (let hour = 0; hour < 24; hour++) {
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      const debit = 135 + Math.random() * 8;
      const vcc = 12.3 + Math.random() * 0.3;
      const suhu = 27 + Math.random() * 3;
      totalizer += 150 + Math.random() * 50;
      
      data.push({
        id: `${date}-${timeStr}`,
        time: timeStr,
        date: date,
        debit: parseFloat(debit.toFixed(2)),
        totalizer: Math.round(totalizer),
        vcc: parseFloat(vcc.toFixed(2)),
        suhu: parseFloat(suhu.toFixed(1)),
        datetimeLabel: `${date} ${timeStr}`,
        timestamp: Date.parse(`${date}T${timeStr}:00+07:00`),
      });
    }
  });
  return data;
};

const ALL_DEMO_DATA = generateDemoData();
const DEMO_TABLE_DATA = [...ALL_DEMO_DATA].reverse();
const DETAIL_PAGE_SIZE = 10;
const LIVE_STATION_IDS = new Set(['697', '740']);
const FLOW_DOMAIN = [130, 150];
const TOTALIZER_DOMAIN = [450000, 453000];
const VCC_DOMAIN = [12.2, 12.6];
const TEMPERATURE_DOMAIN = [25, 32];
const FLOW_SERIES = [
  { dataKey: 'debit', name: 'Debit', color: '#3A4BCF', unit: 'm³/s' },
];
const TOTALIZER_SERIES = [
  { dataKey: 'totalizer', name: 'Totalizer', color: '#10b981', unit: 'L' },
];
const VCC_SERIES = [
  { dataKey: 'vcc', name: 'VCC', color: '#f59e0b', unit: 'V' },
];
const TEMPERATURE_SERIES = [
  { dataKey: 'suhu', name: 'Suhu', color: '#ef4444', unit: '°C' },
];

function buildHistoryRange() {
  const end = new Date();

  end.setSeconds(0, 0);

  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  return {
    mode: 'range',
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normalizeStationKey(value) {
  return String(value || '').trim().toLowerCase();
}

function stationMatchesKey(station, stationKey) {
  const normalizedKey = normalizeStationKey(stationKey);

  return [
    station.id,
    station.kode_station,
    station.station_name,
  ].some((value) => normalizeStationKey(value) === normalizedKey);
}

function mapLiveReading(station, reading, index) {
  const row = readingToRow(station, reading);

  return {
    id: `${station.id}-${reading.id ?? index}`,
    stationId: String(station.id),
    debit: row.flow1,
    totalizer: row.totalizer1,
    vcc: row.vcc,
    suhu: row.temp,
    time: formatTime(row.datetime),
    datetimeLabel: formatDateTime(row.datetime),
    timestamp: Date.parse(row.datetime || 0),
  };
}

function getPaginationItems(currentPage, pageCount) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis-end', pageCount];
  }

  if (currentPage >= pageCount - 2) {
    return [
      1,
      'ellipsis-start',
      pageCount - 2,
      pageCount - 1,
      pageCount,
    ];
  }

  return [
    1,
    'ellipsis-start',
    currentPage,
    'ellipsis-end',
    pageCount,
  ];
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${safeText.replaceAll('"', '""')}"`;
}

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

const DetailMobileRow = memo(({ row, locationName }) => (
  <li>
    <div className="detail-mobile-log">
      <span className="detail-mobile-log-main">
        <span className="detail-mobile-log-topline">
          <time>{row.datetimeLabel}</time>
          <span className="detail-mobile-status success">Active</span>
        </span>
        <strong>{locationName}</strong>
        <span className="detail-mobile-log-meta">
          <span>Debit: {formatNumber(row.debit)} m³/s</span>
          <span>VCC: {formatNumber(row.vcc)} V</span>
          <span className="detail-mobile-latency">
            Suhu: {formatNumber(row.suhu, 1)} °C
          </span>
        </span>
      </span>
    </div>
  </li>
));

const Detail = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const isMobile = useMediaQuery('(max-width: 760px)');
  const { stationKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = location.pathname.startsWith('/admin')
    ? '/admin/monitoring'
    : '/dashboard/monitoring';
  const navigationStation = location.state?.station;
  const [filterDate, setFilterDate] = useState('');
  const historyRange = useMemo(() => {
    if (filterDate) {
      const start = new Date(`${filterDate}T00:00:00`);
      const end = new Date(`${filterDate}T23:59:59.999`);
      return {
        mode: 'range',
        start: start.toISOString(),
        end: end.toISOString(),
      };
    }

    const navigationQuery = location.state?.historyQuery;

    if (
      navigationQuery?.mode === 'range' &&
      navigationQuery.start &&
      navigationQuery.end
    ) {
      return {
        mode: 'range',
        start: navigationQuery.start,
        end: navigationQuery.end,
      };
    }

    return buildHistoryRange();
  }, [location.state, filterDate]);
  const [station, setStation] = useState(() => (
    navigationStation && stationMatchesKey(navigationStation, stationKey)
      ? navigationStation
      : null
  ));
  const [liveTableData, setLiveTableData] = useState([]);
  const [liveChartData, setLiveChartData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loadedPage, setLoadedPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isDemoUser) {
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadStationDetail() {
      setIsLoading(true);
      setError('');

      try {
        let selectedStation = (
          navigationStation &&
          LIVE_STATION_IDS.has(String(navigationStation.id)) &&
          stationMatchesKey(navigationStation, stationKey)
        )
          ? navigationStation
          : null;

        if (!selectedStation) {
          const stationResponse = await getFlowStations(
            {
              limit: 100,
              offset: 0,
            },
            { signal: controller.signal }
          );
          selectedStation = (stationResponse.data || []).find(
            (candidate) => (
              LIVE_STATION_IDS.has(String(candidate.id)) &&
              stationMatchesKey(candidate, stationKey)
            )
          );
        }

        if (!selectedStation) {
          throw new Error('Stasiun tidak ditemukan.');
        }

        const dataResponse = await getFlowStationData(
          selectedStation.id,
          {
            ...historyRange,
            limit: DETAIL_PAGE_SIZE,
            offset: (page - 1) * DETAIL_PAGE_SIZE,
          },
          { signal: controller.signal }
        );
        const rows = (dataResponse.data || []).map((reading, index) => (
          mapLiveReading(selectedStation, reading, index)
        ));

        if (isActive) {
          const responseTotal = Number(dataResponse.total);
          const nextTotalRows = Number.isInteger(responseTotal)
            ? responseTotal
            : (
              (page - 1) * DETAIL_PAGE_SIZE +
              rows.length +
              (dataResponse.has_more ? 1 : 0)
            );

          setStation(selectedStation);
          setLiveTableData(rows);
          setTotalRows(nextTotalRows);
          setLoadedPage(page);
          setLiveChartData((currentRows) => {
            if (page === 1) {
              return [...rows].sort(
                (left, right) => left.timestamp - right.timestamp
              );
            }

            const rowsById = new Map(
              [
                ...currentRows.filter(
                  (row) => row.stationId === String(selectedStation.id)
                ),
                ...rows,
              ].map((row) => [row.id, row])
            );

            return Array.from(rowsById.values()).sort(
              (left, right) => left.timestamp - right.timestamp
            );
          });

          if (dataResponse.has_more) {
            void prefetchFlowStationData(
              selectedStation.id,
              {
                ...historyRange,
                limit: DETAIL_PAGE_SIZE,
                offset: page * DETAIL_PAGE_SIZE,
              }
            ).catch((prefetchError) => {
              if (prefetchError.name !== 'AbortError') {
                console.warn('Next detail page prefetch failed.', prefetchError);
              }
            });
          }
        }
      } catch (requestError) {
        if (isActive && requestError.name !== 'AbortError') {
          setStation(null);
          setLiveTableData([]);
          setTotalRows(0);
          setLoadedPage(0);
          setError(requestError.message || 'Gagal memuat detail stasiun.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadStationDetail();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    historyRange,
    isDemoUser,
    navigationStation,
    page,
    stationKey,
  ]);

  const locationName = isDemoUser
    ? stationKey || 'FLOW-Ploso'
    : station?.station_name || station?.kode_station || stationKey || '-';
  const tableData = isDemoUser ? DEMO_TABLE_DATA : liveTableData;
  const filteredAndSortedData = useMemo(() => {
    const searchString = searchTerm.trim().toLowerCase();
    const filteredData = tableData.filter((item) => {
      if (filterDate) {
        const itemDate = new Date(item.timestamp);
        const year = itemDate.getFullYear();
        const month = String(itemDate.getMonth() + 1).padStart(2, '0');
        const day = String(itemDate.getDate()).padStart(2, '0');
        const itemDateString = `${year}-${month}-${day}`;
        if (itemDateString !== filterDate) {
          return false;
        }
      }

      if (!searchString) {
        return true;
      }

      return (
        locationName.toLowerCase().includes(searchString) ||
        item.debit.toString().includes(searchString) ||
        item.totalizer.toString().includes(searchString) ||
        item.vcc.toString().includes(searchString) ||
        item.suhu.toString().includes(searchString) ||
        item.datetimeLabel.toLowerCase().includes(searchString) ||
        'active'.includes(searchString)
      );
    });

    if (sortConfig.key) {
      filteredData.sort((left, right) => {
        let leftValue = left[sortConfig.key];
        let rightValue = right[sortConfig.key];

        if (sortConfig.key === 'location') {
          leftValue = locationName;
          rightValue = locationName;
        }

        if (sortConfig.key === 'status') {
          leftValue = 'Active';
          rightValue = 'Active';
        }

        if (sortConfig.key === 'time') {
          leftValue = left.timestamp;
          rightValue = right.timestamp;
        }

        if (leftValue < rightValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }

        if (leftValue > rightValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }

        return 0;
      });
    }

    return filteredData;
  }, [locationName, searchTerm, sortConfig, tableData, filterDate]);
  const pageCount = isDemoUser
    ? Math.max(1, Math.ceil(filteredAndSortedData.length / DETAIL_PAGE_SIZE))
    : Math.max(1, Math.ceil(totalRows / DETAIL_PAGE_SIZE));
  const activePage = Math.min(page, pageCount);
  const paginationItems = getPaginationItems(activePage, pageCount);
  const pagedTableData = useMemo(() => {
    if (!isDemoUser) {
      return filteredAndSortedData;
    }

    const startIndex = (activePage - 1) * DETAIL_PAGE_SIZE;

    return filteredAndSortedData.slice(
      startIndex,
      startIndex + DETAIL_PAGE_SIZE
    );
  }, [activePage, filteredAndSortedData, isDemoUser]);
  const firstVisibleRow = filteredAndSortedData.length
    ? (activePage - 1) * DETAIL_PAGE_SIZE + 1
    : 0;
  const lastVisibleRow = Math.min(
    activePage * DETAIL_PAGE_SIZE,
    filteredAndSortedData.length
  );
  const chartData = useMemo(() => {
    if (isDemoUser) {
      if (filterDate) {
        return ALL_DEMO_DATA.filter((row) => row.date === filterDate);
      }
      return ALL_DEMO_DATA.slice(-24);
    }
    return liveChartData;
  }, [isDemoUser, liveChartData, filterDate]);
  const isTableLoading = !isDemoUser && isLoading && loadedPage !== page;

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc'
      ? 'desc'
      : 'asc';

    setPage(1);
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return (
        <i
          className="fa-solid fa-sort"
          style={{ color: '#cbd5e1', marginLeft: '6px' }}
        ></i>
      );
    }

    return (
      <i
        className={`fa-solid ${
          sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'
        }`}
        style={{ color: 'var(--text-primary)', marginLeft: '6px' }}
      ></i>
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Lokasi Stasiun',
      'Debit (m3/s)',
      'Totalizer (L)',
      'VCC (V)',
      'Suhu (C)',
      'Status',
      'Waktu',
    ];
    const rows = filteredAndSortedData.map((row) => [
      locationName,
      formatNumber(row.debit),
      formatNumber(row.totalizer, 0),
      formatNumber(row.vcc),
      formatNumber(row.suhu, 1),
      'Active',
      row.datetimeLabel,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = downloadUrl;
    anchor.download = `${station?.kode_station || stationKey || 'station'}-detail.csv`;
    anchor.click();
    window.URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="view-section">
      <button
        className="back-nav"
        type="button"
        onClick={() => navigate(backPath)}
      >
        <i className="fa-solid fa-arrow-left"></i> Kembali ke Monitoring
      </button>

      {error && (
        <div className="panel" style={{ color: '#b91c1c' }}>
          {error}
        </div>
      )}

      <div className="header-section">
        <h1>Detail Stasiun: {locationName}</h1>
        <p>Analisis historis dan tren operasional stasiun</p>
      </div>

      <div className="panel">
        <div
          className="panel-header"
          style={{
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
          }}
        >
          <div className="panel-title">Data Monitoring Historis (Detail)</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <i
                className="fa-solid fa-search"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                }}
              ></i>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(event) => {
                  setPage(1);
                  setSearchTerm(event.target.value);
                }}
                style={{
                  padding: '8px 14px 8px 32px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  width: '200px',
                }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={filterDate}
                onChange={(event) => {
                  setPage(1);
                  setFilterDate(event.target.value);
                }}
                title="Filter berdasarkan tanggal"
                style={{
                  padding: '7px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  color: filterDate ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
            <button
              className="btn btn-outline"
              style={{ fontSize: '12px', padding: '8px 14px' }}
              disabled={filteredAndSortedData.length === 0}
              onClick={handleExportCsv}
            >
              <i className="fa-solid fa-download"></i> Export CSV
            </button>
          </div>
        </div>

        <div
          className={`table-container detail-table-container ${
            isTableLoading ? 'detail-table-container--loading' : ''
          }`}
          aria-busy={isTableLoading}
        >
          {isTableLoading && (
            <div className="detail-table-progress" aria-hidden="true" />
          )}
          {isMobile ? (
            <ul className="detail-mobile-list">
              {pagedTableData.length > 0 ? (
                pagedTableData.map((row) => (
                  <DetailMobileRow
                    key={row.id}
                    row={row}
                    locationName={locationName}
                  />
                ))
              ) : (
                <li style={{ textAlign: 'center', padding: '30px' }}>
                  {isLoading ? 'Memuat detail stasiun...' : 'Tidak ada data yang cocok.'}
                </li>
              )}
            </ul>
          ) : (
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('location')} style={{ cursor: 'pointer' }}>
                    LOKASI STASIUN {getSortIcon('location')}
                  </th>
                  <th onClick={() => handleSort('debit')} style={{ cursor: 'pointer' }}>
                    DEBIT (m³/s) {getSortIcon('debit')}
                  </th>
                  <th onClick={() => handleSort('totalizer')} style={{ cursor: 'pointer' }}>
                    TOTALIZER (L) {getSortIcon('totalizer')}
                  </th>
                  <th onClick={() => handleSort('vcc')} style={{ cursor: 'pointer' }}>
                    VCC (V) {getSortIcon('vcc')}
                  </th>
                  <th onClick={() => handleSort('suhu')} style={{ cursor: 'pointer' }}>
                    SUHU (°C) {getSortIcon('suhu')}
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    STATUS {getSortIcon('status')}
                  </th>
                  <th onClick={() => handleSort('time')} style={{ cursor: 'pointer' }}>
                    WAKTU {getSortIcon('time')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedTableData.length > 0 ? (
                  pagedTableData.map((row) => (
                    <tr key={row.id}>
                      <td><b>{locationName}</b></td>
                      <td>{formatNumber(row.debit)}</td>
                      <td>{formatNumber(row.totalizer, 0)}</td>
                      <td>{formatNumber(row.vcc)}</td>
                      <td>{formatNumber(row.suhu, 1)}</td>
                      <td><span className="badge-dot"></span>Active</td>
                      <td>{row.datetimeLabel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                      {isLoading ? 'Memuat detail stasiun...' : 'Tidak ada data yang cocok.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination">
          <div className="page-info">
            {isDemoUser ? (
              <>
                Menampilkan {firstVisibleRow}-{lastVisibleRow} dari{' '}
                {filteredAndSortedData.length} entri
              </>
            ) : (
              <>
                Menampilkan {firstVisibleRow}-{lastVisibleRow} dari{' '}
                {totalRows} entri
                {isTableLoading ? ' · Memuat halaman...' : ''}
              </>
            )}
          </div>
          <div className="page-controls">
            <button
              className="page-btn"
              aria-label="Halaman sebelumnya"
              disabled={activePage === 1 || isLoading}
              onClick={() => setPage(Math.max(1, activePage - 1))}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            {paginationItems.map((item) => (
              typeof item === 'number' ? (
                <button
                  className={`page-btn ${item === activePage ? 'active' : ''}`}
                  aria-current={item === activePage ? 'page' : undefined}
                  disabled={isLoading}
                  key={item}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span className="detail-page-ellipsis" aria-hidden="true" key={item}>
                  …
                </span>
              )
            ))}
            <button
              className="page-btn"
              aria-label="Halaman berikutnya"
              disabled={activePage === pageCount || isLoading}
              onClick={() => setPage(Math.min(pageCount, activePage + 1))}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="detail-charts-grid">
        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>
              Grafik Debit Air (m³/s)
            </div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <DeferredFlowChart
              data={chartData}
              xKey="time"
              yDomain={isDemoUser ? FLOW_DOMAIN : undefined}
              height={180}
              showLegend={false}
              compact
              series={FLOW_SERIES}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>
              Grafik Totalizer (L)
            </div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <DeferredFlowChart
              data={chartData}
              xKey="time"
              yDomain={isDemoUser ? TOTALIZER_DOMAIN : undefined}
              height={180}
              showLegend={false}
              compact
              series={TOTALIZER_SERIES}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>
              Grafik Tegangan VCC (V)
            </div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <DeferredFlowChart
              data={chartData}
              xKey="time"
              yDomain={isDemoUser ? VCC_DOMAIN : undefined}
              height={180}
              showLegend={false}
              compact
              series={VCC_SERIES}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header" style={{ marginBottom: '10px' }}>
            <div className="panel-title" style={{ fontSize: '14px' }}>
              Grafik Suhu (°C)
            </div>
          </div>
          <div className="chart-canvas-container" style={{ height: '200px' }}>
            <DeferredFlowChart
              data={chartData}
              xKey="time"
              yDomain={isDemoUser ? TEMPERATURE_DOMAIN : undefined}
              height={180}
              showLegend={false}
              compact
              series={TEMPERATURE_SERIES}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;
