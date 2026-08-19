import { useState, useEffect, useMemo, useCallback } from "react";
import KPICard from "../components/KPICard";
import useAuth from "../contexts/useAuth";
import { has_permission } from "../utils/permission_utils";
import {
  getMasterStations,
  createMasterStation,
  updateMasterStation,
  deleteMasterStation,
} from "../services/api";
import "./MasterData.css";

const columnsSchema = [
  { name: "kode_station", type: "text", label: "Kode Station", placeholder: "Contoh: FLOW_LAMONGAN_01" },
  { name: "nama", type: "text", label: "Nama Station", placeholder: "Contoh: Stasiun Flowmeter Lamongan" },
  { name: "x", type: "number", label: "X (Longitude)", placeholder: "Contoh: 112.43" },
  { name: "y", type: "number", label: "Y (Latitude)", placeholder: "Contoh: -7.14" },
  { name: "z", type: "number", label: "Z (Elevasi)", placeholder: "Contoh: 15.5" },
  { name: "id_desa", type: "number", label: "ID Desa", placeholder: "Contoh: 1201" },
  { name: "WaterLevel", type: "number", label: "WaterLevel", placeholder: "Contoh: 1" },
  { name: "Rainfall", type: "number", label: "Rainfall", placeholder: "Contoh: 1" },
  { name: "Repeater", type: "number", label: "Repeater", placeholder: "Contoh: 0" },
  { name: "Master", type: "number", label: "Master", placeholder: "Contoh: 0" },
  { name: "Sub", type: "number", label: "Sub", placeholder: "Contoh: 0" },
  { name: "Branch", type: "number", label: "Branch", placeholder: "Contoh: 0" },
  { name: "GSMRainfall", type: "number", label: "GSMRainfall", placeholder: "Contoh: 0" },
  { name: "GSMWaterlevel", type: "number", label: "GSMWaterlevel", placeholder: "Contoh: 0" },
  { name: "TableData", type: "text", label: "TableData", placeholder: "Contoh: tb_arr_lamongan" },
  { name: "indexhuluhilir", type: "number", label: "Index Hulu/Hilir", placeholder: "Contoh: 1" },
  { name: "nostation", type: "text", label: "No Station", placeholder: "Contoh: ST-001" },
  { name: "clock", type: "number", label: "Clock", placeholder: "Contoh: 60" },
  { name: "validpos", type: "text", label: "Valid Pos", placeholder: "Contoh: YES" },
  { name: "objecttype", type: "text", label: "Object Type", placeholder: "Contoh: FLOW" },
  { name: "SIAGAWaterlevel", type: "text", label: "SIAGA Waterlevel", placeholder: "Contoh: NORMAL" },
  { name: "SIAGADisch", type: "text", label: "SIAGA Discharge", placeholder: "Contoh: NORMAL" },
  { name: "ws", type: "number", label: "Wilayah Sungai (WS)", placeholder: "Contoh: 1" },
  { name: "wl_decimal_num", type: "number", label: "WL Decimal Num", placeholder: "Contoh: 2" },
  { name: "visible", type: "text", label: "Visible", placeholder: "Contoh: 1" },
  { name: "enabled", type: "number", label: "Enabled (1/0)", placeholder: "1 = Aktif, 0 = Non-aktif" },
  { name: "GSMWQMS", type: "number", label: "GSM WQMS", placeholder: "Contoh: 0" },
  { name: "TableDataForecast", type: "text", label: "TableData Forecast", placeholder: "Contoh: tb_fc_lamongan" },
  { name: "hasForecast", type: "number", label: "Has Forecast (1/0)", placeholder: "Contoh: 0" },
  { name: "hasWLOffset", type: "number", label: "Has WL Offset (1/0)", placeholder: "Contoh: 0" },
  { name: "WLOffset", type: "number", label: "WL Offset", placeholder: "Contoh: 0.0" },
  { name: "history_nomor", type: "text", label: "History Nomor", placeholder: "Contoh: HIST-001" },
  { name: "provider", type: "text", label: "Provider", placeholder: "Contoh: TELKOMSEL" },
  { name: "sigab_enabled", type: "number", label: "Sigab Enabled (1/0)", placeholder: "Contoh: 1" },
  { name: "stastion_type", type: "text", label: "Station Type", placeholder: "Contoh: FLOW_MQTT" },
  { name: "aq_location_identifier", type: "number", label: "AQ Location ID", placeholder: "Contoh: 101" },
  { name: "id_api", type: "text", label: "ID API", placeholder: "Contoh: API-001" },
  { name: "template_api", type: "text", label: "Template API", placeholder: "Contoh: TMPL-01" },
  { name: "GSMINSTR", type: "number", label: "GSM INSTR", placeholder: "Contoh: 0" },
  { name: "GSMFLOW", type: "number", label: "GSM FLOW", placeholder: "Contoh: 1" },
  { name: "resolution", type: "text", label: "Resolution", placeholder: "Contoh: 10m" }
];

