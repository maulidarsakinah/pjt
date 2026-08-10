"""
main.py
Entry point orchestrator untuk HydroTrack Data Pipeline.

Alur:
    MQTT Broker -> mqtt_client (subscribe + parse + normalisasi)
                -> filter (guard struktural)
                -> sqlite_handler (buffer sementara)
                -> aggregator (rollup per window 1 menit, dijalankan terpisah/berkala)
                -> oracle_client (forward data matang ke Oracle DB)

Catatan scope:
    File ini HANYA orchestrator. Logic detail tiap tahap ada di modul masing-masing
    (inputs/, buffer/, processors/, outputs/). main.py tidak boleh berisi business logic.
"""

import logging
import signal
import sys
import time
import yaml

from inputs.mqtt_client import MqttIngestor
from inputs.filter import validate_payload
from buffer.sqlite_handler import SqliteBuffer
from buffer.archive_logger import ArchiveLogger
from processors.aggregator import AggregationScheduler
from outputs.oracle_client import OracleForwarder  

# ---------------------------------------------------------------------------
# Setup logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


def load_config(path: str = "config.yaml") -> dict:
    """Load konfigurasi dari file YAML (broker, buffer, oracle, dsb)."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        logger.critical("config.yaml tidak ditemukan di path: %s", path)
        sys.exit(1)
    except yaml.YAMLError as e:
        logger.critical("config.yaml gagal di-parse: %s", e)
        sys.exit(1)


def build_message_handler(sqlite_buffer: SqliteBuffer, archive_logger: ArchiveLogger):
    """
    Membungkus alur: payload sudah di-parse & dinormalisasi oleh mqtt_client
    -> divalidasi strukturnya oleh filter -> jika lolos:
         1. disimpan ke SQLite buffer (working data untuk agregasi & retry)
         2. ditulis ke archive_logger (arsip mentah permanen, tidak pernah
            dihapus otomatis -- lihat penjelasan di archive_logger.py)

    Payload yang gagal validasi TIDAK membuat proses berhenti — hanya di-log
    dan di-skip, sesuai kesepakatan bahwa anomali nilai dipantau manual di web,
    tapi kerusakan struktur tetap harus dicegah masuk ke buffer maupun arsip.
    """

    def handle_message(normalized_data: dict):
        is_valid, reason = validate_payload(normalized_data)
        if not is_valid:
            logger.warning(
                "Payload dilewati (gagal validasi struktural): %s | data=%s",
                reason,
                normalized_data,
            )
            return

        try:
            sqlite_buffer.insert(normalized_data)
        except Exception as e:
            # Kegagalan tulis ke buffer tidak boleh mematikan MQTT listener.
            logger.error("Gagal menyimpan data ke buffer lokal: %s", e)

        # Arsip mentah -- independen dari sukses/gagalnya insert ke buffer.
        # Kalau insert ke SQLite gagal tapi arsip tetap tercatat, itu justru
        # jadi jaring pengaman tambahan (data mentah tidak hilang total).
        archive_logger.write(normalized_data)

    return handle_message


def main():
    config = load_config()

    # -----------------------------------------------------------------
    # Inisialisasi komponen pipeline
    # -----------------------------------------------------------------
    sqlite_buffer = SqliteBuffer(db_path=config["buffer"]["sqlite_path"])
    sqlite_buffer.init_schema()

    archive_logger = ArchiveLogger(archive_dir=config["buffer"]["archive_dir"])

    db_forwarder = OracleForwarder(oracle_config=config["oracle"])
    db_forwarder.start()

    aggregation_scheduler = AggregationScheduler(
        sqlite_buffer=sqlite_buffer,
        oracle_forwarder=db_forwarder,
        window_seconds=config["aggregation"]["window_seconds"],
        incomplete_window_policy=config["aggregation"].get(
            "incomplete_window_policy", "wait_next_cycle"
        ),
        incomplete_window_max_age_seconds=config["aggregation"].get(
            "incomplete_window_max_age_seconds", 180
        ),
        check_interval_seconds=config["aggregation"].get(
            "check_interval_seconds", 5
        ),
    )

    message_handler = build_message_handler(sqlite_buffer, archive_logger)

    mqtt_ingestor = MqttIngestor(
        broker_config=config["mqtt"],
        normalization_map_path=config["normalization"]["mapping_path"],
        on_valid_message=message_handler,
    )

    # -----------------------------------------------------------------
    # Graceful shutdown handler
    # -----------------------------------------------------------------
    def shutdown(signum, frame):
        logger.info("Sinyal shutdown diterima (%s), menghentikan pipeline...", signum)
        mqtt_ingestor.stop()
        aggregation_scheduler.stop()
        db_forwarder.stop()
        sqlite_buffer.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # -----------------------------------------------------------------
    # Jalankan pipeline
    # -----------------------------------------------------------------
    logger.info("Menjalankan HydroTrack pipeline...")
    mqtt_ingestor.start()          # non-blocking, jalan di thread/loop terpisah
    aggregation_scheduler.start()  # scheduler window agregasi, jalan berkala

    # Main thread idle, menunggu sinyal shutdown
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()