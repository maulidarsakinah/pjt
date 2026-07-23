import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KPICard from '../components/KPICard';
import useAuth from '../contexts/useAuth';
import { getAuditLogs } from '../services/api';
import './AuditLog.css';

const STATIC_AUDIT_LOGS = [
  {
    level: 'warn',
    time: '2026-07-13T00:23:30.482Z',
    service: 'pkl-api',
    env: 'development',
    trace_id: 'tx-ci-stations-flow-data',
    method: 'GET',
    path: '/api/stations/flow/740/data',
    ip: '::ffff:127.0.0.1',
    user_agent: 'node',
    status: 'failed',
    status_code: 401,
    error_source: 'application',
    error_code: 'Error',
    error_message: 'authentication required',
    message: 'request_error',
  },
  {
    level: 'info',
    time: '2026-07-13T00:19:48.878Z',
    service: 'pkl-api',
    env: 'development',
    trace_id: 'tx-ci-health',
    method: 'GET',
    path: '/api/health',
    ip: '::ffff:127.0.0.1',
    user_agent: 'node',
    status: 'success',
    status_code: 200,
    latency_ms: 25,
    message: 'request_completed',
  },
];

const PAGE_SIZE = 10;
const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];
const EMPTY_FILTERS = {
  date: '',
  level: 'all',
  method: 'all',
  status: 'all',
};
const LOG_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Asia/Jakarta',
});
const LOG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const auditKpiDescriptions = {
  total: 'Total seluruh aktivitas request API yang tercatat pada audit log.',
  success: 'Jumlah request yang berhasil diproses oleh server dengan status sukses.',
  failed: 'Jumlah request yang gagal, termasuk error autentikasi atau response kode 4xx/5xx.',
  latency: 'Rata-rata waktu respons API dari log yang memiliki data latency.',
};

function formatLogTime(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return LOG_TIME_FORMATTER.format(parsedDate);
}

function getStatusMeta(log) {
  if (log.status === 'success') {
    return { label: 'Success', className: 'success', icon: 'fa-circle-check' };
  }

  if (log.status_code >= 400) {
    return { label: 'Failed', className: 'failed', icon: 'fa-circle-xmark' };
  }

  return { label: 'Warning', className: 'warning', icon: 'fa-triangle-exclamation' };
}

function getLevelMeta(level) {
  if (level === 'warn') return { label: 'Warning', className: 'warning' };
  if (level === 'error') return { label: 'Error', className: 'failed' };
  return { label: 'Info', className: 'success' };
}

