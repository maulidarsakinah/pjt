import "./PageSkeletons.css";

const SkeletonLine = ({ className = "" }) => (
  <div className={`page-skeleton-line ${className}`} aria-hidden="true" />
);

export const StationListSkeleton = ({ count = 2 }) => (
  <div className="station-skeleton-list" aria-label="Memuat data stasiun">
    {Array.from({ length: count }, (_, index) => (
      <div className="station-card station-skeleton-card" key={index}>
        <SkeletonLine className="page-skeleton-line--title" />
        <SkeletonLine className="page-skeleton-line--short" />
        <SkeletonLine />
        <div className="page-skeleton-button" />
      </div>
    ))}
  </div>
);

export const TableRowsSkeleton = ({ columns = 7, rows = 10 }) => (
  <div
    className="table-skeleton"
    style={{ "--skeleton-columns": columns }}
    aria-label="Memuat data tabel"
  >
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div className="table-skeleton-row" key={rowIndex}>
        {Array.from({ length: columns }, (_, columnIndex) => (
          <SkeletonLine
            className={columnIndex === 0 ? "page-skeleton-line--title" : ""}
            key={columnIndex}
          />
        ))}
      </div>
    ))}
  </div>
);

export const MapSkeleton = () => (
  <div className="map-skeleton" aria-label="Memuat peta">
    <div className="map-skeleton-pin" />
    <SkeletonLine className="page-skeleton-line--map-label" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="chart-skeleton" aria-label="Memuat grafik">
    <SkeletonLine className="page-skeleton-line--chart-title" />
    <div className="chart-skeleton-bars" aria-hidden="true">
      {[38, 62, 48, 78, 56, 88, 66].map((height, index) => (
        <span style={{ height: `${height}%` }} key={index} />
      ))}
    </div>
  </div>
);

export const MonitoringSkeleton = () => (
  <div
    className="view-section page-skeleton-view"
    aria-label="Memuat halaman monitoring"
  >
    <div className="page-skeleton-heading">
      <SkeletonLine className="page-skeleton-line--heading" />
      <SkeletonLine className="page-skeleton-line--subtitle" />
    </div>
    <div className="filter-section page-skeleton-filter">
      {[0, 1, 2].map((item) => (
        <div className="page-skeleton-filter-field" key={item}>
          <SkeletonLine className="page-skeleton-line--short" />
          <div className="page-skeleton-input" />
        </div>
      ))}
    </div>
    <div className="monitoring-layout">
      <div className="map-monitoring-container">
        <MapSkeleton />
      </div>
      <div className="station-list">
        <div className="station-list-header">
          <SkeletonLine className="page-skeleton-line--title" />
        </div>
        <div className="station-items">
          <StationListSkeleton />
        </div>
      </div>
    </div>
    <div className="panel">
      <SkeletonLine className="page-skeleton-line--heading" />
      <TableRowsSkeleton />
    </div>
  </div>
);

export const DetailSkeleton = () => (
  <div
    className="view-section page-skeleton-view"
    aria-label="Memuat detail stasiun"
  >
    <SkeletonLine className="page-skeleton-line--short" />
    <div className="page-skeleton-heading">
      <SkeletonLine className="page-skeleton-line--heading" />
      <SkeletonLine className="page-skeleton-line--subtitle" />
    </div>
    <div className="panel">
      <SkeletonLine className="page-skeleton-line--heading" />
      <TableRowsSkeleton />
    </div>
    <div className="detail-charts-grid">
      {[0, 1, 2, 3].map((item) => (
        <div className="panel" key={item}>
          <ChartSkeleton />
        </div>
      ))}
    </div>
  </div>
);
