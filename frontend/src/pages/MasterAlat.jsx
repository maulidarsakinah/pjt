import { useMemo, useState, useEffect, useCallback } from "react";
import KPICard from "../components/KPICard";
import {
  getAlatList,
  createAlat,
  updateAlat,
  deleteAlat,
  getMasterStations,
  getStationColumns,
} from "../services/api";
import "./MasterAlat.css";
import "./MasterAlatModals.css";

const PAGE_SIZE = 10;

const INITIAL_DUMMY_ALAT = [
  {
    id: 1,
    name: "Pos Pantau Brantas 01",
    station_id: 1,
    station_name: "Stasiun Babat",
    lokasi: "Bendung Babat",
    wilayah_sungai: "Sungai Brantas",
    status: 1,
    computed_status: "online",
  },
  {
    id: 2,
    name: "Pos Pantau Kadurus 02",
    station_id: 2,
    station_name: "Stasiun Lamongan",
    lokasi: "Lamongan",
    wilayah_sungai: "Sungai Kadurus",
    status: 1,
    computed_status: "online",
  },
  {
    id: 3,
    name: "Pos Pantau Brantas 02",
    station_id: 1,
    station_name: "Stasiun Babat",
    lokasi: "Kantor UPT SDA Lamongan",
    wilayah_sungai: "Sungai Brantas",
    status: 2,
    computed_status: "maintenance",
  },
  {
    id: 4,
    name: "Pos Pantau Bengawan 01",
    station_id: 3,
    station_name: "Stasiun Bojonegoro",
    lokasi: "Bojonegoro",
    wilayah_sungai: "Sungai Bengawan Solo",
    status: 0,
    computed_status: "inactive",
  },
];