// static preview so you can see the UI without DB — mirrors MasterAccount pattern
const STATIC_PREVIEW = [
  { id: 101, kode_station: "FLOW_BENGAWAN_01", id_desa: 1201, nama: "Bengawan Solo — Cepu", stastion_type: "FLOW_MQTT", enabled: 1, TableData: "tb_flow_bengawan_01", x: 111.59, y: -7.14 },
  { id: 102, kode_station: "FLOW_BRANTAS_02", id_desa: 1202, nama: "Brantas — Mojokerto", stastion_type: "FLOW_API", enabled: 1, TableData: "tb_flow_brantas_02", x: 112.43, y: -7.46 },
  { id: 103, kode_station: "FLOW_CITARUM_03", id_desa: 1203, nama: "Citarum — Karawang", stastion_type: "FLOW_MQTT", enabled: 0, TableData: "tb_flow_citarum_03", x: 107.3, y: -6.31 },
];

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

const MasterDataMobileRow = ({ station, onDetail, onEdit, onDelete }) => (
  <li>
    <article className="master-data-mobile-card">
      <div className="master-data-mobile-main">
        <div className="master-data-mobile-topline">
          <strong>{station.kode_station}</strong>
          <span className={`md-mobile-status ${Number(station.enabled) === 1 ? "is-active" : "is-inactive"}`}>
            <span className="badge-dot" />
            {Number(station.enabled) === 1 ? "Active" : "Non-active"}
          </span>
        </div>
        <p>{station.nama || "Nama station tidak tersedia"}</p>
        <div className="master-data-mobile-meta">
          <span className="master-data-mobile-badge">ID Desa: {station.id_desa || "-"}</span>
          <span className="master-data-mobile-badge">{station.stastion_type || "Tanpa tipe"}</span>
        </div>
        <div className="master-data-mobile-actions">
          <button className="md-icon-btn" type="button" title="Detail" aria-label={`Lihat detail ${station.kode_station}`} onClick={() => onDetail(station)}>
            <i className="fa-regular fa-eye" />
          </button>
          <button className="md-icon-btn" type="button" title="Ubah" aria-label={`Ubah ${station.kode_station}`} onClick={() => onEdit(station)}>
            <i className="fa-solid fa-pen" />
          </button>
          <button className="md-icon-btn is-danger" type="button" title="Hapus" aria-label={`Hapus ${station.kode_station}`} onClick={() => onDelete(station)}>
            <i className="fa-regular fa-trash-can" />
          </button>
        </div>
      </div>
    </article>
  </li>
);

