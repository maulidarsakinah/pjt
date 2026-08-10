"""
buffer/sqlite_handler.py

Tanggung jawab modul ini:
    - Menyimpan data yang SUDAH lolos filter struktural (dari filter.py) ke
      SQLite lokal, sebagai buffer sementara sebelum diagregasi.
    - Menyediakan fungsi baca per device untuk dipakai aggregator.py.
    - Menghapus data yang SUDAH SUKSES terkirim ke database tujuan (Oracle/MySQL).

Kenapa SQLite (bukan in-memory list/dict):
    Data harus tetap ada walau proses Python restart/crash mendadak --
    terutama relevan kalau forwarding ke database tujuan gagal dan perlu retry.

Kebijakan penyimpanan (REVISI):
    - Data yang BERHASIL dikirim ke database tujuan -> DIHAPUS langsung dari
      buffer (bukan sekadar ditandai). Tidak ada gunanya menyimpan data yang
      sudah aman di database tujuan, dan menghapusnya menghemat ukuran file
      buffer secara signifikan untuk pemakaian jangka panjang.
    - Data yang GAGAL dikirim (mis. Oracle/MySQL down) -> TETAP di buffer,
      dicoba lagi otomatis di siklus agregasi berikutnya oleh aggregator.py.
    Konsekuensi: buffer HANYA pernah berisi dua jenis baris -- data yang
    baru masuk dari MQTT dan belum sempat diproses, ATAU data yang sudah
    diproses tapi gagal terkirim. Karena itu tidak perlu lagi kolom/flag
    "processed" -- keberadaan baris di tabel itu sendiri sudah berarti
    "masih perlu dikirim".

Catatan thread-safety:
    Koneksi SQLite dibuka dengan check_same_thread=False karena insert
    dipanggil dari thread milik paho-mqtt (via callback on_message),
    sedangkan read/delete dipanggil dari thread scheduler aggregator.
    Operasi dikunci per-call dengan threading.Lock() secara eksplisit,
    tidak mengandalkan SQLite secara implisit.
"""

import sqlite3
import logging
import threading

logger = logging.getLogger("sqlite_handler")


class SqliteBuffer:
    def __init__(self, db_path: str):
        self._db_path = db_path
        # check_same_thread=False: sengaja, karena insert (thread MQTT) dan
        # read/delete (thread scheduler) mengakses koneksi yang sama.
        # Lock manual (self._lock) yang menjaga akses tetap aman.
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._lock = threading.Lock()

    def init_schema(self):
        """
        Buat tabel buffer jika belum ada. Aman dipanggil berulang (idempotent).

        REVISI -- received_at sekarang WAKTU LOKAL (WIB), bukan UTC:
            Sebelumnya pakai DEFAULT CURRENT_TIMESTAMP, yang di SQLite SELALU
            UTC -- menyebabkan received_at tercatat mundur ~7 jam dari waktu
            asli WIB. Sekarang pakai DEFAULT (datetime('now','localtime')),
            yang mengikuti timezone OS komputer/server (asumsi: sudah di-set
            WIB). Ini juga membuat received_at konsisten dengan inserted_at
            di Oracle (SYSTIMESTAMP, waktu lokal server) dan window_end_time
            (lihat REVISI di aggregator.py).

        PENTING -- migrasi untuk database yang SUDAH ADA sebelumnya:
            SQLite tidak mendukung ALTER COLUMN DEFAULT. CREATE TABLE IF NOT
            EXISTS TIDAK akan mengubah skema tabel yang sudah terlanjur ada
            dengan default lama (UTC). Kalau file .db kamu sudah pernah dibuat
            sebelum revisi ini, WAJIB hapus dulu filenya (atau backup ke nama
            lain) supaya tabel dibuat ulang dengan default yang benar --
            lihat instruksi lengkap di jawaban chat.
        """
        with self._lock:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS raw_buffer (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_station TEXT NOT NULL,
                    terminal_time TEXT NOT NULL,
                    group_name TEXT,
                    vcc REAL,
                    battery REAL,
                    vout_solar REAL,
                    flow REAL,
                    velocity REAL,
                    totalizer REAL,
                    unit_total INTEGER,
                    received_at TIMESTAMP DEFAULT (datetime('now','localtime'))
                )
            """)
            # Index untuk query per station, dipakai aggregator.py tiap siklus.
            self._conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_station
                ON raw_buffer (id_station)
            """)
            self._conn.commit()
        logger.info("Skema SQLite buffer siap di: %s", self._db_path)

    def insert(self, data: dict):
        """
        Simpan satu payload yang sudah lolos filter struktural.
        Dipanggil dari callback MQTT (thread terpisah) -- karena itu pakai lock.
        """
        with self._lock:
            self._conn.execute("""
                INSERT INTO raw_buffer (
                    id_station, terminal_time, group_name,
                    vcc, battery, vout_solar, flow, velocity,
                    totalizer, unit_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data["idStation"],
                data["_terminalTime"],
                data.get("_groupName"),
                data["vcc"],
                data["battery"],
                data["vout_solar"],
                data["flow"],
                data["velocity"],
                data["totalizer"],
                data["unitTotal"],
            ))
            self._conn.commit()

    def fetch_all_by_station(self):
        """
        Ambil SEMUA baris yang masih ada di buffer, dikelompokkan per id_station.
        Karena baris yang sudah sukses terkirim langsung dihapus (lihat delete_rows),
        semua baris yang muncul di sini otomatis berarti "masih perlu dikirim"
        -- baik data baru maupun sisa gagal kirim dari siklus sebelumnya.

        Return: dict {id_station: [list of row dict]}
        """
        with self._lock:
            cursor = self._conn.execute("""
                SELECT id, id_station, terminal_time, vcc, battery,
                       vout_solar, flow, velocity, totalizer, unit_total,
                       received_at
                FROM raw_buffer
                ORDER BY id_station, terminal_time ASC
            """)
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]

        grouped = {}
        for row in rows:
            row_dict = dict(zip(columns, row))
            station = row_dict["id_station"]
            grouped.setdefault(station, []).append(row_dict)
        return grouped

    def delete_rows(self, row_ids: list):
        """
        Hapus baris berdasarkan id. Dipanggil HANYA setelah data berhasil
        dikirim ke database tujuan (Oracle/MySQL) -- lihat aggregator.py.
        Kalau pengiriman gagal, method ini TIDAK dipanggil, sehingga baris
        tetap ada di buffer untuk dicoba ulang siklus berikutnya.
        """
        if not row_ids:
            return
        with self._lock:
            placeholders = ",".join("?" for _ in row_ids)
            self._conn.execute(
                f"DELETE FROM raw_buffer WHERE id IN ({placeholders})",
                row_ids,
            )
            self._conn.commit()

    def close(self):
        with self._lock:
            self._conn.close()
        logger.info("Koneksi SQLite buffer ditutup.")