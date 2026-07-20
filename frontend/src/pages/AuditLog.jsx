import { useMemo, useState } from 'react';
import KPICard from '../components/KPICard';
import './AuditLog.css';

const auditLogs = [
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

const auditKpiDescriptions = {
  total: 'Total seluruh aktivitas request API yang tercatat pada audit log.',
  success: 'Jumlah request yang berhasil diproses oleh server dengan status sukses.',
  failed: 'Jumlah request yang gagal, termasuk error autentikasi atau response kode 4xx/5xx.',
  latency: 'Rata-rata waktu respons API dari log yang memiliki data latency.',
};

function formatLogTime(value) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
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

const AuditLog = () => {
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = useMemo(() => auditLogs.filter((log) => {
    const levelMatch = levelFilter === 'all' || log.level === levelFilter;
    const statusMatch = statusFilter === 'all' || log.status === statusFilter;
    const methodMatch = methodFilter === 'all' || log.method === methodFilter;

    return levelMatch && statusMatch && methodMatch;
  }), [levelFilter, methodFilter, statusFilter]);

  const successCount = auditLogs.filter((log) => log.status === 'success').length;
  const failedCount = auditLogs.filter((log) => log.status === 'failed').length;
  const warningCount = auditLogs.filter((log) => log.level === 'warn').length;
  const avgLatency = auditLogs
    .filter((log) => Number.isFinite(log.latency_ms))
    .reduce((sum, log, _, rows) => sum + log.latency_ms / rows.length, 0);

  const resetFilters = () => {
    setLevelFilter('all');
    setStatusFilter('all');
    setMethodFilter('all');
  };

  return (
    <div className="view-section audit-log-page">
      <div className="header-section audit-log-header">
        <div>
          <h1>Audit Log</h1>
          <p>Riwayat request API, status autentikasi, dan trace aktivitas sistem.</p>
        </div>
        <button className="btn btn-outline">
          <i className="fa-solid fa-download"></i> Export Log
        </button>
      </div>

      <div className="kpi-grid audit-kpi-grid">
        <div className="audit-kpi-card-wrap">
          <button className="audit-kpi-info" type="button" aria-label="Info Total Aktivitas">
            <i className="fa-solid fa-info"></i>
            <span>{auditKpiDescriptions.total}</span>
          </button>
          <KPICard title="Total Aktivitas" value={String(auditLogs.length)} icon="fa-list-check" badge="LOG" accent="#3A4BCF" descText="Data dari service pkl-api" />
        </div>
        <div className="audit-kpi-card-wrap">
          <button className="audit-kpi-info" type="button" aria-label="Info Request Success">
            <i className="fa-solid fa-info"></i>
            <span>{auditKpiDescriptions.success}</span>
          </button>
          <KPICard title="Request Success" value={String(successCount)} icon="fa-circle-check" badge="200" accent="#10b981" descText="Request berhasil diproses" />
        </div>
        <div className="audit-kpi-card-wrap">
          <button className="audit-kpi-info" type="button" aria-label="Info Request Failed">
            <i className="fa-solid fa-info"></i>
            <span>{auditKpiDescriptions.failed}</span>
          </button>
          <KPICard title="Request Failed" value={String(failedCount)} icon="fa-shield-halved" badge="401" accent="#ef4444" descText="Butuh autentikasi valid" />
        </div>
        <div className="audit-kpi-card-wrap">
          <button className="audit-kpi-info" type="button" aria-label="Info Avg Latency">
            <i className="fa-solid fa-info"></i>
            <span>{auditKpiDescriptions.latency}</span>
          </button>
          <KPICard title="Avg Latency" value={avgLatency ? String(Math.round(avgLatency)) : '-'} unit="ms" icon="fa-gauge-high" badge="API" accent="#06b6d4" descText={`${warningCount} warning terdeteksi`} />
        </div>
      </div>

      <section className="panel audit-filter-panel">
        <div className="audit-filter-grid">
          <div className="filter-group">
            <label>Date Range</label>
            <input type="date" defaultValue="2026-07-13" />
          </div>
          <div className="filter-group">
            <label>Level</label>
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Method</label>
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
              <option value="all">All Methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status Log</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="audit-filter-actions">
            <button className="btn btn-primary">Apply</button>
            <button className="btn btn-outline" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </section>

      <section className="panel audit-table-panel">
        <div className="panel-header audit-table-header">
          <div>
            <div className="panel-title">Log History</div>
            <div className="panel-subtitle">Menampilkan trace request backend berdasarkan sample data tim API.</div>
          </div>
          <button className="btn btn-outline">
            <i className="fa-solid fa-rotate-right"></i> Refresh
          </button>
        </div>

        <div className="table-container audit-table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Code</th>
                <th>Trace ID</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const statusMeta = getStatusMeta(log);
                const levelMeta = getLevelMeta(log.level);

                return (
                  <tr key={log.trace_id}>
                    <td>{formatLogTime(log.time)}</td>
                    <td><span className={`audit-pill ${levelMeta.className}`}>{levelMeta.label}</span></td>
                    <td><span className="audit-method-pill">{log.method}</span></td>
                    <td className="audit-endpoint">{log.path}</td>
                    <td>
                      <span className={`audit-status ${statusMeta.className}`}>
                        <i className={`fa-solid ${statusMeta.icon}`}></i> {statusMeta.label}
                      </span>
                    </td>
                    <td><b>{log.status_code}</b></td>
                    <td className="audit-trace">{log.trace_id}</td>
                    <td>
                      <div className="audit-table-actions">
                        <button className="audit-icon-button" title="Detail aktivitas" onClick={() => setSelectedLog(log)}>
                          <i className="fa-regular fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="page-info">Menampilkan {filteredLogs.length} dari {auditLogs.length} log</div>
          <div className="page-controls">
            <button className="page-btn"><i className="fa-solid fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </section>

      {selectedLog && (
        <div className="audit-modal-overlay" onMouseDown={() => setSelectedLog(null)}>
          <div className="audit-detail-panel" onMouseDown={(event) => event.stopPropagation()}>
            <div className="audit-detail-header">
              <div>
                <span>Detail Aktivitas</span>
                <h3>{selectedLog.message}</h3>
              </div>
              <button className="audit-close-button" onClick={() => setSelectedLog(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className={`audit-detail-visual ${getStatusMeta(selectedLog).className}`}>
              <i className={`fa-solid ${getStatusMeta(selectedLog).icon}`}></i>
              <div>
                <strong>{getStatusMeta(selectedLog).label}</strong>
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
                <strong>{selectedLog.trace_id}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Service & Environment</span>
                <strong>{selectedLog.service} / {selectedLog.env}</strong>
              </div>
              <div className="audit-detail-item">
                <span>IP Address</span>
                <strong>{selectedLog.ip}</strong>
              </div>
              <div className="audit-detail-item">
                <span>Device & Browser</span>
                <strong><i className="fa-solid fa-terminal"></i> {selectedLog.user_agent}</strong>
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

            <button className="btn btn-outline audit-trace-button">
              <i className="fa-solid fa-route"></i> Trace User History
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
