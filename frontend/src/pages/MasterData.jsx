import { useState, useEffect, useMemo } from "react";
import KPICard from "../components/KPICard";
import { getMasterStations, createMasterStation } from "../services/api";
import "./MasterData.css";

const columnsSchema = [
  { name: "kode_station", type: "text", label: "Kode Station" },
  { name: "nama", type: "text", label: "Nama" },
  { name: "x", type: "number", label: "X" },
  { name: "y", type: "number", label: "Y" },
  { name: "z", type: "number", label: "Z" },
  { name: "id_desa", type: "number", label: "ID Desa" },
  { name: "WaterLevel", type: "number", label: "WaterLevel" },
  { name: "Rainfall", type: "number", label: "Rainfall" },
  { name: "Repeater", type: "number", label: "Repeater" },
  { name: "Master", type: "number", label: "Master" },
  { name: "Sub", type: "number", label: "Sub" },
  { name: "Branch", type: "number", label: "Branch" },
  { name: "GSMRainfall", type: "number", label: "GSMRainfall" },
  { name: "GSMWaterlevel", type: "number", label: "GSMWaterlevel" },
  { name: "TableData", type: "text", label: "TableData" },
  { name: "indexhuluhilir", type: "number", label: "indexhuluhilir" },
  { name: "nostation", type: "text", label: "nostation" },
  { name: "clock", type: "number", label: "clock" },
  { name: "validpos", type: "text", label: "validpos" },
  { name: "objecttype", type: "text", label: "objecttype" },
  { name: "SIAGAWaterlevel", type: "text", label: "SIAGAWaterlevel" },
  { name: "SIAGADisch", type: "text", label: "SIAGADisch" },
  { name: "ws", type: "number", label: "ws" },
  { name: "wl_decimal_num", type: "number", label: "wl_decimal_num" },
  { name: "visible", type: "text", label: "visible" },
  { name: "enabled", type: "number", label: "enabled" },
  { name: "GSMWQMS", type: "number", label: "GSMWQMS" },
  { name: "TableDataForecast", type: "text", label: "TableDataForecast" },
  { name: "hasForecast", type: "number", label: "hasForecast" },
  { name: "hasWLOffset", type: "number", label: "hasWLOffset" },
  { name: "WLOffset", type: "number", label: "WLOffset" },
  { name: "history_nomor", type: "text", label: "history_nomor" },
  { name: "provider", type: "text", label: "provider" },
  { name: "sigab_enabled", type: "number", label: "sigab_enabled" },
  { name: "stastion_type", type: "text", label: "stastion_type" },
  { name: "aq_location_identifier", type: "number", label: "aq_location_identifier" },
  { name: "id_api", type: "text", label: "id_api" },
  { name: "template_api", type: "text", label: "template_api" },
  { name: "GSMINSTR", type: "number", label: "GSMINSTR" },
  { name: "GSMFLOW", type: "number", label: "GSMFLOW" },
  { name: "resolution", type: "text", label: "resolution" }
];

