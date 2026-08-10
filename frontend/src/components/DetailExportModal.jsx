import { useEffect, useMemo, useState } from "react";
import { getFlowStationData, getFlowStations } from "../services/api";
import { formatNumber } from "../utils/flowData";
import { buildPdfBlob } from "../utils/exportPdf";
import { buildCsvBlob, buildXlsxBlob } from "../utils/exportWorkbook";
import "./DetailExportModal.css";

function getTodayInWIB() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatWIBFromDate(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function normalizeStationKey(value) {
  return String(value || "").trim().toLowerCase();
}

function stationMatchesKey(station, stationKey) {
  const normalizedKey = normalizeStationKey(stationKey);
  return [station.id, station.kode_station, station.station_name].some(
    (value) => normalizeStationKey(value) === normalizedKey,
  );
}

function mapLiveReading(station, reading, index, { formatTime, formatDateTime, readingToRow }) {
  const row = readingToRow(station, reading);
  const base = {
    id: `${station.id}-${reading.id ?? index}`,
    stationId: String(station.id),
    time: formatTime(row.datetime),
    datetimeLabel: formatDateTime(row.datetime),
    timestamp: Date.parse(row.datetime || 0),
    schema: row.schema,
  };
  if (row.schema === "new") {
    return {
      ...base,
      debit: row.flow_avg,
      velocity: row.velocity_avg,
      totalizer: row.totalizer_end,
      vcc: row.vcc_last,
      battery: row.battery_last,
      vout_solar: row.vout_solar_last,
      unit_total: row.unit_total,
    };
  }
  return { ...base, debit: row.flow1, totalizer: row.totalizer1, vcc: row.vcc };
}

export default function DetailExportModal({
  open,
  onClose,
  station,
  stationKey,
  locationName,
  isDemoUser,
  DEMO_TABLE_DATA,
}) {
  const [format, setFormat] = useState("csv");
  const [mode, setMode] = useState("today");
  const [exportDate, setExportDate] = useState(() => getTodayInWIB());
  const [exportStart, setExportStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatWIBFromDate(d);
  });
  const [exportEnd, setExportEnd] = useState(() => getTodayInWIB());
  const [exportMonth, setExportMonth] = useState(() => getTodayInWIB().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // reset transient error when mode changes
  useEffect(() => setError(""), [mode, format]);

  // lock body scroll & Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const isValid = useMemo(() => {
    if (mode === "today") return true;
    if (mode === "date") return /^\d{4}-\d{2}-\d{2}$/.test(exportDate);
    if (mode === "7days") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exportStart) || !/^\d{4}-\d{2}-\d{2}$/.test(exportEnd)) return false;
      const s = new Date(exportStart);
      const e = new Date(exportEnd);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
      if (s > e) return false;
      const diffDays = Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
      return diffDays >= 1 && diffDays <= 7;
    }
    if (mode === "month") return /^\d{4}-\d{2}$/.test(exportMonth);
    return false;
  }, [mode, exportDate, exportStart, exportEnd, exportMonth]);

  const hint = useMemo(() => {
    if (mode === "7days" && /^\d{4}-\d{2}-\d{2}$/.test(exportStart) && /^\d{4}-\d{2}-\d{2}$/.test(exportEnd)) {
      const s = new Date(exportStart);
      const e = new Date(exportEnd);
      if (s > e) return "Tanggal mulai harus sebelum tanggal akhir.";
      const diffDays = Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
      if (diffDays > 7) return `Rentang ${diffDays} hari melebihi batas 7 hari.`;
    }
    return "";
  }, [mode, exportStart, exportEnd]);

  const handleExport = async () => {
    if (!isValid || exporting) return;
    setExporting(true);
    setError("");
    try {
      let query = {};
      let label = "";
      if (mode === "today") {
        query = { mode: "today" };
        label = getTodayInWIB();
      } else if (mode === "date") {
        query = { mode: "date", date: exportDate };
        label = exportDate;
      } else if (mode === "7days") {
        const sIso = new Date(`${exportStart}T00:00:00+07:00`).toISOString();
        const eDate = new Date(`${exportEnd}T00:00:00+07:00`);
        eDate.setDate(eDate.getDate() + 1);
        query = { mode: "range", start: sIso, end: eDate.toISOString() };
        label = `${exportStart}_to_${exportEnd}`;
      } else if (mode === "month") {
        const [y, m] = exportMonth.split("-").map(Number);
        const sIso = new Date(`${exportMonth}-01T00:00:00+07:00`).toISOString();
        const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
        query = { mode: "range", start: sIso, end: new Date(`${next}-01T00:00:00+07:00`).toISOString() };
        label = exportMonth;
      }

      let effectiveStation = station;
      if (!effectiveStation && isDemoUser) {
        effectiveStation = { id: "demo", station_name: locationName, kode_station: stationKey };
      }
      if (!effectiveStation && !isDemoUser) {
        const r = await getFlowStations({ limit: 100, offset: 0 });
        const found = (r.data || []).find((c) => stationMatchesKey(c, stationKey));
        if (!found) throw new Error("Stasiun tidak ditemukan.");
        effectiveStation = found;
      }

      let allRows = [];
      if (isDemoUser) {
        // keep synchronous — no API
        allRows = DEMO_TABLE_DATA.map((r) => ({ ...r, locationName }));
      } else {
        // lazy-load mapping deps to avoid circular
        const { formatTime, formatDateTime, readingToRow } = await import("../utils/flowData");
        const BATCH = 1000;
        let offset = 0;
        for (let i = 0; i < 20; i++) {
          const resp = await getFlowStationData(effectiveStation.id, { ...query, limit: BATCH, offset }, { ttlMs: 0 });
          const mapped = (resp.data || []).map((reading, idx) =>
            mapLiveReading(effectiveStation, reading, offset + idx, { formatTime, formatDateTime, readingToRow }),
          );
          allRows.push(...mapped);
          if (!resp.has_more || (resp.data || []).length < BATCH) break;
          offset += BATCH;
          if (allRows.length >= 10000) break;
        }
      }

      if (allRows.length === 0) {
        setError("Tidak ada data pada rentang terpilih.");
        setExporting(false);
        return;
      }

      const isNew = allRows[0]?.schema === "new";
      const headers = isNew
        ? ["Lokasi Stasiun", "Debit (m3/s)", "Velocity (m/s)", "Totalizer", "VCC (V)", "Battery (V)", "Vout Solar (V)", "Unit Total", "Status", "Waktu"]
        : ["Lokasi Stasiun", "Debit (m3/s)", "Totalizer (L)", "VCC (V)", "Status", "Waktu"];
      const rowsAsArrays = allRows.map((row) =>
        isNew
          ? [locationName, formatNumber(row.debit), formatNumber(row.velocity), formatNumber(row.totalizer, 0), formatNumber(row.vcc), formatNumber(row.battery), formatNumber(row.vout_solar), row.unit_total ?? "-", "Active", row.datetimeLabel]
          : [locationName, formatNumber(row.debit), formatNumber(row.totalizer, 0), formatNumber(row.vcc), "Active", row.datetimeLabel],
      );

      const safeStation = String(effectiveStation?.kode_station || stationKey || "station").replaceAll(/[^a-zA-Z0-9_-]/g, "_");
      const ext = format === "csv" ? "csv" : format === "pdf" ? "pdf" : "xlsx";
      const filename = `${safeStation}-${label}.${ext}`;

      let blob;
      if (format === "csv") blob = buildCsvBlob(headers, rowsAsArrays);
      else if (format === "pdf") blob = buildPdfBlob({ title: `HydroTrack - ${locationName}`, subtitle: `${safeStation} - ${label} - ${allRows.length} baris`, headers, rows: rowsAsArrays });
      else blob = buildXlsxBlob({ headers, rows: rowsAsArrays, sheetName: safeStation.slice(0, 31) });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      onClose();
    } catch (e) {
      setError(e?.message || "Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ht-export-overlay" role="dialog" aria-modal="true" aria-label="Export data" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ht-export-card">
        <div className="ht-export-topbar">
          <div className="ht-export-gauge" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
          <div className="ht-export-head">
            <div className="ht-export-eyebrow">HYDROTRACK - ARCHIVE EXPORT</div>
            <h2 className="ht-export-title">Export data stasiun</h2>
            <p className="ht-export-sub">{locationName} — pilih format dan rentang, file akan diunduh langsung tanpa pindah halaman.</p>
          </div>
          <button className="ht-export-close" aria-label="Tutup" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="ht-export-body">
          <div className="ht-export-section">
            <div className="ht-export-label"><i className="fa-solid fa-file-lines"></i> Format file</div>
            <div className="ht-export-formats" role="radiogroup" aria-label="Format">
              {[
                { id: "csv", label: "CSV", desc: "Spreadsheet universal", icon: "fa-file-csv" },
                { id: "pdf", label: "PDF", desc: "Laporan cetak", icon: "fa-file-pdf" },
                { id: "xlsx", label: "XLSX", desc: "Excel workbook", icon: "fa-file-excel" },
              ].map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)} className={`ht-format-card ${format === f.id ? "is-active" : ""}`}>
                  <span className="ht-format-icon"><i className={`fa-solid ${f.icon}`}></i></span>
                  <span className="ht-format-text"><strong>{f.label}</strong><span>{f.desc}</span></span>
                  <span className="ht-format-check" aria-hidden="true"><i className="fa-solid fa-check"></i></span>
                </button>
              ))}
            </div>
          </div>

          <div className="ht-export-section">
            <div className="ht-export-label"><i className="fa-regular fa-calendar"></i> Rentang tanggal</div>
            <div className="ht-export-modes" role="radiogroup" aria-label="Mode tanggal">
              {[
                { id: "today", label: "Today" },
                { id: "date", label: "Selected Date" },
                { id: "7days", label: "7 Days" },
                { id: "month", label: "Month" },
              ].map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)} className={`ht-mode-pill ${mode === m.id ? "is-active" : ""}`}>{m.label}</button>
              ))}
            </div>

            <div className="ht-export-dynamic">
              {mode === "today" && (
                <div className="ht-export-hint success"><i className="fa-regular fa-circle-check"></i><span>Akan mengekspor data hari ini <strong>{getTodayInWIB()}</strong> (WIB). Tidak perlu input tambahan.</span></div>
              )}
              {mode === "date" && (
                <label className="ht-export-field"><span>Pilih tanggal</span><input type="date" value={exportDate} max={getTodayInWIB()} onChange={(e) => setExportDate(e.target.value)} /></label>
              )}
              {mode === "7days" && (
                <div className="ht-export-range">
                  <label className="ht-export-field"><span>Tanggal mulai</span><input type="date" value={exportStart} max={exportEnd} onChange={(e) => setExportStart(e.target.value)} /></label>
                  <span className="ht-range-sep">—</span>
                  <label className="ht-export-field"><span>Tanggal akhir</span><input type="date" value={exportEnd} min={exportStart} max={getTodayInWIB()} onChange={(e) => setExportEnd(e.target.value)} /></label>
                </div>
              )}
              {mode === "month" && (
                <label className="ht-export-field"><span>Bulan & tahun</span><input type="month" value={exportMonth} max={getTodayInWIB().slice(0, 7)} onChange={(e) => setExportMonth(e.target.value)} /></label>
              )}
              {hint && <div className="ht-export-hint error"><i className="fa-solid fa-triangle-exclamation"></i> {hint}</div>}
              {mode === "7days" && !hint && <div className="ht-export-hint">Maksimal 7 hari. Dipakai untuk membatasi beban query & ukuran file.</div>}
              {mode === "month" && <div className="ht-export-hint">Mengekspor satu bulan penuh — dari tanggal 1 jam 00:00 WIB sampai awal bulan berikutnya.</div>}
            </div>
          </div>

          {error && <div className="ht-export-hint error" role="alert"><i className="fa-solid fa-circle-exclamation"></i> {error}</div>}

          <div className="ht-export-foot">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={exporting}>Batal</button>
            <button type="button" className="btn btn-primary ht-export-action" disabled={!isValid || exporting} onClick={handleExport} aria-disabled={!isValid || exporting}>
              {exporting ? <><i className="fa-solid fa-spinner fa-spin"></i> Menyiapkan {format.toUpperCase()}…</> : <><i className="fa-solid fa-download"></i> Export {format.toUpperCase()}</>}
            </button>
          </div>
          <div className="ht-export-meta">
            File: <code>{String(station?.kode_station || stationKey || "station").replaceAll(/[^a-zA-Z0-9_-]/g, "_")}-{(mode === "today" ? getTodayInWIB() : mode === "date" ? exportDate : mode === "7days" ? `${exportStart}_to_${exportEnd}` : exportMonth)}.{format}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
