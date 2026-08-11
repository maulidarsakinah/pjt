"""
inputs/mqtt_client.py

Tanggung jawab modul ini:
    1. Membuka koneksi ke MQTT broker (Mosquitto) dan subscribe topic flowmeter.
    2. Menerima payload mentah (bytes) dari broker -> decode -> json.loads (parsing).
    3. Menormalisasi tipe data tiap field berdasarkan mapping eksternal (YAML),
       BUKAN hardcoded if-else per nama field, supaya device/field baru bisa
       ditambahkan cukup lewat config tanpa mengubah kode ini.
    4. Meneruskan hasil normalisasi (dict) ke callback on_valid_message,
       yang akan menjalankan guard struktural (filter.py) di sisi caller.
    5. (REVISI) Watchdog: memantau kapan terakhir kali ada pesan MQTT masuk.
       Kalau tidak ada pesan sama sekali melebihi ambang waktu tertentu,
       log WARNING eksplisit -- supaya kondisi publisher mati/broker diam
       langsung terlihat di log secara real-time, bukan baru ketahuan
       belakangan lewat window agregasi yang kosong/tidak lengkap.

Catatan penting:
    - Proses JSON parsing SENGAJA tidak dipisah ke file tersendiri (parser.py)
      karena satu kesatuan logis dengan proses menerima pesan MQTT itu sendiri.
    - QoS yang dipakai: 0 (sesuai kesepakatan proyek, sinkron dengan interval
      publish device 5 detik -- bukan skenario high-frequency lagi).
"""

import json
import logging
import threading
import time
import yaml
import paho.mqtt.client as mqtt

logger = logging.getLogger("mqtt_client")


# ---------------------------------------------------------------------------
# Fungsi transformasi per tipe field.
# Mapping YAML akan merujuk ke NAMA fungsi ini (key), bukan logic langsung,
# supaya penambahan tipe baru cukup nambah satu fungsi + satu entry mapping.
# ---------------------------------------------------------------------------
def _to_string_float_dot(value):
    """Contoh: '24.00' -> 24.0 (vcc, battery)"""
    return float(value)


def _to_string_float_comma(value):
    """Contoh: '21,22' -> 21.22 (vout_solar)"""
    return float(str(value).replace(",", "."))


def _to_float(value):
    """Field yang sudah float asli dari JSON (flow, velocity) -> pass-through aman."""
    return float(value)


def _to_int(value):
    """Field integer (totalizer, unitTotal) -> pass-through aman."""
    return int(value)


def _passthrough(value):
    """Field string biasa yang tidak perlu dikonversi (idStation, _groupName, dst)."""
    return value


# Registry fungsi transformasi, dirujuk oleh nama string di mapping YAML.
TRANSFORM_REGISTRY = {
    "string_float_dot": _to_string_float_dot,
    "string_float_comma": _to_string_float_comma,
    "float": _to_float,
    "int": _to_int,
    "passthrough": _passthrough,
}

# Ambang waktu default (detik) tanpa pesan masuk sebelum watchdog menganggap
# publisher/broker bermasalah. Bisa dioverride lewat broker_config["stale_threshold_seconds"].
DEFAULT_STALE_THRESHOLD_SECONDS = 20  # ~4x interval publish device (5 detik)
WATCHDOG_CHECK_INTERVAL_SECONDS = 5


