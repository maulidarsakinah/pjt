"""
outputs/oracle_client.py

Tanggung jawab modul ini:
    - Membuka connection pool ke Oracle DB (akses langsung, sesuai keputusan
      proyek: bukan lewat REST API tim BE, demi performa & menghindari
      single point of failure tambahan).
    - Menerima dict hasil agregasi dari aggregator.py, insert ke tabel
      yang skemanya sudah disepakati dengan tim BE.
    - TIDAK menyimpan logic bisnis apa pun -- murni translasi dict -> row DB.

Library: python-oracledb, dijalankan dalam THICK MODE.

REVISI -- THICK MODE:
    Sebelumnya modul ini pakai mode default python-oracledb (thin mode),
    yang murni Python tanpa dependency eksternal. Sekarang diganti ke
    thick mode via oracledb.init_oracle_client(), yang MEWAJIBKAN Oracle
    Instant Client sudah terpasang di komputer/server yang menjalankan
    pipeline ini.

    Kenapa thick mode: dipakai kalau ada kebutuhan kompatibilitas fitur
    Oracle yang belum didukung penuh oleh thin mode (mis. versi Oracle lama,
    fitur Advanced Queuing, atau requirement spesifik dari tim BE/DBA).

    PENTING -- yang WAJIB disiapkan sebelum modul ini bisa start():
    1. Download & extract Oracle Instant Client (Basic atau Basic Light)
       sesuai versi & platform (Windows/Linux) dari situs resmi Oracle.
    2. Tentukan path folder hasil extract itu, isikan ke
       oracle_config["instant_client_lib_dir"] di config.yaml.
    3. init_oracle_client() dipanggil SEKALI saja per proses Python -- kalau
       start() dipanggil lebih dari sekali (mis. restart tanpa keluar proses),
       oracledb akan melempar error "already initialized". Ini ditangani di
       bawah dengan flag _thick_mode_initialized di level modul.

Kredensial & skema tabel:
    Nilai oracle_config (dsn, user, password, table_name) masih placeholder
    di config.yaml sampai tim BE memberikan info resmi. table_name dan nama
    kolom di query INSERT WAJIB dikonfirmasi ulang bareng tim BE sebelum
    modul ini benar-benar dijalankan -- jangan asumsikan nama kolom di bawah
    ini final.
"""

import logging

try:
    import oracledb
except ImportError:
    oracledb = None  # supaya modul tetap bisa di-import untuk development/test
                      # tanpa driver terpasang, error baru muncul saat start() dipanggil

logger = logging.getLogger("oracle_client")

# Flag level-modul: init_oracle_client() hanya boleh dipanggil SEKALI per
# proses Python (bukan per instance OracleForwarder), karena ini mengubah
# state global driver oracledb, bukan state per-object.
_thick_mode_initialized = False


