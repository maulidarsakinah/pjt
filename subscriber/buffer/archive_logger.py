"""
buffer/archive_logger.py

Tanggung jawab modul ini:
    - Menulis SETIAP payload yang masuk (sudah lolos filter struktural) ke
      file arsip JSON Lines (.jsonl), sebagai catatan mentah permanen.

BUKAN pengganti SqliteBuffer:
    - File ini TIDAK PERNAH dibaca ulang oleh aggregator.py, dan TIDAK PERNAH
      dihapus otomatis oleh pipeline. Sifatnya murni arsip pasif (write-only
      dari sisi pipeline), untuk keperluan audit/debug/reprocessing di masa
      depan -- bukan working buffer untuk retry atau agregasi.
    - Untuk retry saat DB tujuan mati & agregasi per window, itu tetap
      tanggung jawab SqliteBuffer (buffer/sqlite_handler.py).

Kenapa JSON Lines (.jsonl), bukan .txt bebas atau JSON array biasa:
    - Satu baris = satu objek JSON valid dan berdiri sendiri -> bisa di-append
      terus-menerus tanpa perlu baca-parse seluruh isi file dulu (beda dengan
      JSON array [...] yang butuh load semua isi sebelum bisa nambah elemen).
    - Gampang dibaca ulang nanti pakai json.loads() per baris, atau
      pandas.read_json(path, lines=True) untuk analisis massal.

Kenapa file dipisah per hari (rotasi harian):
    - Supaya satu file tidak membengkak tanpa batas selama pipeline berjalan
      terus-menerus dalam hitungan bulan. Rotasi per hari juga memudahkan
      pencarian data berdasarkan tanggal kejadian saat audit manual.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("archive_logger")

# REVISI: seluruh timestamp di pipeline (received_at SQLite, window_end_time
# & inserted_at Oracle) sudah distandarkan ke WIB (UTC+7), BUKAN UTC lagi.
# _archived_at & rotasi nama file di sini menyusul, supaya konsisten --
# sebelumnya pakai UTC sehingga tercatat mundur ~7 jam dari waktu asli.
LOCAL_TZ = timezone(timedelta(hours=7))


class ArchiveLogger:
    def __init__(self, archive_dir: str):
        """
        archive_dir: folder tempat file .jsonl harian disimpan, mis. "./archive"
        Nama file otomatis: archive_YYYY-MM-DD.jsonl, berdasarkan tanggal WIB
        (bukan UTC lagi) -- supaya rotasi harian jatuh di pergantian hari
        yang sesuai jam lokal, bukan jam UTC yang berbeda ~7 jam.
        """
        self._archive_dir = archive_dir
        self._lock = threading.Lock()
        os.makedirs(self._archive_dir, exist_ok=True)

    def _current_file_path(self) -> str:
        date_str = datetime.now(LOCAL_TZ).strftime("%Y-%m-%d")
        filename = f"archive_{date_str}.jsonl"
        return os.path.join(self._archive_dir, filename)

    def write(self, data: dict):
        """
        Tulis satu payload sebagai satu baris JSON. Dipanggil dari callback
        MQTT (thread terpisah) -- karena itu pakai lock, sama seperti
        SqliteBuffer.insert().

        Kegagalan menulis arsip TIDAK BOLEH mengganggu alur utama pipeline
        (buffer & agregasi tetap harus jalan meski disk penuh/permission
        error, dsb) -- karena itu exception ditangkap & di-log di sini,
        bukan dilempar ke caller.
        """
        record = dict(data)  # copy, jangan ubah dict asli milik caller
        # _archived_at sekarang WIB (offset +07:00 ikut tersimpan di string
        # ISO 8601-nya, karena masih pakai objek timezone-aware) -- beda
        # dengan received_at/window_end_time yang naive, di sini sengaja
        # tetap tz-aware supaya siapapun baca file .jsonl ini langsung tahu
        # persis timezone-nya tanpa perlu asumsi tambahan.
        record["_archived_at"] = datetime.now(LOCAL_TZ).isoformat()

        try:
            line = json.dumps(record, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            logger.error("Gagal serialize data ke JSON, arsip dilewati: %s | data=%r", e, data)
            return

        try:
            with self._lock:
                with open(self._current_file_path(), "a", encoding="utf-8") as f:
                    f.write(line + "\n")
        except OSError as e:
            logger.error("Gagal menulis ke file arsip: %s", e)