class MqttIngestor:
    def __init__(self, broker_config: dict, normalization_map_path: str, on_valid_message):
        """
        broker_config: dict berisi host, port, topic, keepalive, dsb dari config.yaml
        normalization_map_path: path ke file YAML mapping field -> tipe transformasi
        on_valid_message: callback(dict) yang dipanggil setelah payload berhasil
                           di-parse & dinormalisasi (validasi struktural dilakukan
                           oleh caller, bukan modul ini)
        """
        self._broker_config = broker_config
        self._on_valid_message = on_valid_message
        self._field_map = self._load_normalization_map(normalization_map_path)

        self._stale_threshold = broker_config.get(
            "stale_threshold_seconds", DEFAULT_STALE_THRESHOLD_SECONDS
        )

        # State watchdog: kapan terakhir pesan diterima, dan apakah warning
        # "publisher diam" sudah pernah dikirim untuk periode diam saat ini
        # (supaya tidak spam log tiap 5 detik selama publisher masih mati).
        self._last_message_time = None
        self._already_warned_stale = False
        self._watchdog_lock = threading.Lock()
        self._watchdog_stop_event = threading.Event()
        self._watchdog_thread = None

        self._client = mqtt.Client(
            client_id=broker_config.get("client_id", ""),
            clean_session=True,
        )
        self._client.on_connect = self._handle_connect
        self._client.on_message = self._handle_message
        self._client.on_disconnect = self._handle_disconnect

        # Kredensial broker jika ada (opsional, tergantung setup Mosquitto)
        username = broker_config.get("username")
        password = broker_config.get("password")
        if username:
            self._client.username_pw_set(username, password)

    # -----------------------------------------------------------------
    # Normalization mapping loader
    # -----------------------------------------------------------------
    def _load_normalization_map(self, path: str) -> dict:
        """
        Format normalization_map.yaml yang diharapkan:

            fields:
              vcc: string_float_dot
              battery: string_float_dot
              vout_solar: string_float_comma
              flow: float
              velocity: float
              totalizer: int
              unitTotal: int
              idStation: passthrough
              _terminalTime: passthrough
              _groupName: passthrough
        """
        try:
            with open(path, "r", encoding="utf-8") as f:
                raw_map = yaml.safe_load(f) or {}
        except FileNotFoundError:
            logger.critical("Normalization map tidak ditemukan: %s", path)
            raise

        field_map = raw_map.get("fields", {})
        if not field_map:
            logger.warning("Normalization map kosong, semua field akan passthrough apa adanya.")
        return field_map

    def _normalize(self, raw_data: dict) -> dict:
        """
        Terapkan transformasi per field sesuai mapping. Field yang TIDAK ada
        di mapping tetap dipertahankan apa adanya (passthrough default) --
        ini supaya device/field baru yang belum sempat di-mapping tidak
        membuat data hilang, hanya tidak ternormalisasi.
        """
        normalized = {}
        for key, value in raw_data.items():                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
            transform_name = self._field_map.get(key, "passthrough")
            transform_fn = TRANSFORM_REGISTRY.get(transform_name, _passthrough)
            try:
                normalized[key] = transform_fn(value)
            except (ValueError, TypeError) as e:
                # Gagal transform satu field -> jangan gagalkan seluruh payload,
                # tapi tandai None supaya guard struktural di filter.py bisa
                # menangkap dan menolaknya, bukan meloloskan data korup diam-diam.
                logger.warning(
                    "Gagal normalisasi field '%s' (nilai=%r, transform=%s): %s",
                    key, value, transform_name, e,
                )
                normalized[key] = None
        return normalized

    # -----------------------------------------------------------------
    # MQTT callbacks
    # -----------------------------------------------------------------
    def _handle_connect(self, client, userdata, flags, rc):
        if rc == 0:
            topic = self._broker_config["topic"]
            client.subscribe(topic, qos=self._broker_config.get("qos", 0))
            logger.info("Terhubung ke broker, subscribe topic: %s", topic)
            # Reset watchdog setiap kali (re)connect -- supaya jeda saat
            # reconnect tidak langsung dihitung sebagai "publisher mati".
            with self._watchdog_lock:
                self._last_message_time = time.time()
                self._already_warned_stale = False
        else:
            logger.error("Gagal terhubung ke broker, return code: %s", rc)

    def _handle_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning("Terputus dari broker secara tidak terduga (rc=%s). "
                            "paho-mqtt akan mencoba reconnect otomatis.", rc)

    def _handle_message(self, client, userdata, msg):
        # Catat waktu pesan masuk & reset flag warning -- publisher kembali aktif.
        with self._watchdog_lock:
            self._last_message_time = time.time()
            if self._already_warned_stale:
                logger.info(
                    "Data MQTT masuk kembali setelah sempat diam, topic=%s.",
                    msg.topic,
                )
            self._already_warned_stale = False

        # 1. Parsing: bytes -> dict
        try:
            raw_data = json.loads(msg.payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning("Payload tidak bisa di-parse sebagai JSON, dilewati: %s | raw=%r",
                            e, msg.payload)
            return

        if not isinstance(raw_data, dict):
            logger.warning("Payload valid JSON tapi bukan objek/dict, dilewati: %r", raw_data)
            return

        # 2. Normalisasi tipe data per field via mapping eksternal
        normalized_data = self._normalize(raw_data)

        # 3. Serahkan ke caller (main.py) untuk guard struktural + buffer
        self._on_valid_message(normalized_data)

    # -----------------------------------------------------------------
    # Watchdog: deteksi "tidak ada pesan masuk sama sekali"
    # -----------------------------------------------------------------
    def _watchdog_loop(self):
        while not self._watchdog_stop_event.is_set():
            self._watchdog_stop_event.wait(WATCHDOG_CHECK_INTERVAL_SECONDS)
            if self._watchdog_stop_event.is_set():
                break

            with self._watchdog_lock:
                last_time = self._last_message_time
                already_warned = self._already_warned_stale

            if last_time is None:
                # Belum pernah connect/terima pesan sama sekali sejak start.
                continue

            elapsed = time.time() - last_time
            if elapsed > self._stale_threshold and not already_warned:
                logger.warning(
                    "Tidak ada data MQTT masuk selama %.0f detik (ambang batas %ds). "
                    "Kemungkinan publisher/device mati atau koneksi broker bermasalah, "
                    "meski status koneksi client masih tersambung.",
                    elapsed, self._stale_threshold,
                )
                with self._watchdog_lock:
                    self._already_warned_stale = True

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    def start(self):
        host = self._broker_config["host"]
        port = self._broker_config.get("port", 1883)
        keepalive = self._broker_config.get("keepalive", 60)

        self._client.connect(host, port, keepalive)
        # loop_start() menjalankan network loop di thread terpisah (non-blocking),
        # supaya main.py tetap bisa menjalankan komponen lain (scheduler, dsb).
        self._client.loop_start()

        # Mulai watchdog di thread terpisah, jalan independen dari network loop.
        with self._watchdog_lock:
            self._last_message_time = time.time()  # anggap "baru mulai" sebagai baseline
        self._watchdog_thread = threading.Thread(target=self._watchdog_loop, daemon=True)
        self._watchdog_thread.start()
        logger.info(
            "MQTT watchdog aktif, ambang batas diam: %ds.", self._stale_threshold
        )

    def stop(self):
        self._watchdog_stop_event.set()
        if self._watchdog_thread:
            self._watchdog_thread.join(timeout=WATCHDOG_CHECK_INTERVAL_SECONDS + 2)
        self._client.loop_stop()
        self._client.disconnect()
        logger.info("MQTT ingestor dihentikan.")