class OracleForwarder:
    def __init__(self, oracle_config: dict):
        self._config = oracle_config
        self._pool = None
        raw_table_name = oracle_config.get("table_name", "CHANGE_ME")
        self._table_ref = self._build_quoted_table_ref(raw_table_name)

    @staticmethod
    def _build_quoted_table_ref(raw_table_name: str) -> str:
        """
        Bungkus SETIAP bagian (schema & nama tabel) dengan tanda kutip ganda
        SECARA TERPISAH, bukan membungkus keseluruhan "schema.tabel" jadi satu
        kutipan -- itu bug: Oracle akan membaca seluruh string di dalam satu
        kutip sebagai SATU identifier literal (termasuk titiknya), bukan
        sebagai referensi schema.tabel yang terpisah.

        Kenapa perlu dikutip sama sekali: tabel/kolom ini terdeteksi dibuat
        dengan quoted identifier (nama tersimpan lowercase persis, lihat
        screenshot DBeaver: id_station, unit_total, dst -- semua lowercase).
        Tanpa kutip, Oracle otomatis meng-uppercase identifier tanpa kutip
        saat parsing query, sehingga tidak akan pernah cocok dengan nama
        kolom/tabel asli yang lowercase.

        Contoh: "XXXX.tb_flow_lamongan" -> '"XXXX"."tb_flow_lamongan"'
                "tb_flow_lamongan"      -> '"tb_flow_lamongan"'
        """
        parts = raw_table_name.split(".")
        return ".".join(f'"{part}"' for part in parts)

    def start(self):
        """
        Inisialisasi thick mode (sekali per proses), lalu buat connection pool.
        Dipanggil sekali di awal (idealnya dari main.py), supaya tiap insert
        tidak buka-tutup koneksi baru (mahal & lambat).
        """
        global _thick_mode_initialized

        if oracledb is None:
            logger.critical(
                "Library 'oracledb' belum terpasang. Jalankan: pip install oracledb"
            )
            raise RuntimeError("oracledb tidak tersedia")

        # -----------------------------------------------------------------
        # Inisialisasi THICK MODE -- wajib sebelum create_pool() kalau mau
        # pakai thick mode. Cukup dipanggil sekali per proses.
        # -----------------------------------------------------------------
        if not _thick_mode_initialized:
            lib_dir = self._config.get("instant_client_lib_dir")
            if not lib_dir:
                logger.critical(
                    "Thick mode aktif tapi 'instant_client_lib_dir' belum diisi "
                    "di config.yaml (section oracle). Wajib diisi path folder "
                    "hasil extract Oracle Instant Client."
                )
                raise RuntimeError("instant_client_lib_dir belum dikonfigurasi")

            try:
                oracledb.init_oracle_client(lib_dir=lib_dir)
                _thick_mode_initialized = True
                logger.info("Oracle thick mode aktif, lib_dir=%s", lib_dir)
            except Exception as e:
                # Termasuk kasus "already initialized" kalau start() sempat
                # dipanggil lebih dari sekali dalam proses yang sama -- itu
                # bukan error fatal, cukup dicatat sebagai info.
                if "DPI-1047" in str(e) or "already" in str(e).lower():
                    logger.info(
                        "Oracle thick mode sudah pernah diinisialisasi sebelumnya, dilewati."
                    )
                    _thick_mode_initialized = True
                else:
                    logger.critical(
                        "Gagal inisialisasi Oracle thick mode (cek instant_client_lib_dir "
                        "dan pastikan Oracle Instant Client terpasang benar): %s", e,
                    )
                    raise

        # -----------------------------------------------------------------
        # Buat connection pool seperti biasa, sekarang berjalan di atas thick mode.
        # -----------------------------------------------------------------
        try:
            self._pool = oracledb.create_pool(
                dsn=self._config["dsn"],
                user=self._config["user"],
                password=self._config["password"],
                min=self._config.get("pool_min", 1),
                max=self._config.get("pool_max", 5),
                increment=self._config.get("pool_increment", 1),
            )
            logger.info("Oracle connection pool siap (dsn=%s, mode=thick).", self._config["dsn"])
        except Exception as e:
            logger.critical("Gagal membuat Oracle connection pool: %s", e)
            raise

    def send(self, aggregated: dict) -> bool:
        """
        Insert satu baris hasil agregasi ke Oracle.

        Return:
            True  -> berhasil, caller (aggregator.py) boleh hapus baris buffer
            False -> gagal, caller WAJIB membiarkan data tetap di SQLite buffer
                     supaya bisa di-retry siklus berikutnya
        """
        if self._pool is None:
            logger.error("Connection pool belum diinisialisasi, panggil start() dulu.")
            return False

        # NOTE: nama kolom di bawah ini dikutip ("...") supaya cocok dengan
        # tabel yang dibuat via quoted identifier (nama kolom tersimpan
        # lowercase persis, bukan otomatis uppercase). Kalau tim BE nanti
        # membuat ulang tabel TANPA tanda kutip (uppercase default Oracle),
        # tanda kutip di sini WAJIB dihapus supaya tidak jadi masalah serupa
        # yang terbalik.
        insert_sql = f"""
            INSERT INTO {self._table_ref} (
                "id_station", "window_end_time", "sample_count", "expected_samples",
                "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end",
                "vcc_last", "battery_last", "vout_solar_last", "unit_total"
            ) VALUES (
                :id_station, :window_end_time, :sample_count, :expected_samples,
                :flow_avg, :velocity_avg, :totalizer_delta, :totalizer_end,
                :vcc_last, :battery_last, :vout_solar_last, :unit_total
            )
        """

        # DEBUG SEMENTARA -- untuk troubleshooting. Bisa dinonaktifkan lagi
        # (ubah logging.level kembali ke INFO di config.yaml) setelah insert
        # berhasil normal beberapa siklus.
        logger.debug("table_ref yang dipakai = %s", self._table_ref)
        logger.debug("insert_sql yang akan dieksekusi:\n%s", insert_sql)

        try:
            with self._pool.acquire() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(insert_sql, aggregated)
                conn.commit()
            return True
        except Exception as e:
            # Semua error Oracle (koneksi putus, constraint violation, dsb)
            # ditangkap di sini -- caller cukup tahu "gagal", detail di log.
            logger.error(
                "Gagal insert ke Oracle untuk station=%s: %s",
                aggregated.get("id_station"), e,
            )
            return False

    def stop(self):
        if self._pool is not None:
            self._pool.close()
            logger.info("Oracle connection pool ditutup.")