function matchesFilters(log, filters, searchQuery = '') {
  const dateParts = Object.fromEntries(
    LOG_DATE_FORMATTER
      .formatToParts(new Date(log.time))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const logDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const searchableText = [
    log.trace_id,
    log.method,
    log.path,
    log.message,
    log.error_code,
    log.error_message,
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    (!filters.date || logDate === filters.date) &&
    (filters.level === 'all' || log.level === filters.level) &&
    (filters.method === 'all' || log.method === filters.method) &&
    (filters.status === 'all' || log.status === filters.status) &&
    (!searchQuery || searchableText.includes(searchQuery.toLowerCase()))
  );
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function getLogKey(log) {
  return log.id || [
    log.trace_id,
    log.time,
    log.method,
    log.path,
    log.status_code,
    log.message,
  ].map((value) => value ?? '').join('|');
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis-end', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis-start', totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    'ellipsis-start',
    currentPage,
    'ellipsis-end',
    totalPages,
  ];
}

const AuditLogRow = memo(function AuditLogRow({ log, onSelect }) {
  const statusMeta = getStatusMeta(log);
  const levelMeta = getLevelMeta(log.level);

  return (
    <tr>
      <td>{formatLogTime(log.time)}</td>
      <td><span className={`audit-pill ${levelMeta.className}`}>{levelMeta.label}</span></td>
      <td><span className="audit-method-pill">{log.method || '-'}</span></td>
      <td className="audit-endpoint" title={log.path || undefined}>{log.path || '-'}</td>
      <td>
        <span className={`audit-status ${statusMeta.className}`}>
          <i className={`fa-solid ${statusMeta.icon}`}></i> {statusMeta.label}
        </span>
      </td>
      <td><b>{log.status_code ?? '-'}</b></td>
      <td className="audit-latency">{Number.isFinite(log.latency_ms) ? `${Math.round(log.latency_ms)} ms` : '-'}</td>
      <td className="audit-trace" title={log.trace_id || undefined}>{log.trace_id || '-'}</td>
      <td>
        <div className="audit-table-actions">
          <button className="audit-icon-button" title="Detail aktivitas" onClick={() => onSelect(log)}>
            <i className="fa-regular fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  );
});

function AuditTableSkeleton() {
  return SKELETON_ROWS.map((row) => (
    <tr className="audit-skeleton-row" key={row} aria-hidden="true">
      {Array.from({ length: 9 }, (_, column) => (
        <td key={`${row}-${column}`}><span className="audit-skeleton-cell"></span></td>
      ))}
    </tr>
  ));
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

const AuditKpiSection = memo(function AuditKpiSection({ isDemoUser, metrics, total }) {
  const [activeInfo, setActiveInfo] = useState(null);
  const infoTimerRef = useRef(null);

  const clearInfoTimer = useCallback(() => {
    if (infoTimerRef.current !== null) {
      window.clearTimeout(infoTimerRef.current);
      infoTimerRef.current = null;
    }
  }, []);

  const showInfo = useCallback((event) => {
    clearInfoTimer();
    setActiveInfo(event.currentTarget.dataset.kpiInfo);
  }, [clearInfoTimer]);

  const showInfoAfterIntent = useCallback((event) => {
    const infoId = event.currentTarget.dataset.kpiInfo;

    clearInfoTimer();
    infoTimerRef.current = window.setTimeout(() => {
      setActiveInfo(infoId);
      infoTimerRef.current = null;
    }, 450);
  }, [clearInfoTimer]);

  const hideInfo = useCallback(() => {
    clearInfoTimer();
    setActiveInfo((current) => (current === null ? current : null));
  }, [clearInfoTimer]);

  useEffect(() => () => clearInfoTimer(), [clearInfoTimer]);

  useEffect(() => {
    if (!activeInfo) {
      return undefined;
    }

    window.addEventListener('scroll', hideInfo, { capture: true, passive: true });
    window.addEventListener('resize', hideInfo);

    return () => {
      window.removeEventListener('scroll', hideInfo, true);
      window.removeEventListener('resize', hideInfo);
    };
  }, [activeInfo, hideInfo]);

  const items = [
    {
      id: 'total',
      title: 'Total Aktivitas',
      value: String(total),
      icon: 'fa-list-check',
      badge: 'LOG',
      accent: '#3A4BCF',
      descText: isDemoUser ? 'Data demo statis' : 'Sesuai filter aktif',
    },
    {
      id: 'success',
      title: 'Request Success',
      value: String(metrics.successCount),
      icon: 'fa-circle-check',
      badge: '200',
      accent: '#10b981',
      descText: 'Request berhasil diproses',
    },
    {
      id: 'failed',
      title: 'Request Failed',
      value: String(metrics.failedCount),
      icon: 'fa-shield-halved',
      badge: '401',
      accent: '#ef4444',
      descText: 'Butuh autentikasi valid',
    },
    {
      id: 'latency',
      title: 'Avg Latency',
      value: metrics.avgLatency ? String(Math.round(metrics.avgLatency)) : '-',
      unit: 'ms',
      icon: 'fa-gauge-high',
      badge: 'API',
      accent: '#06b6d4',
      descText: `${metrics.warningCount} warning terdeteksi`,
    },
  ];

  return (
    <div className="kpi-grid audit-kpi-grid">
      {items.map((item) => {
        const isActive = activeInfo === item.id;
        const tooltipId = `audit-kpi-tooltip-${item.id}`;

        return (
          <div className="audit-kpi-card-wrap" key={item.id}>
            <button
              className="audit-kpi-info"
              type="button"
              data-kpi-info={item.id}
              aria-label={`Info ${item.title}: ${auditKpiDescriptions[item.id]}`}
              aria-expanded={isActive}
              aria-describedby={isActive ? tooltipId : undefined}
              onMouseEnter={showInfoAfterIntent}
              onMouseLeave={hideInfo}
              onFocus={showInfo}
              onBlur={hideInfo}
              onClick={showInfo}
            >
              <i className="fa-solid fa-info"></i>
            </button>
            {isActive && (
              <div className="audit-kpi-tooltip" id={tooltipId} role="tooltip">
                {auditKpiDescriptions[item.id]}
              </div>
            )}
            <KPICard
              title={item.title}
              value={item.value}
              unit={item.unit}
              icon={item.icon}
              badge={item.badge}
              accent={item.accent}
              descText={item.descText}
            />
          </div>
        );
      })}
    </div>
  );
});

const AuditFilters = memo(function AuditFilters({ appliedFilters, isLoading, onApply, onReset }) {
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = Object.entries(appliedFilters).filter(([field, value]) => (
    field === 'date' ? Boolean(value) : value !== 'all'
  )).length;

  const updateDraftFilter = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = () => {
    onApply(draftFilters);
    setIsOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    onReset();
    setIsOpen(false);
  };

  return (
    <div className="audit-filter-panel">
      <button
        className="audit-filter-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="audit-filter-content"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>
          <i className="fa-solid fa-filter"></i>
          Filter
          {activeCount > 0 && <b>{activeCount}</b>}
        </span>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </button>
      <div className={`audit-filter-content ${isOpen ? 'is-open' : ''}`} id="audit-filter-content">
        <div className="audit-filter-grid">
          <div className="filter-group">
            <label>Date Range</label>
            <input type="date" value={draftFilters.date} onChange={(event) => updateDraftFilter('date', event.target.value)} />
          </div>
          <div className="filter-group">
            <label>Level</label>
            <select value={draftFilters.level} onChange={(event) => updateDraftFilter('level', event.target.value)}>
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Method</label>
            <select value={draftFilters.method} onChange={(event) => updateDraftFilter('method', event.target.value)}>
              <option value="all">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="OPTIONS">OPTIONS</option>
              <option value="HEAD">HEAD</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status Log</label>
            <select value={draftFilters.status} onChange={(event) => updateDraftFilter('status', event.target.value)}>
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="audit-filter-actions">
            <button className="btn btn-primary" onClick={applyFilters} disabled={isLoading}>Apply</button>
            <button className="btn btn-outline" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
});

const AuditSearch = memo(function AuditSearch({ isLoading, onCommit }) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const timerId = window.setTimeout(() => onCommit(inputValue.trim()), 300);
    return () => window.clearTimeout(timerId);
  }, [inputValue, onCommit]);

  return (
    <label className="audit-search">
      <i className={`fa-solid ${isLoading ? 'fa-hourglass-half' : 'fa-magnifying-glass'}`}></i>
      <input
        type="search"
        value={inputValue}
        maxLength="200"
        placeholder="Cari endpoint, trace ID, atau pesan..."
        aria-label="Cari audit log"
        onChange={(event) => setInputValue(event.target.value)}
      />
    </label>
  );
});

const AuditMobileLogRow = memo(function AuditMobileLogRow({ log, onSelect }) {
  const statusMeta = getStatusMeta(log);
  const levelMeta = getLevelMeta(log.level);

  return (
    <li>
      <button className="audit-mobile-log" type="button" onClick={() => onSelect(log)}>
        <span className="audit-mobile-log-main">
          <span className="audit-mobile-log-topline">
            <time>{formatLogTime(log.time)}</time>
            <span className={`audit-pill ${levelMeta.className}`}>{levelMeta.label}</span>
          </span>
          <strong>{log.path || '-'}</strong>
          <span className="audit-mobile-log-meta">
            <span className="audit-mobile-method">{log.method || '-'}</span>
            <span className={`audit-mobile-status ${statusMeta.className}`}>
              {statusMeta.label} · {log.status_code ?? '-'}
            </span>
            <span className="audit-mobile-latency">
              {Number.isFinite(log.latency_ms) ? `${Math.round(log.latency_ms)} ms` : '- ms'}
            </span>
          </span>
        </span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
    </li>
  );
});

const AuditResults = memo(function AuditResults({ error, isLoading, logs, onSelect }) {
  const isMobile = useMediaQuery('(max-width: 760px)');

  if (isMobile) {
    if (isLoading && logs.length === 0) {
      return (
        <ul className="audit-mobile-list" aria-busy="true">
          {SKELETON_ROWS.map((row) => <li className="audit-mobile-skeleton" key={row}></li>)}
        </ul>
      );
    }

    if (!isLoading && !error && logs.length === 0) {
      return (
        <div className="audit-empty-state audit-empty-state--mobile">
          <i className="fa-regular fa-folder-open"></i>
          <strong>Tidak ada log ditemukan</strong>
          <span>Ubah filter atau muat ulang data audit.</span>
        </div>
      );
    }

    return (
      <ul className="audit-mobile-list" aria-busy={isLoading}>
        {logs.map((log) => (
          <AuditMobileLogRow key={getLogKey(log)} log={log} onSelect={onSelect} />
        ))}
      </ul>
    );
  }

  return (
    <div className="audit-table-scroll-shell">
      <div className="table-container audit-table-container" tabIndex="0" aria-label="Tabel audit log, dapat digeser horizontal">
        <table className="audit-table" aria-busy={isLoading}>
          <colgroup>
            <col className="audit-col-time" />
            <col className="audit-col-level" />
            <col className="audit-col-method" />
            <col className="audit-col-endpoint" />
            <col className="audit-col-status" />
            <col className="audit-col-code" />
            <col className="audit-col-latency" />
            <col className="audit-col-trace" />
            <col className="audit-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Code</th>
              <th>Latency</th>
              <th>Trace ID</th>
              <th style={{ textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && logs.length === 0 && <AuditTableSkeleton />}
            {logs.map((log) => (
              <AuditLogRow key={getLogKey(log)} log={log} onSelect={onSelect} />
            ))}
            {!isLoading && !error && logs.length === 0 && (
              <tr>
                <td colSpan="9" className="audit-empty-state">
                  <i className="fa-regular fa-folder-open"></i>
                  <strong>Tidak ada log ditemukan</strong>
                  <span>Ubah filter atau muat ulang data audit.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

const AuditPagination = memo(function AuditPagination({
  hasMore,
  isDemoUser,
  isLoading,
  logsLength,
  offset,
  onOffsetChange,
  totalLogs,
}) {
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = isDemoUser ? 1 : Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));
  const paginationItems = getPaginationItems(pageNumber, totalPages);
  const firstVisibleRow = logsLength ? offset + 1 : 0;
  const lastVisibleRow = offset + logsLength;

  return (
    <div className="pagination">
      <div className="page-info">
        {isDemoUser
          ? `Menampilkan ${logsLength} dari ${STATIC_AUDIT_LOGS.length} log demo`
          : `Menampilkan ${firstVisibleRow}-${lastVisibleRow} dari ${totalLogs} log`}
      </div>
      <div className="page-controls">
        <button
          className="page-btn"
          aria-label="Halaman sebelumnya"
          disabled={isDemoUser || offset === 0 || isLoading}
          onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        {paginationItems.map((item) => (
          typeof item === 'number' ? (
            <button
              className={`page-btn ${item === pageNumber ? 'active' : ''}`}
              aria-current={item === pageNumber ? 'page' : undefined}
              key={item}
              disabled={isLoading}
              onClick={() => onOffsetChange((item - 1) * PAGE_SIZE)}
            >
              {item}
            </button>
          ) : (
            <span className="audit-page-ellipsis" aria-hidden="true" key={item}>...</span>
          )
        ))}
        <button
          className="page-btn"
          aria-label="Halaman berikutnya"
          disabled={isDemoUser || !hasMore || pageNumber >= totalPages || isLoading}
          onClick={() => onOffsetChange(offset + PAGE_SIZE)}
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
});

const AuditLog = () => {
  const { user } = useAuth();
  const isDemoUser = Boolean(user?.is_demo);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [liveLogs, setLiveLogs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (isDemoUser) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadLogs() {
      if (controller.signal.aborted) {
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response = await getAuditLogs({
          limit: PAGE_SIZE,
          offset,
          date: appliedFilters.date || undefined,
          level: appliedFilters.level === 'all' ? undefined : appliedFilters.level,
          method: appliedFilters.method === 'all' ? undefined : appliedFilters.method,
          status: appliedFilters.status === 'all' ? undefined : appliedFilters.status,
          search: searchQuery || undefined,
        }, { signal: controller.signal });

        if (!controller.signal.aborted) {
          const rows = Array.isArray(response.data) ? response.data.slice(0, PAGE_SIZE) : [];
          setLiveLogs(rows);
          setHasMore(Boolean(response.has_more));
          setTotalLogs(Number.isInteger(response.total) ? response.total : rows.length);
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError' && !controller.signal.aborted) {
          setLiveLogs([]);
          setHasMore(false);
          setTotalLogs(0);
          setError(requestError.message || 'Gagal memuat audit log.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    Promise.resolve().then(loadLogs);
    return () => controller.abort();
  }, [appliedFilters, isDemoUser, offset, refreshKey, searchQuery]);

  useEffect(() => {
    if (!selectedLog) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedLog(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  const filteredStaticLogs = useMemo(
    () => STATIC_AUDIT_LOGS.filter((log) => matchesFilters(log, appliedFilters, searchQuery)),
    [appliedFilters, searchQuery]
  );
  const auditLogs = isDemoUser ? filteredStaticLogs : liveLogs;
  const metrics = useMemo(() => {
    const summary = auditLogs.reduce((current, log) => ({
      successCount: current.successCount + (log.status === 'success' ? 1 : 0),
      failedCount: current.failedCount + (log.status === 'failed' ? 1 : 0),
      warningCount: current.warningCount + (log.level === 'warn' ? 1 : 0),
      latencyTotal: current.latencyTotal + (Number.isFinite(log.latency_ms) ? log.latency_ms : 0),
      latencyCount: current.latencyCount + (Number.isFinite(log.latency_ms) ? 1 : 0),
    }), {
      successCount: 0,
      failedCount: 0,
      warningCount: 0,
      latencyTotal: 0,
      latencyCount: 0,
    });

    return {
      ...summary,
      avgLatency: summary.latencyCount ? summary.latencyTotal / summary.latencyCount : 0,
    };
  }, [auditLogs]);

  const handleSelectLog = useCallback((log) => {
    setSelectedLog(log);
  }, []);

  const applyFilters = useCallback((filters) => {
    setOffset(0);
    setAppliedFilters({ ...filters });
    setRefreshKey((current) => current + 1);
  }, []);

  const resetFilters = useCallback(() => {
    setAppliedFilters(EMPTY_FILTERS);
    setOffset(0);
    setSearchQuery('');
    setSearchResetKey((current) => current + 1);
    setRefreshKey((current) => current + 1);
  }, []);

  const commitSearch = useCallback((query) => {
    setOffset(0);
    setSearchQuery((current) => (current === query ? current : query));
  }, []);

  const handleOffsetChange = useCallback((nextOffset) => {
    setOffset(nextOffset);
  }, []);

  const refreshLogs = () => {
    if (isDemoUser) {
      setError('');
      return;
    }

    setRefreshKey((current) => current + 1);
  };

  const exportLogs = () => {
    if (!auditLogs.length) {
      return;
    }

    const columns = [
      'time', 'level', 'service', 'env', 'trace_id', 'method', 'path', 'ip',
      'user_agent', 'status', 'status_code', 'latency_ms', 'error_source',
      'error_code', 'error_message', 'message',
    ];
    const csvRows = [
      columns.map(escapeCsvValue).join(','),
      ...auditLogs.map((log) => columns.map((column) => escapeCsvValue(log[column])).join(',')),
    ];
    const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedStatusMeta = selectedLog ? getStatusMeta(selectedLog) : null;

  return (
    <div className="view-section audit-log-page">
      <div className="header-section audit-log-header">
        <div>
          <h1>Audit Log</h1>
          <p>Riwayat request API, status autentikasi, dan trace aktivitas sistem.</p>
        </div>
        <button className="btn btn-outline" onClick={exportLogs} disabled={!auditLogs.length}>
          <i className="fa-solid fa-download"></i> Export Log
        </button>
      </div>

      <AuditKpiSection
        isDemoUser={isDemoUser}
        metrics={metrics}
        total={isDemoUser ? auditLogs.length : totalLogs}
      />

      <section className="panel audit-table-panel">
        <div className="panel-header audit-table-header">
          <div>
            <div className="panel-title">Log History</div>
            <div className="panel-subtitle">
              {isDemoUser ? 'Menampilkan data statis untuk sesi demo.' : 'Data terbaru dari backend, diurutkan dari waktu terbaru.'}
            </div>
          </div>
        </div>

        <AuditFilters
          appliedFilters={appliedFilters}
          isLoading={isLoading}
          onApply={applyFilters}
          onReset={resetFilters}
        />

        <div className="audit-table-tools">
          <AuditSearch key={searchResetKey} isLoading={isLoading} onCommit={commitSearch} />
        </div>

        {isLoading && <div className="audit-loading-bar" role="progressbar" aria-label="Memuat audit log"></div>}

        {error && (
          <div className="audit-feedback audit-feedback--error" role="alert">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
            <button type="button" onClick={refreshLogs}>Coba lagi</button>
          </div>
        )}

        <AuditResults error={error} isLoading={isLoading} logs={auditLogs} onSelect={handleSelectLog} />

        <AuditPagination
          hasMore={hasMore}
          isDemoUser={isDemoUser}
          isLoading={isLoading}
          logsLength={auditLogs.length}
          offset={offset}
          onOffsetChange={handleOffsetChange}
          totalLogs={totalLogs}
        />
      </section>

      {selectedLog && (
        <div className="audit-modal-overlay" onMouseDown={() => setSelectedLog(null)}>
          <div className="audit-detail-panel" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="audit-detail-header">
              <div>
                <span>Detail Aktivitas</span>
                <h3 id="audit-detail-title">{selectedLog.message || 'Aktivitas API'}</h3>
              </div>
              <button className="audit-close-button" aria-label="Tutup detail" onClick={() => setSelectedLog(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className={`audit-detail-visual ${selectedStatusMeta.className}`}>
              <i className={`fa-solid ${selectedStatusMeta.icon}`}></i>
              <div>
                <strong>{selectedStatusMeta.label}</strong>
                <span>{selectedLog.method} {selectedLog.path}</span>
              </div>
            </div>

            <div className="audit-detail-stack">
              <div className="audit-detail-item">
                <span>Status</span>
                <strong>{selectedLog.status} / HTTP {selectedLog.status_code}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Time</span>
                <strong>{formatLogTime(selectedLog.time)}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Trace ID</span>
                <strong>{selectedLog.trace_id || '-'}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Service & Environment</span>
                <strong>{selectedLog.service || '-'} / {selectedLog.env || '-'}</strong>
              </div>
              <div className="audit-detail-item">
                <span>IP Address</span>
                <strong>{selectedLog.ip || '-'}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Device & Browser</span>
                <strong><i className="fa-solid fa-terminal"></i> {selectedLog.user_agent || '-'}</strong>
              </div>
              {selectedLog.latency_ms !== undefined && (
                <div className="audit-detail-item">
                  <span>Latency</span>
                  <strong>{selectedLog.latency_ms} ms</strong>
                </div>
              )}
              {selectedLog.error_message && (
                <div className="audit-detail-item audit-detail-error">
                  <span>Error Detail</span>
                  <strong>{selectedLog.error_source}: {selectedLog.error_message}</strong>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