const MasterData = () => {
  const { user } = useAuth();
  const isDemo = Boolean(user?.is_demo);

  const [selectedStation, setSelectedStation] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // --- additive: edit / delete / filters / toast ---
  const [editTarget, setEditTarget] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeInput, setTypeInput] = useState("");
  const [statusInput, setStatusInput] = useState("");
  const [applied, setApplied] = useState({ search: "", stastion_type: "", enabled: "" });
  const limit = 10;
  const isMobile = useMediaQuery("(max-width: 768px)");

  const showToast = useCallback((msg, tone = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchStations = useCallback(() => {
    setLoading(true);
    setErrorMsg("");
    // demo preview — no network needed
    if (isDemo) {
      const q = (applied.search || "").toLowerCase();
      let filtered = [...STATIC_PREVIEW];
      if (q) filtered = filtered.filter((s) => `${s.kode_station} ${s.nama}`.toLowerCase().includes(q));
      if (applied.stastion_type) filtered = filtered.filter((s) => s.stastion_type === applied.stastion_type);
      if (applied.enabled !== "") filtered = filtered.filter((s) => String(s.enabled) === String(applied.enabled));
      const offset = (page - 1) * limit;
      setStations(filtered.slice(offset, offset + limit));
      setTotal(filtered.length);
      setLoading(false);
      return;
    }

    const query = { limit, offset: (page - 1) * limit };
    if (applied.search) query.search = applied.search;
    if (applied.stastion_type) query.station_type = applied.stastion_type;
    if (applied.enabled !== "") query.enabled = applied.enabled;

    getMasterStations(query)
      .then((res) => {
        setStations(res.data || []);
        setTotal(res.total || 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch master stations:", err);
        setErrorMsg(err.message || "Gagal memuat data");
        setLoading(false);
      });
  }, [page, applied, isDemo]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const handleAddChange = (e) => {
    const { name, value, type } = e.target;
    let val = value;
    if (type === "number") {
      val = value === "" ? "" : Number(value);
    }
    setAddFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (isDemo) {
      showToast("Mode demo — tambah dinonaktifkan (preview lokal).", "info");
      setIsAddModalOpen(false);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    createMasterStation(addFormData)
      .then(() => {
        showToast("Station berhasil ditambahkan");
        setIsAddModalOpen(false);
        setAddFormData({});
        fetchStations();
      })
      .catch(err => {
        setErrorMsg(err.message);
        showToast(err.message || "Gagal menambah data", "error");
      })
      .finally(() => setIsSubmitting(false));
  };

  // --- additive handlers ---
  const openEdit = (station) => {
    setEditTarget(station);
    // prefill only columnsSchema fields
    const init = {};
    columnsSchema.forEach((c) => {
      const v = station[c.name];
      init[c.name] = v ?? "";
    });
    setEditFormData(init);
  };

  const handleEditChange = (e) => {
    const { name, value, type } = e.target;
    const val = type === "number" ? (value === "" ? "" : Number(value)) : value;
    setEditFormData((p) => ({ ...p, [name]: val }));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editTarget) return;
    if (isDemo) {
      // local preview mutation
      setStations((prev) => prev.map((s) => (s.id === editTarget.id ? { ...s, ...editFormData } : s)));
      if (selectedStation?.id === editTarget.id) setSelectedStation((s) => ({ ...s, ...editFormData }));
      showToast("Preview: perubahan disimpan lokal (demo).", "info");
      setEditTarget(null);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    updateMasterStation(editTarget.id, editFormData)
      .then((res) => {
        const updated = res?.data || { ...editTarget, ...editFormData };
        setStations((prev) => prev.map((s) => (s.id === editTarget.id ? { ...s, ...updated } : s)));
        if (selectedStation?.id === editTarget.id) setSelectedStation(updated);
        showToast("Station berhasil diperbarui");
        setEditTarget(null);
        fetchStations();
      })
      .catch((err) => {
        setErrorMsg(err.message);
        showToast(err.message || "Gagal memperbarui", "error");
      })
      .finally(() => setIsSubmitting(false));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (isDemo) {
      setStations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      if (selectedStation?.id === deleteTarget.id) setSelectedStation(null);
      showToast("Preview: data dihapus lokal (demo).", "info");
      setDeleteTarget(null);
      return;
    }
    setIsSubmitting(true);
    deleteMasterStation(deleteTarget.id)
      .then(() => {
        showToast("Station berhasil dihapus");
        setDeleteTarget(null);
        if (selectedStation?.id === deleteTarget.id) setSelectedStation(null);
        // if last item on page, step back
        if (stations.length === 1 && page > 1) setPage((p) => p - 1);
        else fetchStations();
      })
      .catch((err) => {
        setErrorMsg(err.message);
        showToast(err.message || "Gagal menghapus", "error");
      })
      .finally(() => setIsSubmitting(false));
  };

  const applyFilters = () => {
    setPage(1);
    setApplied({ search: searchInput.trim(), stastion_type: typeInput, enabled: statusInput });
  };
  const resetFilters = () => {
    setSearchInput("");
    setTypeInput("");
    setStatusInput("");
    setPage(1);
    setApplied({ search: "", stastion_type: "", enabled: "" });
  };
  const handleExport = () => {
    const headers = ["KODE_STATION", "NAMA", "TYPE", "ENABLED", "TABLEDATA"];
    const rows = stations.map((s) => [s.kode_station, s.nama, s.stastion_type, s.enabled, s.TableData || ""]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `master-data-page-${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    return {
      total: total,
      active: stations.filter((s) => Number(s.enabled) === 1).length,
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
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    const arr = [];
    if (start > 2) arr.push(1);
    for (let i = start; i <= end; i++) arr.push(i);
    if (end < totalPages - 1) arr.push(totalPages);
    return Array.from(new Set(arr)).sort((a, b) => a - b);
  }, [page, totalPages]);

  const travelToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setPage(newPage);
  };

  return (
    <div className="view-section master-data-page">
      <div className="header-section">
        <div>
          <h1>Master Data</h1>
          <p>Pengelolaan data entitas dan konfigurasi sistem Jasa Tirta I</p>
        </div>
      </div>

      <div className="master-kpi-grid">
        <KPICard title="TOTAL STATION" value={summary.total} icon="fa-database" descText="Total seluruh entitas terdaftar." accent="#3A4BCF" />
        <KPICard title="STATION AKTIF" value={summary.active} icon="fa-satellite-dish" descText="Entitas dengan status online (enabled)." accent="#10B981" />
        <KPICard title="FLOW MQTT" value={summary.flowMqtt} icon="fa-network-wired" descText="Entitas dengan tipe aliran MQTT." accent="#F59E0B" />
        <KPICard title="FLOW API" value={summary.flowApi} icon="fa-cloud-arrow-down" descText="Entitas dengan tipe aliran API." accent="#8B5CF6" />
      </div>

      <section className="panel master-table-panel md-panel-accent">
        <div className="master-table-header">
          <div className="panel-title">Pengelolaan Master Data</div>
          <div className="panel-subtitle">Menampilkan dan mengelola data entitas utama yang terhubung pada dashboard Jasa Tirta I.</div>
        </div>

        <div className="master-table-tools">
          <div className="master-filter-grid">
            <div className="master-filter-group">
              <label>Cari</label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="kode / nama"
              />
            </div>
            <div className="master-filter-group">
              <label>Jenis Data</label>
              <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)}>
                <option value="">Semua Jenis</option>
                <option value="FLOW_MQTT">FLOW_MQTT</option>
                <option value="FLOW_API">FLOW_API</option>
                <option value="WATERLEVEL">WATERLEVEL</option>
              </select>
            </div>
            <div className="master-filter-group">
              <label>Status Perangkat</label>
              <select value={statusInput} onChange={(e) => setStatusInput(e.target.value)}>
                <option value="">Semua Status</option>
                <option value="1">Aktif</option>
                <option value="0">Non-aktif</option>
              </select>
            </div>
            <div className="master-filter-actions">
              <button className="btn btn-primary" type="button" onClick={applyFilters}>FILTER</button>
              <button className="btn btn-outline" type="button" onClick={resetFilters}>RESET</button>
            </div>
          </div>
          <div className="master-filter-actions">
            {has_permission(user, "create stations") && (
              <button className="btn btn-primary" type="button" onClick={() => setIsAddModalOpen(true)}>
                <i className="fa-solid fa-plus"></i> TAMBAH DATA
              </button>
            )}
            <button className="btn btn-outline" type="button" onClick={handleExport}>
              <i className="fa-solid fa-download"></i> EXPORT
            </button>
          </div>
        </div>

        {errorMsg && <div className="md-feedback is-error" role="alert">{errorMsg}</div>}
        {isDemo && <div className="md-feedback is-info">Mode demo — data preview lokal. Aksi tulis (tambah/ubah/hapus) hanya simulasi di browser.</div>}

        <div className="table-container">
          {loading ? (
            <div className="md-table-message">Loading...</div>
          ) : stations.length === 0 ? (
            <div className="md-table-message">No data found.</div>
          ) : isMobile ? (
            <ul className="master-data-mobile-list">
              {stations.map((station) => (
                <MasterDataMobileRow
                  key={station.id}
                  station={station}
                  onDetail={setSelectedStation}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </ul>
          ) : (
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
                {stations.map((station) => (
                  <tr key={station.id}>
                    <td><b>{station.kode_station}</b></td>
                    <td>{station.id_desa || "-"}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{station.nama}</td>
                    <td><span className="badge badge-normal">{station.stastion_type || "-"}</span></td>
                    <td>
                      {Number(station.enabled) === 1 ? (
                        <span style={{ color: "var(--success-color)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="badge-dot" style={{ backgroundColor: "var(--success-color)" }} /> Active
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger-color)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="badge-dot" style={{ backgroundColor: "var(--danger-color)" }} /> Non-active
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="md-row-actions">
                        <button className="md-icon-btn" type="button" title="Detail" onClick={() => setSelectedStation(station)}>
                          <i className="fa-regular fa-eye" />
                        </button>
                        {has_permission(user, "update stations") && (
                          <button className="md-icon-btn" type="button" title="Ubah" onClick={() => openEdit(station)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                        )}
                        {has_permission(user, "delete stations") && (
                          <button className="md-icon-btn is-danger" type="button" title="Hapus" onClick={() => setDeleteTarget(station)}>
                            <i className="fa-regular fa-trash-can" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <nav className="pagination" aria-label="Navigasi halaman data">
          <div className="page-info">Menampilkan {firstShown}–{lastShown} dari {total} data</div>
          <div className="page-controls">
            <button className="page-btn" type="button" disabled={page === 1 || loading} onClick={() => travelToPage(page - 1)} aria-label="Halaman sebelumnya"><i className="fa-solid fa-chevron-left" /></button>
            {visiblePages.map((pageNumber, index) => {
              const previous = visiblePages[index - 1];
              return (
                <span className="master-page-item" key={pageNumber}>
                  {previous && pageNumber - previous > 1 && <span className="master-page-gap">…</span>}
                  <button className={`page-btn ${pageNumber === page ? "active" : ""}`} type="button" onClick={() => travelToPage(pageNumber)} aria-current={pageNumber === page ? "page" : undefined}>{pageNumber}</button>
                </span>
              );
            })}
            <button className="page-btn" type="button" disabled={page === totalPages || loading} onClick={() => travelToPage(page + 1)} aria-label="Halaman selanjutnya"><i className="fa-solid fa-chevron-right" /></button>
          </div>
        </nav>
      </section>

      {selectedStation && (
        <div className="master-detail-modal-overlay" onClick={() => setSelectedStation(null)}>
          <div className="master-detail-modal md-modal-accent" onClick={(e) => e.stopPropagation()}>
            <div className="master-detail-header">
              <h3>Detail: {selectedStation.kode_station} — {selectedStation.nama}</h3>
              <button className="master-close-button" onClick={() => setSelectedStation(null)} title="Tutup Detail"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="master-detail-content">
              {Object.entries(selectedStation).map(([key, value]) => (
                <div className="master-detail-item" key={key}><span>{key}</span><strong>{value !== "" && value !== null && value !== undefined ? String(value) : "-"}</strong></div>
              ))}
            </div>
            <div className="md-modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setSelectedStation(null)}>Tutup</button>
              <button className="btn btn-primary" type="button" onClick={() => { const s = selectedStation; setSelectedStation(null); openEdit(s); }}><i className="fa-solid fa-pen" /> Ubah data</button>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="master-detail-modal-overlay" onClick={() => !isSubmitting && setIsAddModalOpen(false)}>
          <div className="master-detail-modal md-modal-accent" onClick={(e) => e.stopPropagation()}>
            <div className="master-detail-header"><h3>Tambah Data Station</h3><button className="master-close-button" onClick={() => !isSubmitting && setIsAddModalOpen(false)}><i className="fa-solid fa-xmark" /></button></div>
            <form onSubmit={handleAddSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="master-detail-content">
                {columnsSchema.map((col) => (
                  <div className="master-filter-group" key={col.name} style={{ marginBottom: 10 }}>
                    <label>{col.label}{ (col.name === "kode_station" || col.name === "nama") && <span style={{ color: "var(--danger-color)" }}> *</span>}</label>
                    <input type={col.type} name={col.name} value={addFormData[col.name] !== undefined ? addFormData[col.name] : ""} onChange={handleAddChange} placeholder={col.placeholder || `Masukkan ${col.label.toLowerCase()}...`} style={{ height: 38, padding: "0 12px", border: "1px solid var(--border-color)", borderRadius: 6 }} required={col.name === "kode_station" || col.name === "nama"} />
                  </div>
                ))}
              </div>
              <div style={{ padding: 20, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)} disabled={isSubmitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Data"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="master-detail-modal-overlay" onClick={() => !isSubmitting && setEditTarget(null)}>
          <div className="master-detail-modal md-modal-accent" onClick={(e) => e.stopPropagation()}>
            <div className="master-detail-header"><h3>Ubah Data — {editTarget.kode_station}</h3><button className="master-close-button" onClick={() => !isSubmitting && setEditTarget(null)}><i className="fa-solid fa-xmark" /></button></div>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div className="master-detail-content">
                {columnsSchema.map((col) => (
                  <div className="master-filter-group" key={col.name} style={{ marginBottom: 10 }}>
                    <label>{col.label}{ (col.name === "kode_station" || col.name === "nama") && <span style={{ color: "var(--danger-color)" }}> *</span>}</label>
                    <input type={col.type} name={col.name} value={editFormData[col.name] !== undefined ? editFormData[col.name] : ""} onChange={handleEditChange} placeholder={col.placeholder || `Masukkan ${col.label.toLowerCase()}...`} style={{ height: 38, padding: "0 12px", border: "1px solid var(--border-color)", borderRadius: 6 }} required={col.name === "kode_station" || col.name === "nama"} />
                  </div>
                ))}
              </div>
              <div style={{ padding: 20, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditTarget(null)} disabled={isSubmitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="master-detail-modal-overlay" onClick={() => !isSubmitting && setDeleteTarget(null)}>
          <div className="master-detail-modal md-modal-accent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="master-detail-header"><h3>Hapus station?</h3><button className="master-close-button" onClick={() => !isSubmitting && setDeleteTarget(null)}><i className="fa-solid fa-xmark" /></button></div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "#fef2f2", color: "var(--danger-color)" }}><i className="fa-solid fa-triangle-exclamation" /></div>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, fontSize: 14 }}>
                <b style={{ color: "var(--text-primary)" }}>{deleteTarget.kode_station} — {deleteTarget.nama}</b> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div style={{ padding: 20, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={isSubmitting}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={isSubmitting}>{isSubmitting ? "Menghapus..." : "Ya, Hapus"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`md-toast ${toast.tone === "error" ? "is-error" : toast.tone === "info" ? "is-info" : "is-success"}`} role="status" aria-live="polite">
          <i className={`fa-solid ${toast.tone === "error" ? "fa-circle-exclamation" : toast.tone === "info" ? "fa-circle-info" : "fa-circle-check"}`} />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

export default MasterData;