const MasterData = () => {
  const [selectedStation, setSelectedStation] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const limit = 10;

  const fetchStations = () => {
    setLoading(true);
    getMasterStations({ limit, offset: (page - 1) * limit })
      .then((res) => {
        setStations(res.data || []);
        setTotal(res.total || 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch master stations:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStations();
  }, [page]);

  const handleAddChange = (e) => {
    const { name, value, type } = e.target;
    // Basic sanitization
    let val = value;
    if (type === "number") {
      val = value === "" ? "" : Number(value);
    }
    setAddFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    createMasterStation(addFormData)
      .then(() => {
        alert("Data successfully added!");
        setIsAddModalOpen(false);
        setAddFormData({});
        fetchStations();
      })
      .catch(err => {
        alert("Failed to add data: " + err.message);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  // useEffect handled above

  const summary = useMemo(() => {
    return {
      total: total,
      active: stations.filter((s) => s.enabled === 1).length,
      flowMqtt: stations.filter((s) => s.stastion_type === "FLOW_MQTT").length,
      flowApi: stations.filter((s) => s.stastion_type === "FLOW_API").length,
    };
  }, [stations, total]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const firstShown = total > 0 ? (page - 1) * limit + 1 : 0;
  const lastShown = Math.min(page * limit, total);

  const visiblePages = useMemo(() => {
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }

    const arr = [];
    if (start > 2) arr.push(1);
    for (let i = start; i <= end; i++) {
      arr.push(i);
    }
    if (end < totalPages - 1) arr.push(totalPages);
    return Array.from(new Set(arr)).sort((a, b) => a - b);
  }, [page, totalPages]);

  const travelToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return (
    <div className="view-section master-data-page">
      <div className="header-section">
        <h1>Master Data</h1>
        <p>Pengelolaan data entitas dan konfigurasi sistem HydroTrack</p>
      </div>

      <div className="master-kpi-grid">
        <KPICard
          title="TOTAL STATION"
          value={summary.total}
          icon="fa-database"
          descText="Total seluruh entitas terdaftar."
          accent="#3A4BCF"
        />
        <KPICard
          title="STATION AKTIF"
          value={summary.active}
          icon="fa-satellite-dish"
          descText="Entitas dengan status online (enabled)."
          accent="#10B981"
        />
        <KPICard
          title="FLOW MQTT"
          value={summary.flowMqtt}
          icon="fa-network-wired"
          descText="Entitas dengan tipe aliran MQTT."
          accent="#F59E0B"
        />
        <KPICard
          title="FLOW API"
          value={summary.flowApi}
          icon="fa-cloud-arrow-down"
          descText="Entitas dengan tipe aliran API."
          accent="#8B5CF6"
        />
      </div>

      <section className="panel master-table-panel">
        <div className="master-table-header">
          <div className="panel-title">Pengelolaan Master Data</div>
          <div className="panel-subtitle">
            Menampilkan dan mengelola data entitas utama yang terhubung pada dashboard HydroTrack.
          </div>
        </div>

        <div className="master-table-tools">
          <div className="master-filter-grid">
            <div className="master-filter-group">
              <label>Jenis Data</label>
              <select defaultValue="">
                <option value="">Semua Jenis</option>
                <option value="WILAYAH">WILAYAH</option>
                <option value="LOKASI">LOKASI</option>
                <option value="SENSOR">SENSOR</option>
                <option value="PARAMETER">PARAMETER</option>
              </select>
            </div>
            <div className="master-filter-group">
              <label>Status Perangkat</label>
              <select defaultValue="">
                <option value="">Semua Status</option>
                <option value="1">Aktif</option>
                <option value="0">Non-aktif</option>
              </select>
            </div>
            <div className="master-filter-actions">
              <button className="btn btn-primary" type="button">
                FILTER
              </button>
              <button className="btn btn-outline" type="button">
                RESET
              </button>
            </div>
          </div>
          <div className="master-filter-actions">
            <button className="btn btn-primary" type="button" onClick={() => setIsAddModalOpen(true)}>
              <i className="fa-solid fa-plus"></i> TAMBAH DATA
            </button>
            <button className="btn btn-outline" type="button">
              <i className="fa-solid fa-download"></i> EXPORT
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>KODE STATION</th>
                <th>ID DESA</th>
                <th>NAMA</th>
                <th>STATION TYPE</th>
                <th>STATUS</th>
                <th style={{ textAlign: "center" }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                    Loading...
                  </td>
                </tr>
              ) : stations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                    No data found.
                  </td>
                </tr>
              ) : (
                stations.map((station) => (
                  <tr key={station.id}>
                    <td>
                      <b>{station.kode_station}</b>
                    </td>
                    <td>{station.id_desa || "-"}</td>
                    <td>{station.nama}</td>
                    <td>
                      <span className="badge badge-normal">{station.stastion_type}</span>
                    </td>
                    <td>
                      {station.enabled === 1 ? (
                        <span style={{ color: "var(--success-color)", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="badge-dot" style={{ backgroundColor: "var(--success-color)" }}></span> Active
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger-color)", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="badge-dot" style={{ backgroundColor: "var(--danger-color)" }}></span> Non-active
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: "12px" }}
                        onClick={() => setSelectedStation(station)}
                      >
                        <i className="fa-regular fa-eye"></i> Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <nav className="pagination" aria-label="Navigasi halaman data">
          <div className="page-info">
            Menampilkan {firstShown}–{lastShown} dari {total} data
          </div>
          <div className="page-controls">
            <button
              className="page-btn"
              type="button"
              disabled={page === 1 || loading}
              onClick={() => travelToPage(page - 1)}
              aria-label="Halaman sebelumnya"
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            {visiblePages.map((pageNumber, index) => {
              const previous = visiblePages[index - 1];
              return (
                <span className="master-page-item" key={pageNumber}>
                  {previous && pageNumber - previous > 1 && (
                    <span className="master-page-gap">…</span>
                  )}
                  <button
                    className={`page-btn ${pageNumber === page ? "active" : ""}`}
                    type="button"
                    onClick={() => travelToPage(pageNumber)}
                    aria-current={pageNumber === page ? "page" : undefined}
                  >
                    {pageNumber}
                  </button>
                </span>
              );
            })}
            <button
              className="page-btn"
              type="button"
              disabled={page === totalPages || loading}
              onClick={() => travelToPage(page + 1)}
              aria-label="Halaman selanjutnya"
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </nav>
      </section>

      {selectedStation && (
        <div
          className="master-detail-modal-overlay"
          onClick={() => setSelectedStation(null)}
        >
          <div
            className="master-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="master-detail-header">
              <h3>
                Detail Data: {selectedStation.kode_station} - {selectedStation.nama}
              </h3>
              <button
                className="master-close-button"
                onClick={() => setSelectedStation(null)}
                title="Tutup Detail"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="master-detail-content">
              {Object.entries(selectedStation).map(([key, value]) => (
                <div className="master-detail-item" key={key}>
                  <span>{key}</span>
                  <strong>{value !== "" && value !== null ? value.toString() : "-"}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="master-detail-modal-overlay" onClick={() => !isSubmitting && setIsAddModalOpen(false)}>
          <div className="master-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="master-detail-header">
              <h3>Tambah Data Station</h3>
              <button
                className="master-close-button"
                onClick={() => !isSubmitting && setIsAddModalOpen(false)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="master-detail-content">
                {columnsSchema.map((col) => (
                  <div className="master-filter-group" key={col.name} style={{ marginBottom: "10px" }}>
                    <label>{col.label}</label>
                    <input
                      type={col.type}
                      name={col.name}
                      value={addFormData[col.name] !== undefined ? addFormData[col.name] : ""}
                      onChange={handleAddChange}
                      className="form-control"
                      style={{ height: '38px', padding: '0 12px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      required={col.name === "kode_station" || col.name === "nama"}
                    />
                  </div>
                ))}
              </div>
              <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;
