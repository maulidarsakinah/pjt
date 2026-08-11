import { useMemo, useState, useEffect } from "react";
import KPICard from "../components/KPICard";
import "./MasterAlat.css";
import "./MasterAlatModals.css";

const INITIAL_DUMMY_ALAT = [
  {
    id: "ALT-001",
    nama: "Pos Pantau Brantas 01",
    jenis: "Sensor Tinggi Muka Air",
    lokasi: "Bendung Babat",
    wilayah: "Sungai Brantas",
    status: "Active",
  },
  {
    id: "ALT-002",
    nama: "Pos Pantau Kadurus 02",
    jenis: "Sensor Curah Hujan",
    lokasi: "Lamongan",
    wilayah: "Sungai Kadurus",
    status: "Active",
  },
  {
    id: "ALT-003",
    nama: "Pos Pantau Brantas 02",
    jenis: "Sensor Debit Air",
    lokasi: "Kantor UPT SDA Lamongan",
    wilayah: "Sungai Brantas",
    status: "Maint.",
  },
  {
    id: "ALT-004",
    nama: "Pos Pantau Brantas 03",
    jenis: "Sensor Debit Air",
    lokasi: "Kantor UPT SDA Lamongan",
    wilayah: "Sungai Brantas",
    status: "Maint.",
  },
  {
    id: "ALT-005",
    nama: "Pos Pantau Bengawan 01",
    jenis: "Sensor Tinggi Muka Air",
    lokasi: "Bojonegoro",
    wilayah: "Sungai Bengawan Solo",
    status: "Inactive",
  },
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

const MasterAlatMobileRow = ({ item, openEditModal, openDeleteModal, getStatusDisplay }) => (
  <li>
    <div className="master-alat-mobile-log">
      <span className="master-alat-mobile-log-main">
        <span className="master-alat-mobile-log-topline">
          <strong>{item.nama}</strong>
          {getStatusDisplay(item.status)}
        </span>
        <span className="master-alat-mobile-log-meta">
          <span className="master-alat-badge">{item.id}</span>
          <span className="master-alat-badge">{item.jenis}</span>
          <span>{item.wilayah}</span>
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
          <span className="master-alat-mobile-last-login">{item.lokasi}</span>
        </div>
      </span>
    </div>
  </li>
);

const MasterAlat = () => {
  const [dataAlat, setDataAlat] = useState(INITIAL_DUMMY_ALAT);
  const [filterJenis, setFilterJenis] = useState("");
  const [filterWilayah, setFilterWilayah] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAlat, setSelectedAlat] = useState(null);
  
  const isMobile = useMediaQuery("(max-width: 760px)");
  
  const initialForm = { id: "", nama: "", jenis: "Sensor Tinggi Muka Air", wilayah: "Sungai Brantas", status: "Active", lokasi: "" };
  const [formData, setFormData] = useState(initialForm);

  const filteredData = useMemo(() => {
    return dataAlat.filter((item) => {
      const matchJenis = filterJenis ? item.jenis === filterJenis : true;
      const matchWilayah = filterWilayah ? item.wilayah === filterWilayah : true;
      const matchStatus = filterStatus ? item.status === filterStatus : true;
      return matchJenis && matchWilayah && matchStatus;
    });
  }, [dataAlat, filterJenis, filterWilayah, filterStatus]);

  const handleReset = () => {
    setFilterJenis("");
    setFilterWilayah("");
    setFilterStatus("");
  };

  const openAddModal = () => {
    setFormData(initialForm);
    setIsAddOpen(true);
  };

  const openEditModal = (item) => {
    setFormData(item);
    setSelectedAlat(item);
    setIsEditOpen(true);
  };

  const openDeleteModal = (item) => {
    setSelectedAlat(item);
    setIsDeleteOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = () => {
    setDataAlat(prev => [...prev, formData]);
    setIsAddOpen(false);
  };

  const handleEditSubmit = () => {
    setDataAlat(prev => prev.map(item => item.id === selectedAlat.id ? formData : item));
    setIsEditOpen(false);
  };

  const handleDeleteSubmit = () => {
    setDataAlat(prev => prev.filter(item => item.id !== selectedAlat.id));
    setIsDeleteOpen(false);
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case "Active":
        return (
          <span className="status-indicator">
            <div className="status-dot active"></div> Active
          </span>
        );
      case "Maint.":
        return (
          <span className="status-indicator">
            <div className="status-dot maint"></div> Maint.
          </span>
        );
      case "Inactive":
        return (
          <span className="status-indicator">
            <div className="status-dot inactive"></div> Inactive
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="view-section master-alat-page">
      <div className="page-header">
        <h1>Master Alat</h1>
        <p>Pengelolaan data perangkat, sensor, dan stasiun pemantauan HydroTrack.</p>
      </div>

      <div className="master-kpi-grid">
        <KPICard
          title="JUMLAH PERANGKAT"
          value="1,248"
          icon="fa-microchip"
          accent="#3a4bcf"
          descText="Total alat terdaftar"
        />
        <KPICard
          title="PERANGKAT AKTIF"
          value="1,102"
          icon="fa-satellite-dish"
          accent="#10b981"
          descText="Mengirim data normal"
        />
        <KPICard
          title="PERANGKAT MATI"
          value="84"
          icon="fa-power-off"
          accent="#ef4444"
          descText="Offline / Tidak ada sinyal"
        />
        <KPICard
          title="MAINTENANCE"
          value="62"
          icon="fa-screwdriver-wrench"
          accent="#f59e0b"
          descText="Dalam perbaikan"
        />
      </div>

      <div className="master-table-panel">
        <div className="master-alat-panel-header">
          <h2 className="panel-title">Pengelolaan Master Alat</h2>
          <p className="panel-subtitle">
            Menampilkan dan mengelola daftar perangkat sensor hidrologi yang
            terhubung pada dashboard HydroTrack.
          </p>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Jenis Alat</label>
            <select
              className="filter-select"
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
            >
              <option value="">Semua Jenis</option>
              <option value="Sensor Tinggi Muka Air">Sensor Tinggi Muka Air</option>
              <option value="Sensor Curah Hujan">Sensor Curah Hujan</option>
              <option value="Sensor Debit Air">Sensor Debit Air</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Wilayah Sungai</label>
            <select
              className="filter-select"
              value={filterWilayah}
              onChange={(e) => setFilterWilayah(e.target.value)}
            >
              <option value="">Semua Wilayah</option>
              <option value="Sungai Brantas">Sungai Brantas</option>
              <option value="Sungai Kadurus">Sungai Kadurus</option>
              <option value="Sungai Bengawan Solo">Sungai Bengawan Solo</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status Perangkat</label>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="Active">Active</option>
              <option value="Maint.">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" type="button">
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
          <button className="btn btn-outline" type="button">
            <i className="fa-solid fa-download"></i> EXPORT
          </button>
        </div>

        <div className="table-container">
          {filteredData.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
              Tidak ada alat yang ditemukan.
            </div>
          ) : isMobile ? (
            <ul className="master-alat-mobile-list">
              {filteredData.map((item) => (
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
                  <th>JENIS</th>
                  <th>LOKASI</th>
                  <th>WILAYAH</th>
                  <th>STATUS</th>
                  <th>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.id}</strong>
                    </td>
                    <td>{item.nama}</td>
                    <td>{item.jenis}</td>
                    <td>{item.lokasi}</td>
                    <td>{item.wilayah}</td>
                    <td>{getStatusDisplay(item.status)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" title="Edit Alat" onClick={() => openEditModal(item)}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="action-btn delete" title="Hapus Alat" onClick={() => openDeleteModal(item)}>
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
          <div className="pagination-info">
            Menampilkan {filteredData.length > 0 ? 1 : 0}-{filteredData.length} dari {dataAlat.length} entri
          </div>
          <div className="pagination-controls">
            <button className="page-btn" disabled>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="page-btn active">1</button>
            <button className="page-btn" disabled>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(isAddOpen || isEditOpen) && (
        <div className="ma-modal-overlay" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>
          <div className="ma-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h2 className="ma-modal-title">{isAddOpen ? "Form Tambah Alat" : "Form Edit Alat"}</h2>
              <button className="ma-modal-close-btn" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="ma-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Jenis Alat</label>
                  <select name="jenis" className="form-select" value={formData.jenis} onChange={handleInputChange}>
                    <option value="Sensor Tinggi Muka Air">Sensor Tinggi Muka Air</option>
                    <option value="Sensor Curah Hujan">Sensor Curah Hujan</option>
                    <option value="Sensor Debit Air">Sensor Debit Air</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Kode / ID Alat</label>
                  <input type="text" name="id" className="form-input" placeholder="Contoh: ALT-001" value={formData.id} onChange={handleInputChange} disabled={isEditOpen} />
                </div>
                <div className="form-group full-width">
                  <label>Nama Alat</label>
                  <input type="text" name="nama" className="form-input" placeholder="Masukkan nama alat..." value={formData.nama} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                  <label>Wilayah Sungai</label>
                  <select name="wilayah" className="form-select" value={formData.wilayah} onChange={handleInputChange}>
                    <option value="Sungai Brantas">Sungai Brantas</option>
                    <option value="Sungai Kadurus">Sungai Kadurus</option>
                    <option value="Sungai Bengawan Solo">Sungai Bengawan Solo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" className="form-select" value={formData.status} onChange={handleInputChange}>
                    <option value="Active">Active</option>
                    <option value="Maint.">Maintenance</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Lokasi</label>
                  <input type="text" name="lokasi" className="form-input" placeholder="Masukkan lokasi penempatan..." value={formData.lokasi} onChange={handleInputChange} />
                </div>
              </div>
            </div>
            <div className="ma-modal-footer">
              <button className="btn btn-outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>Batal</button>
              <button className="btn btn-primary" onClick={isAddOpen ? handleAddSubmit : handleEditSubmit}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteOpen && selectedAlat && (
        <div className="ma-modal-overlay" onClick={() => setIsDeleteOpen(false)}>
          <div className="ma-modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="ma-modal-body">
              <div className="delete-icon-wrapper">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h2 className="delete-title">Hapus Alat?</h2>
              <p className="delete-message">
                Apakah Anda yakin ingin menghapus alat <strong>{selectedAlat.nama}</strong> ({selectedAlat.id})? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="delete-actions">
                <button className="btn btn-outline" onClick={() => setIsDeleteOpen(false)}>Batal</button>
                <button className="btn btn-danger" onClick={handleDeleteSubmit} style={{ background: "var(--danger-color)", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAlat;
