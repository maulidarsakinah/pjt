import { useMemo, useState } from "react";
import KPICard from "../components/KPICard";
import "./MasterAlat.css";

const DUMMY_ALAT = [
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

const MasterAlat = () => {
  const [filterJenis, setFilterJenis] = useState("");
  const [filterWilayah, setFilterWilayah] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filteredData = useMemo(() => {
    return DUMMY_ALAT.filter((item) => {
      const matchJenis = filterJenis ? item.jenis === filterJenis : true;
      const matchWilayah = filterWilayah ? item.wilayah === filterWilayah : true;
      const matchStatus = filterStatus ? item.status === filterStatus : true;
      return matchJenis && matchWilayah && matchStatus;
    });
  }, [filterJenis, filterWilayah, filterStatus]);

  const handleReset = () => {
    setFilterJenis("");
    setFilterWilayah("");
    setFilterStatus("");
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
          <button className="btn btn-primary" type="button">
            <i className="fa-solid fa-plus"></i> TAMBAH ALAT
          </button>
          <button className="btn btn-outline" type="button">
            <i className="fa-solid fa-download"></i> EXPORT
          </button>
        </div>

        <div className="table-container">
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
                      <button className="action-btn" title="Edit Alat">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button className="action-btn delete" title="Hapus Alat">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "40px" }}>
                    Tidak ada alat yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-footer">
          <div className="pagination-info">
            Menampilkan 1-{filteredData.length} dari {DUMMY_ALAT.length} entri
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
    </div>
  );
};

export default MasterAlat;
