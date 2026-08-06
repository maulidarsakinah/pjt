import { useState, useMemo } from "react";
import KPICard from "../components/KPICard";
import "./MasterData.css";

const DUMMY_STATIONS = [
  {
    id: 1,
    kode_station: "WS-001",
    nama: "Wilayah Sungai Brantas",
    x: -7.1234,
    y: 112.1234,
    z: 10.5,
    id_desa: 101,
    WaterLevel: 1,
    Rainfall: 1,
    Repeater: 0,
    Master: 1,
    Sub: 0,
    Branch: 0,
    GSMRainfall: 1,
    GSMWaterlevel: 1,
    TableData: "tb_ws_001",
    indexhuluhilir: 0,
    nostation: "ST-001",
    clock: 1,
    validpos: "Yes",
    objecttype: "WS",
    SIAGAWaterlevel: "3.5",
    SIAGADisch: "100",
    ws: 1,
    wl_decimal_num: 2,
    visible: "Yes",
    enabled: 1,
    GSMWQMS: 0,
    TableDataForecast: "tb_f_001",
    hasForecast: 1,
    hasWLOffset: 0,
    WLOffset: 0,
    history_nomor: "HIST-001",
    provider: "Telkomsel",
    sigab_enabled: 1,
    stastion_type: "WILAYAH",
    aq_location_identifier: 1,
    id_api: "api_ws_001",
    template_api: "template_1",
    GSMINSTR: 1,
    GSMFLOW: 1,
    resolution: "high"
  },
  {
    id: 2,
    kode_station: "LOK-042",
    nama: "Bendungan Karangkates",
    x: -8.1564,
    y: 112.4851,
    z: 15.2,
    id_desa: 102,
    WaterLevel: 1,
    Rainfall: 0,
    Repeater: 0,
    Master: 0,
    Sub: 1,
    Branch: 0,
    GSMRainfall: 0,
    GSMWaterlevel: 1,
    TableData: "tb_lok_042",
    indexhuluhilir: 1,
    nostation: "ST-042",
    clock: 1,
    validpos: "Yes",
    objecttype: "LOK",
    SIAGAWaterlevel: "4.0",
    SIAGADisch: "150",
    ws: 1,
    wl_decimal_num: 2,
    visible: "Yes",
    enabled: 1,
    GSMWQMS: 0,
    TableDataForecast: "tb_f_042",
    hasForecast: 0,
    hasWLOffset: 1,
    WLOffset: 0.5,
    history_nomor: "HIST-042",
    provider: "Indosat",
    sigab_enabled: 1,
    stastion_type: "LOKASI",
    aq_location_identifier: 2,
    id_api: "api_lok_042",
    template_api: "template_2",
    GSMINSTR: 1,
    GSMFLOW: 0,
    resolution: "high"
  },
  {
    id: 3,
    kode_station: "SNR-889",
    nama: "Sensor Ultrasonik A1",
    x: -7.5564,
    y: 112.2851,
    z: 5.2,
    id_desa: 103,
    WaterLevel: 0,
    Rainfall: 1,
    Repeater: 0,
    Master: 0,
    Sub: 1,
    Branch: 0,
    GSMRainfall: 1,
    GSMWaterlevel: 0,
    TableData: "tb_snr_889",
    indexhuluhilir: 2,
    nostation: "ST-889",
    clock: 1,
    validpos: "Yes",
    objecttype: "SNR",
    SIAGAWaterlevel: "0",
    SIAGADisch: "0",
    ws: 1,
    wl_decimal_num: 2,
    visible: "No",
    enabled: 0,
    GSMWQMS: 0,
    TableDataForecast: "",
    hasForecast: 0,
    hasWLOffset: 0,
    WLOffset: 0,
    history_nomor: "HIST-889",
    provider: "XL",
    sigab_enabled: 0,
    stastion_type: "SENSOR",
    aq_location_identifier: 3,
    id_api: "api_snr_889",
    template_api: "template_3",
    GSMINSTR: 0,
    GSMFLOW: 0,
    resolution: "medium"
  },
  {
    id: 4,
    kode_station: "PRM-005",
    nama: "pH Air Permukaan",
    x: -7.6564,
    y: 112.3851,
    z: 8.2,
    id_desa: 104,
    WaterLevel: 1,
    Rainfall: 1,
    Repeater: 0,
    Master: 0,
    Sub: 0,
    Branch: 1,
    GSMRainfall: 1,
    GSMWaterlevel: 1,
    TableData: "tb_prm_005",
    indexhuluhilir: 3,
    nostation: "ST-005",
    clock: 1,
    validpos: "Yes",
    objecttype: "PRM",
    SIAGAWaterlevel: "2.0",
    SIAGADisch: "50",
    ws: 1,
    wl_decimal_num: 2,
    visible: "Yes",
    enabled: 1,
    GSMWQMS: 1,
    TableDataForecast: "tb_f_005",
    hasForecast: 1,
    hasWLOffset: 0,
    WLOffset: 0,
    history_nomor: "HIST-005",
    provider: "Telkomsel",
    sigab_enabled: 1,
    stastion_type: "PARAMETER",
    aq_location_identifier: 4,
    id_api: "api_prm_005",
    template_api: "template_4",
    GSMINSTR: 1,
    GSMFLOW: 1,
    resolution: "high"
  },
  {
    id: 5,
    kode_station: "WS-005",
    nama: "Wilayah Sungai Citarum",
    x: -6.9234,
    y: 107.6234,
    z: 20.5,
    id_desa: 105,
    WaterLevel: 1,
    Rainfall: 1,
    Repeater: 0,
    Master: 1,
    Sub: 0,
    Branch: 0,
    GSMRainfall: 1,
    GSMWaterlevel: 1,
    TableData: "tb_ws_005",
    indexhuluhilir: 0,
    nostation: "ST-005",
    clock: 1,
    validpos: "Yes",
    objecttype: "WS",
    SIAGAWaterlevel: "5.0",
    SIAGADisch: "200",
    ws: 2,
    wl_decimal_num: 2,
    visible: "Yes",
    enabled: 1,
    GSMWQMS: 0,
    TableDataForecast: "tb_f_005_c",
    hasForecast: 1,
    hasWLOffset: 0,
    WLOffset: 0,
    history_nomor: "HIST-005-C",
    provider: "Telkomsel",
    sigab_enabled: 1,
    stastion_type: "WILAYAH",
    aq_location_identifier: 5,
    id_api: "api_ws_005",
    template_api: "template_1",
    GSMINSTR: 1,
    GSMFLOW: 1,
    resolution: "high"
  }
];

