import "../pages/Dashboard.css";

const DashboardSkeleton = () => (
  <div className="view-section dashboard-page">
    <div className="kpi-grid dashboard-kpi-grid">
      {[0, 1, 2].map((item) => (
        <div className="panel dashboard-skeleton-card" key={item}>
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line skeleton-line--value" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>

    <div className="dash-middle-grid">
      <section className="panel map-panel">
        <div className="panel-header dashboard-panel-header">
          <div className="skeleton-line skeleton-line--title" />
        </div>
        <div className="dashboard-widget-skeleton dashboard-widget-skeleton--map" />
      </section>

      <div className="charts-container">
        <section className="panel chart-box">
          <div className="skeleton-line skeleton-line--title" />
          <div className="dashboard-widget-skeleton dashboard-widget-skeleton--chart" />
        </section>
        <section className="panel device-summary-panel">
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--short" />
        </section>
      </div>
    </div>

    <section className="panel">
      <div className="panel-header dashboard-panel-header">
        <div className="skeleton-line skeleton-line--title" />
      </div>
      <div className="dashboard-widget-skeleton dashboard-widget-skeleton--large-chart" />
      <div className="dashboard-table-skeleton">
        {[0, 1, 2].map((item) => (
          <div className="skeleton-line" key={item} />
        ))}
      </div>
    </section>
  </div>
);

export default DashboardSkeleton;