function pageNumbers(currentPage, totalPages) {
  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  return [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
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

const MasterAlatMobileRow = ({
  item,
  openEditModal,
  openDeleteModal,
  getStatusDisplay,
}) => (
  <li>
    <div className="master-alat-mobile-log">
      <span className="master-alat-mobile-log-main">
        <span className="master-alat-mobile-log-topline">
          <strong>{item.name || item.nama}</strong>
          {getStatusDisplay(item.computed_status ?? item.status)}
        </span>
        <span className="master-alat-mobile-log-meta">
          <span className="master-alat-badge">ID: {item.id}</span>
          <span className="master-alat-badge">
            {item.station_name || "Tanpa Stasiun"}
          </span>
          <span>{item.wilayah_sungai || item.wilayah || "-"}</span>
        </span>
        <div className="master-alat-mobile-actions">
          <div className="master-alat-mobile-actions-left">
            <button
              className="action-btn"
              type="button"
              title="Edit"
              onClick={() => openEditModal(item)}
            >
              <i className="fa-solid fa-pen" />
            </button>
            <button
              className="action-btn delete"
              type="button"
              title="Hapus"
              onClick={() => openDeleteModal(item)}
            >
              <i className="fa-solid fa-trash" />
            </button>
          </div>
          <span className="master-alat-mobile-last-login">
            {item.lokasi || "-"}
          </span>
        </div>
      </span>
    </div>
  </li>
);

const MasterAlat = () => {
  const [dataAlat, setDataAlat] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [modalError, setModalError] = useState(null);

  const [page, setPage] = useState(1);
  const [totalAlat, setTotalAlat] = useState(0);

  const [stations, setStations] = useState([]);
  const [stationColumns, setStationColumns] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterWilayah, setFilterWilayah] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStationId, setFilterStationId] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAlat, setSelectedAlat] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isMobile = useMediaQuery("(max-width: 760px)");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, filterStatus, filterStationId, filterWilayah]);

  const initialForm = {
    name: "",
    station_id: "",
    wilayah_sungai: "",
    lokasi: "",
    status: 1,
    thresholds: [],
  };
  const [formData, setFormData] = useState(initialForm);

  const fetchAlatList = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await getAlatList({
        search: debouncedSearchQuery,
        status: filterStatus,
        station_id: filterStationId,
        wilayah_sungai: filterWilayah,
        limit: PAGE_SIZE,
        offset,
      });
      if (res && Array.isArray(res.data)) {
        setDataAlat(res.data);
        setTotalAlat(res.total ?? res.data.length);
      } else {
        setDataAlat(INITIAL_DUMMY_ALAT);
        setTotalAlat(INITIAL_DUMMY_ALAT.length);
      }
    } catch (err) {
      console.error("Failed to fetch alat list:", err);
      setError("Gagal memuat data alat dari server: " + (err.message || ""));
      setDataAlat(INITIAL_DUMMY_ALAT);
      setTotalAlat(INITIAL_DUMMY_ALAT.length);
    } finally {
      setIsFetching(false);
      setInitialLoading(false);
    }
  }, [page, debouncedSearchQuery, filterStatus, filterStationId, filterWilayah]);

  const fetchStations = useCallback(async () => {
    try {
      const res = await getMasterStations({ limit: 200 });
      if (res && Array.isArray(res.data)) {
        setStations(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch stations:", err);
    }
  }, []);

  useEffect(() => {
    fetchAlatList();
    fetchStations();
  }, [fetchAlatList, fetchStations]);

  const handleStationChange = async (e) => {
    const stId = e.target.value;
    setFormData((prev) => ({ ...prev, station_id: stId }));
    if (!stId) {
      setStationColumns([]);
      return;
    }
    try {
      const res = await getStationColumns(stId);
      if (res && Array.isArray(res.data)) {
        setStationColumns(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch station columns:", err);
      setStationColumns([]);
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setFilterWilayah("");
    setFilterStatus("");
    setFilterStationId("");
    setPage(1);
  };

  const openAddModal = () => {
    setFormData(initialForm);
    setStationColumns([]);
    setModalError(null);
    setIsAddOpen(true);
  };

  const openEditModal = async (item) => {
    setSelectedAlat(item);
    setModalError(null);

    let fullItem = item;
    try {
      const res = await getAlatById(item.id);
      if (res && res.data) {
        fullItem = res.data;
      }
    } catch (_err) {
      // Fallback to list item if getAlatById fails
    }

    const formattedItem = {
      id: fullItem.id,
      name: fullItem.name || fullItem.nama || "",
      station_id: fullItem.station_id || "",
      wilayah_sungai: fullItem.wilayah_sungai || fullItem.wilayah || "",
      lokasi: fullItem.lokasi || "",
      status: fullItem.status !== undefined ? fullItem.status : 1,
      thresholds: Array.isArray(fullItem.thresholds) ? fullItem.thresholds : [],
    };

    setFormData(formattedItem);

    if (formattedItem.station_id) {
      try {
        const res = await getStationColumns(formattedItem.station_id);
        if (res && Array.isArray(res.data)) {
          setStationColumns(res.data);
        }
      } catch (_err) {
        setStationColumns([]);
      }
    } else {
      setStationColumns([]);
    }

    setIsEditOpen(true);
  };

  const openDeleteModal = (item) => {
    setSelectedAlat(item);
    setModalError(null);
    setIsDeleteOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleThresholdChange = (index, field, val) => {
    setFormData((prev) => {
      const updated = [...prev.thresholds];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, thresholds: updated };
    });
  };

  const addThresholdRow = () => {
    setFormData((prev) => ({
      ...prev,
      thresholds: [
        ...prev.thresholds,
        {
          treshold_name: stationColumns[0] || "water_level",
          treshold_minimum: "",
          treshold_maximum: "",
        },
      ],
    }));
  };

  const removeThresholdRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      thresholds: prev.thresholds.filter((_, i) => i !== index),
    }));
  };

  const handleAddSubmit = async () => {
    setSubmitting(true);
    setModalError(null);
    try {
      await createAlat(formData);
      setIsAddOpen(false);
      setPage(1);
      fetchAlatList();
    } catch (err) {
      setModalError(err.message || "Gagal menambahkan alat");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!selectedAlat?.id) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await updateAlat(selectedAlat.id, formData);
      setIsEditOpen(false);
      fetchAlatList();
    } catch (err) {
      setModalError(err.message || "Gagal memperbarui alat");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedAlat?.id) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await deleteAlat(selectedAlat.id);
      setIsDeleteOpen(false);
      fetchAlatList();
    } catch (err) {
      setModalError(err.message || "Gagal menghapus alat");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusDisplay = useCallback((statusVal) => {
    if (statusVal === 1 || statusVal === "Active" || statusVal === "online") {
      return (
        <span className="status-indicator">
          <div className="status-dot active"></div> Active / Normal
        </span>
      );
    }
    if (statusVal === 2 || statusVal === "Maint." || statusVal === "maintenance") {
      return (
        <span className="status-indicator">
          <div className="status-dot maint"></div> Maintenance
        </span>
      );
    }
    if (statusVal === "alert_above_max" || statusVal === "alert_below_min") {
      return (
        <span className="status-indicator">
          <div className="status-dot maint" style={{ backgroundColor: "#ef4444" }}></div> Alert
        </span>
      );
    }
    return (
      <span className="status-indicator">
        <div className="status-dot inactive"></div> Offline / Inactive
      </span>
    );
  }, []);

  const kpiCounts = useMemo(() => {
    const total = totalAlat || dataAlat.length;
    let active = 0;
    let offline = 0;
    let maint = 0;

    dataAlat.forEach((item) => {
      const st = item.computed_status || item.status;
      if (st === 1 || st === "Active" || st === "online") {
        active++;
      } else if (st === 2 || st === "Maint." || st === "maintenance") {
        maint++;
      } else {
        offline++;
      }
    });

    return { total, active, offline, maint };
  }, [dataAlat, totalAlat]);

  const totalPages = Math.max(1, Math.ceil(totalAlat / PAGE_SIZE));
  const visiblePages = pageNumbers(page, totalPages);
  const firstShown = totalAlat === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, totalAlat);

  const travelToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    setPage(nextPage);
  };

  return (
    <div className="view-section master-alat-page">
      <div className="page-header">
        <h1>Master Alat</h1>
        <p>Pengelolaan data perangkat, sensor, dan threshold stasiun pemantauan HydroTrack.</p>
      </div>

      <div className="master-kpi-grid">
        <KPICard
          title="JUMLAH PERANGKAT"
          value={kpiCounts.total}
          icon="fa-microchip"
          accent="#3a4bcf"
          descText="Total alat terdaftar"
        />
        <KPICard
          title="PERANGKAT AKTIF"
          value={kpiCounts.active}
          icon="fa-satellite-dish"
          accent="#10b981"
          descText="Mengirim data normal"
        />
        <KPICard
          title="PERANGKAT MATI"
          value={kpiCounts.offline}
          icon="fa-power-off"
          accent="#ef4444"
          descText="Offline / Sinyal terputus"
        />
        <KPICard
          title="MAINTENANCE"
          value={kpiCounts.maint}
          icon="fa-screwdriver-wrench"
          accent="#f59e0b"
          descText="Dalam perbaikan"
        />
      </div>

      <div className="master-table-panel">
        <div className="master-alat-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="panel-title">Pengelolaan Master Alat</div>
            <div className="panel-subtitle">
              Menampilkan dan mengelola daftar perangkat sensor hidrologi yang terhubung pada dashboard HydroTrack.
            </div>
          </div>
          <span className="master-table-count" style={{
            padding: "7px 12px",
            borderRadius: "999px",
            background: "rgba(177, 207, 246, 0.34)",
            color: "#1d4ed8",
            fontSize: "12px",
            fontWeight: "800",
            whiteSpace: "nowrap"
          }}>
            {totalAlat} alat
          </span>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Cari Alat</label>
            <input
              type="text"
              className="filter-select"
              placeholder="Cari nama, lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Stasiun Pemantau</label>
            <select
              className="filter-select"
              value={filterStationId}
              onChange={(e) => setFilterStationId(e.target.value)}
            >
              <option value="">Semua Stasiun</option>
              {stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.nama || st.station_name || `Stasiun ${st.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Wilayah Sungai</label>
            <input
              type="text"
              className="filter-select"
              placeholder="Wilayah..."
              value={filterWilayah}
              onChange={(e) => setFilterWilayah(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Status Perangkat</label>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="1">Active / Online</option>
              <option value="2">Maintenance</option>
              <option value="0">Inactive / Offline</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" type="button" onClick={fetchAlatList}>
              FILTER
            </button>
            <button className="btn btn-outline" type="button" onClick={handleReset}>
              RESET
            </button>
          </div>
        </div>

        <div className="action-bar">
          <button className="btn btn-primary" type="button" onClick={openAddModal}>
            <i className="fa-solid fa-plus"></i> TAMBAH ALAT
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              margin: "16px 24px 0",
              borderRadius: "8px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "14px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            role="alert"
          >
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: "16px", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        <div className="table-container">
          {initialLoading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: "8px" }} />
              Memuat data alat...
            </div>
          ) : dataAlat.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Tidak ada alat yang ditemukan.
            </div>
          ) : isMobile ? (
            <ul className="master-alat-mobile-list">
              {dataAlat.map((item) => (
                <MasterAlatMobileRow
                  key={item.id}
                  item={item}
                  openEditModal={openEditModal}
                  openDeleteModal={openDeleteModal}
                  getStatusDisplay={getStatusDisplay}
                />
              ))}
            </ul>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID ALAT</th>
                  <th>NAMA ALAT</th>
                  <th>STASIUN</th>
                  <th>LOKASI</th>
                  <th>WILAYAH</th>
                  <th>STATUS</th>
                  <th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {dataAlat.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>ALT-{String(item.id).padStart(3, "0")}</strong>
                    </td>
                    <td>{item.name || item.nama}</td>
                    <td>{item.station_name || `Stasiun #${item.station_id}`}</td>
                    <td>{item.lokasi || "-"}</td>
                    <td>{item.wilayah_sungai || item.wilayah || "-"}</td>
                    <td>{getStatusDisplay(item.computed_status ?? item.status)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          title="Edit Alat"
                          onClick={() => openEditModal(item)}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          className="action-btn delete"
                          title="Hapus Alat"
                          onClick={() => openDeleteModal(item)}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination-footer">
          <nav className="pagination" aria-label="Navigasi halaman alat" style={{ width: "100%", marginTop: 0, paddingTop: 0 }}>
            <div className="page-info">
              Menampilkan {firstShown}–{lastShown} dari {totalAlat} data
            </div>
            <div className="page-controls">
              <button
                className="page-btn"
                type="button"
                disabled={page === 1 || isFetching}
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
                      aria-current={pageNumber === page ? "page" : undefined}
                      onClick={() => travelToPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  </span>
                );
              })}
              <button
                className="page-btn"
                type="button"
                disabled={page === totalPages || isFetching}
                onClick={() => travelToPage(page + 1)}
                aria-label="Halaman berikutnya"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Modals */}
      {(isAddOpen || isEditOpen) && (
        <div
          className="ma-modal-overlay"
          onClick={() => {
            setIsAddOpen(false);
            setIsEditOpen(false);
          }}
        >
          <div
            className="ma-modal-content"
            style={{ maxWidth: "680px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ma-modal-header">
              <h2 className="ma-modal-title">
                {isAddOpen ? "Form Tambah Alat" : "Form Edit Alat"}
              </h2>
              <button
                className="ma-modal-close-btn"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="ma-modal-body">
              {modalError && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                  role="alert"
                >
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: "16px", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>{modalError}</div>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer" }}
                    onClick={() => setModalError(null)}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              )}

              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Nama Alat</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    placeholder="Masukkan nama alat..."
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Stasiun Pemantau</label>
                  <select
                    name="station_id"
                    className="form-select"
                    value={formData.station_id}
                    onChange={handleStationChange}
                  >
                    <option value="">Pilih Stasiun</option>
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nama || st.station_name || `Stasiun ${st.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status Perangkat</label>
                  <select
                    name="status"
                    className="form-select"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value={1}>Active</option>
                    <option value={2}>Maintenance</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Wilayah Sungai</label>
                  <input
                    type="text"
                    name="wilayah_sungai"
                    className="form-input"
                    placeholder="Contoh: Sungai Brantas"
                    value={formData.wilayah_sungai}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Lokasi</label>
                  <input
                    type="text"
                    name="lokasi"
                    className="form-input"
                    placeholder="Masukkan lokasi penempatan..."
                    value={formData.lokasi}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Threshold Rules Section */}
                <div className="form-group full-width" style={{ marginTop: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <label style={{ margin: 0 }}>Pengaturan Threshold Sensor</label>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                      onClick={addThresholdRow}
                    >
                      + Tambah Threshold Rule
                    </button>
                  </div>

                  {formData.thresholds.length === 0 ? (
                    <div
                      style={{
                        padding: "12px",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        textAlign: "center",
                      }}
                    >
                      Belum ada aturan threshold diset.
                    </div>
                  ) : (
                    formData.thresholds.map((tItem, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.5fr 1fr 1fr auto",
                          gap: "8px",
                          marginBottom: "8px",
                          alignItems: "center",
                        }}
                      >
                        {stationColumns.length > 0 ? (
                          <select
                            className="form-select"
                            style={{ fontSize: "12px", padding: "8px" }}
                            value={tItem.treshold_name}
                            onChange={(e) =>
                              handleThresholdChange(idx, "treshold_name", e.target.value)
                            }
                          >
                            {stationColumns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: "12px", padding: "8px" }}
                            placeholder="threshold_name"
                            value={tItem.treshold_name}
                            onChange={(e) =>
                              handleThresholdChange(idx, "treshold_name", e.target.value)
                            }
                          />
                        )}
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          style={{ fontSize: "12px", padding: "8px" }}
                          placeholder="Min Bound"
                          value={tItem.treshold_minimum ?? ""}
                          onChange={(e) =>
                            handleThresholdChange(idx, "treshold_minimum", e.target.value)
                          }
                        />
                        <input
                          type="number"
                          step="any"
                          className="form-input"
                          style={{ fontSize: "12px", padding: "8px" }}
                          placeholder="Max Bound"
                          value={tItem.treshold_maximum ?? ""}
                          onChange={(e) =>
                            handleThresholdChange(idx, "treshold_maximum", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="action-btn delete"
                          style={{ padding: "6px" }}
                          onClick={() => removeThresholdRow(idx)}
                        >
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="ma-modal-footer">
              <button
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
              >
                Batal
              </button>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={isAddOpen ? handleAddSubmit : handleEditSubmit}
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteOpen && selectedAlat && (
        <div className="ma-modal-overlay" onClick={() => setIsDeleteOpen(false)}>
          <div className="ma-modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-modal-body">
              {modalError && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    fontSize: "14px",
                    fontWeight: "500",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                  role="alert"
                >
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: "16px", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>{modalError}</div>
                </div>
              )}
              <div className="delete-icon-wrapper">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h2 className="delete-title">Hapus Alat?</h2>
              <p className="delete-message">
                Apakah Anda yakin ingin menghapus alat <strong>{selectedAlat.name || selectedAlat.nama}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="delete-actions">
                <button
                  className="btn btn-outline"
                  disabled={submitting}
                  onClick={() => setIsDeleteOpen(false)}
                >
                  Batal
                </button>
                <button
                  className="btn btn-danger"
                  disabled={submitting}
                  onClick={handleDeleteSubmit}
                  style={{
                    background: "var(--danger-color)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  {submitting ? "Deleting..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAlat;