const MasterData = () => {
  const [selectedStation, setSelectedStation] = useState(null);

  const summary = useMemo(() => {
    return {
      total: DUMMY_STATIONS.length,
      active: DUMMY_STATIONS.filter((s) => s.enabled === 1).length,
      waterlevel: DUMMY_STATIONS.filter((s) => s.WaterLevel === 1).length,
      rainfall: DUMMY_STATIONS.filter((s) => s.Rainfall === 1).length,
    };
  }, []);

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
          title="SENSOR WATERLEVEL"
          value={summary.waterlevel}
          icon="fa-water"
          descText="Sensor pemantau ketinggian air."
          accent="#F59E0B"
        />
        <KPICard
          title="SENSOR RAINFALL"
          value={summary.rainfall}
          icon="fa-cloud-rain"
          descText="Sensor pemantau curah hujan."
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
            <button className="btn btn-primary" type="button">
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
                <th>ID DESA</th>
                <th>KODE STATION</th>
                <th>NAMA</th>
                <th>STATION TYPE</th>
                <th>STATUS</th>
                <th style={{ textAlign: "center" }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {DUMMY_STATIONS.map((station) => (
                <tr key={station.id}>
                  <td>{station.id_desa}</td>
                  <td>
                    <b>{station.kode_station}</b>
                  </td>
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
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
};

export default MasterData;
