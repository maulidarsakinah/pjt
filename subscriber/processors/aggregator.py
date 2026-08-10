"""
processors/aggregator.py

Tanggung jawab modul ini:
    - Berjalan berkala (default tiap 60 detik / window_seconds dari config)
    - Ambil semua data yang masih ada di SQLite buffer, dikelompokkan per device
    - Hitung agregat sesuai rule spesifik per field (BUKAN average untuk semua field)
    - Forward hasil agregat ke database tujuan (Oracle/MySQL) via forwarder
    - HAPUS baris SQLite yang sudah SUKSES terkirim

Rule agregasi per field (sesuai kesepakatan proyek):
    - flow, velocity          -> rata-rata (average) selama window
    - totalizer                -> delta (nilai akhir - nilai awal), karena cumulative
    - vcc, battery, vout_solar -> last-value (nilai paling akhir dalam window),
                                   dipilih daripada average karena field ini
                                   representasi kondisi SAAT INI perangkat,
                                   bukan sesuatu yang bermakna dirata-rata
    - unitTotal                -> diambil apa adanya (konstanta satuan, tidak berubah)

REVISI -- kebijakan buffer:
    Data yang BERHASIL terkirim langsung DIHAPUS dari SQLite (bukan ditandai
    processed). Data yang GAGAL terkirim TETAP di buffer untuk di-retry
    siklus berikutnya.

REVISI -- incomplete_window_policy SEKARANG BENAR-BENAR DIPAKAI:
    Sebelumnya nilai ini di-load dari config.yaml tapi tidak pernah dicek di
    kode -- semua window selalu diproses apa adanya. Sekarang tiga opsi ini
    benar-benar menentukan perilaku:

    "wait_next_cycle" (default):
        Window dengan sample_count < EXPECTED_SAMPLES_PER_WINDOW TIDAK dikirim
        dan TIDAK dihapus dari buffer -- data tetap tersimpan, menunggu
        tambahan sample masuk di siklus berikutnya sampai genap (atau sampai
        kena batas incomplete_window_max_age_seconds, lihat di bawah).

        Safety net: kalau baris tertua di window itu sudah lebih tua dari
        incomplete_window_max_age_seconds (mis. publisher mati permanen,
        tidak akan pernah genap lagi), window DIPAKSA diproses & dikirim apa
        adanya -- supaya data tidak menumpuk di buffer selamanya menunggu
        sesuatu yang tidak akan pernah terjadi.

    "process_anyway":
        Window kurang lengkap tetap langsung dikirim & dihapus, tanpa menunggu.

    "discard":
        Window kurang lengkap dibuang (dihapus dari buffer) TANPA dikirim ke
        database tujuan -- dipakai kalau data parsial memang tidak diinginkan
        sama sekali.

REVISI -- window_end_time sekarang datetime asli, bukan string:
    Sebelumnya field ini dikirim apa adanya dari _terminalTime device (string
    mentah "2026-07-31 14:41:42"). Sekarang di-parse jadi objek datetime
    Python via _parse_terminal_time() sebelum dikirim ke forwarder, supaya
    tersimpan sebagai TIMESTAMP native di database tujuan (bukan VARCHAR2/TEXT)
    -- lebih akurat untuk query rentang waktu & sorting.
"""

import logging
import threading
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("aggregator")

# REVISI: seluruh timestamp di pipeline (received_at SQLite, window_end_time
# Oracle/MySQL) sekarang distandarkan ke WIB (UTC+7), BUKAN UTC -- supaya
# konsisten dengan inserted_at (SYSTIMESTAMP Oracle, waktu lokal server) dan
# tidak membingungkan saat dibaca manual lewat DBeaver. Kalau proyek nanti
# perlu dukung banyak timezone berbeda, ini WAJIB diganti jadi konfigurasi
# per station, bukan konstanta tetap seperti sekarang.
LOCAL_TZ = timezone(timedelta(hours=7))

EXPECTED_SAMPLES_PER_WINDOW = 12  # asumsi interval device 5 detik, window 60 detik
VALID_POLICIES = {"wait_next_cycle", "process_anyway", "discard"}


class AggregationScheduler:
    def __init__(
        self,
        sqlite_buffer,
        oracle_forwarder,
        window_seconds: int,
        incomplete_window_policy: str = "wait_next_cycle",
        incomplete_window_max_age_seconds: int = 180,
        check_interval_seconds: int = 5,
    ):
        """
        REVISI -- check_interval_seconds dipisah dari window_seconds:

        Sebelumnya scheduler cuma cek buffer sekali per window_seconds (60
        detik), TIDAK selaras dengan batas menit kalender asli data device.
        Akibatnya: window yang sebenarnya sudah lengkap (12 sample, menit
        kalendernya sudah selesai) baru terdeteksi & terkirim di siklus cek
        BERIKUTNYA -- bisa telat sampai puluhan detik tanpa alasan, padahal
        datanya sudah lengkap sejak sample ke-12 masuk.

        Sekarang scheduler cek buffer JAUH LEBIH SERING (default tiap 5 detik,
        via check_interval_seconds), sementara window_seconds tetap dipakai
        sebagai acuan LOGIS ukuran window (dipakai di logging/dokumentasi,
        bukan lagi jadi jeda antar pengecekan). Begitu satu menit kalender
        genap 12 sample, window itu terkirim di siklus cek berikutnya --
        keterlambatan turun dari puluhan detik jadi maksimal seukuran
        check_interval_seconds.
        """
        self._buffer = sqlite_buffer
        self._forwarder = oracle_forwarder
        self._window_seconds = window_seconds
        self._check_interval_seconds = check_interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

        if incomplete_window_policy not in VALID_POLICIES:
            logger.warning(
                "incomplete_window_policy '%s' tidak dikenali, fallback ke 'wait_next_cycle'. "
                "Opsi valid: %s",
                incomplete_window_policy, VALID_POLICIES,
            )
            incomplete_window_policy = "wait_next_cycle"
        self._incomplete_policy = incomplete_window_policy
        self._incomplete_max_age = incomplete_window_max_age_seconds

    # -----------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------
    def start(self):
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(
            "Aggregation scheduler dimulai, window logis=%ss, "
            "cek buffer tiap=%ss, incomplete_window_policy=%s",
            self._window_seconds, self._check_interval_seconds, self._incomplete_policy,
        )

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Aggregation scheduler dihentikan.")

    def _run_loop(self):
        while not self._stop_event.is_set():
            self._stop_event.wait(self._check_interval_seconds)
            if self._stop_event.is_set():
                break
            try:
                self._process_window()
            except Exception as e:
                logger.error("Gagal memproses window agregasi: %s", e, exc_info=True)

    # -----------------------------------------------------------------
    # Core aggregation logic
    # -----------------------------------------------------------------
    def _process_window(self):
        """
        REVISI -- CHUNKING BACKLOG:
        Sebelumnya method ini mengambil SEMUA baris milik satu station dan
        mengagregasinya jadi SATU baris hasil, apapun jumlahnya. Ini bermasalah
        kalau database tujuan sempat down lama: buffer bisa menumpuk ratusan
        baris (mis. Oracle mati 2 jam -> ~1440 baris), lalu begitu berhasil
        kirim lagi, SEMUA itu digabung jadi SATU window "raksasa" -- flow_avg
        jadi rata-rata 2 jam (bukan 1 menit), dan window_end_time cuma
        mencerminkan sample TERAKHIR, padahal datanya mewakili rentang waktu
        jauh lebih panjang. Di grafik dashboard, ini muncul sebagai satu titik
        ganjil di waktu "sekarang", bukan pola natural tersebar di sepanjang
        waktu backlog terjadi -- BEDA dari kondisi seharusnya kalau publisher
        berhasil terus mengirim normal.

        Sekarang: baris per station dipecah jadi CHUNK berukuran maksimal
        EXPECTED_SAMPLES_PER_WINDOW (12), diurutkan berdasarkan waktu (rows
        sudah ASC dari query). Tiap chunk diagregasi & dikirim TERPISAH,
        sehingga tiap baris hasil tetap merepresentasikan window ~1 menit
        yang sesungguhnya, dengan window_end_time yang benar sesuai waktu
        aslinya masing-masing -- bukan satu blob rata-rata yang menyesatkan.

        Chunk terakhir (sisa < 12 sample) diperlakukan sebagai window
        "belum lengkap", diproses lewat _decide_incomplete_action() seperti
        biasa (wait_next_cycle / process_anyway / discard).
        """
        grouped_data = self._buffer.fetch_all_by_station()

        if not grouped_data:
            logger.debug("Tidak ada data di buffer, lewati siklus agregasi ini.")
            return

        for station, rows in grouped_data.items():
            chunks = self._chunk_rows(rows)

            if len(chunks) > 1:
                logger.info(
                    "Backlog terdeteksi untuk station=%s: %d baris dipecah jadi "
                    "%d window terpisah, "
                    "untuk tetap merepresentasikan ~1 menit data asli.",
                    station, len(rows), len(chunks),
                )

            for chunk in chunks:
                self._process_single_chunk(station, chunk)

    def _chunk_rows(self, rows: list) -> list:
        """
        CLOCK-ALIGNED CHUNKING: rows dikelompokkan berdasarkan MENIT ASLI dari
        _terminalTime device (semua sample dengan menit 09:46 jadi satu grup,
        apapun jumlah sample-nya) -- supaya window_end_time hasil agregasi
        benar-benar merepresentasikan rentang waktu nyata di lapangan, cocok
        dipakai sebagai sumbu waktu grafik yang presisi per menit.

        Tiap grup menit langsung jadi SATU chunk utuh, tidak ada pembatasan
        ukuran maksimal per chunk -- kalau suatu menit ternyata berisi lebih
        dari EXPECTED_SAMPLES_PER_WINDOW (12) sample (kasus jarang, mis. device
        sempat kirim lebih rapat dari biasanya), semuanya tetap digabung jadi
        satu window yang sama, bukan dipotong lagi.
        """
        # Kelompokkan per menit, urutan grup mengikuti urutan rows ASC (jadi
        # otomatis kronologis, tidak perlu sorting tambahan).
        minute_groups = {}
        group_order = []

        for row in rows:
            parsed = self._parse_terminal_time(row["terminal_time"])
            if isinstance(parsed, datetime):
                minute_key = parsed.replace(second=0, microsecond=0)
            else:
                # Fallback kalau parsing gagal (format tak dikenal) -- jangan
                # sampai bikin proses crash, tiap baris begini dapat "menit"
                # tersendiri (tidak digabung ke grup manapun) supaya tetap
                # kekirim, cuma sendirian, sambil warning sudah ter-log di
                # _parse_terminal_time sebelumnya.
                minute_key = ("unparsed", row["terminal_time"])

            if minute_key not in minute_groups:
                minute_groups[minute_key] = []
                group_order.append(minute_key)
            minute_groups[minute_key].append(row)

        return [minute_groups[key] for key in group_order]

    def _chunk_minute_label(self, rows: list) -> str:
        """
        Hasilkan label menit window (mis. "2026-08-07 09:49") berdasarkan
        terminal_time baris pertama dalam chunk, untuk ditampilkan di log --
        supaya warning/info log langsung menunjukkan window MANA yang
        dimaksud, bukan cuma waktu kapan log itu dicetak (yang bisa jauh
        beda dengan waktu asli window-nya, terutama saat memproses backlog).
        """
        if not rows:
            return "unknown"
        parsed = self._parse_terminal_time(rows[0]["terminal_time"])
        if isinstance(parsed, datetime):
            return parsed.replace(second=0, microsecond=0).strftime("%Y-%m-%d %H:%M")
        return str(rows[0]["terminal_time"])

    def _process_single_chunk(self, station: str, rows: list):
        """
        Proses satu chunk (calon satu window) -- logic ini SAMA PERSIS dengan
        _process_window versi lama, cuma sekarang dipanggil per chunk, bukan
        untuk seluruh baris station sekaligus.
        """
        sample_count = len(rows)
        is_incomplete = sample_count < EXPECTED_SAMPLES_PER_WINDOW
        minute_label = self._chunk_minute_label(rows)

        if is_incomplete:
            decision = self._decide_incomplete_action(station, rows)
            if decision == "skip":
                logger.info(
                    "Window belum lengkap untuk station=%s (menit %s): %d/%d sample. "
                    "Data disimpan di buffer, menunggu sample tambahan siklus berikutnya.",
                    station, minute_label, sample_count, EXPECTED_SAMPLES_PER_WINDOW,
                )
                return
            elif decision == "discard":
                row_ids = [r["id"] for r in rows]
                self._buffer.delete_rows(row_ids)
                logger.warning(
                    "Window tidak lengkap untuk station=%s (menit %s, %d/%d sample) DIBUANG "
                    "sesuai incomplete_window_policy='discard'.",
                    station, minute_label, sample_count, EXPECTED_SAMPLES_PER_WINDOW,
                )
                return
            # decision == "process": lanjut ke bawah, tetap dikirim.
            logger.warning(
                "Window tidak lengkap untuk station=%s (menit %s): %d/%d sample "
                "-- tetap diproses (policy=%s).",
                station, minute_label, sample_count, EXPECTED_SAMPLES_PER_WINDOW,
                self._incomplete_policy,
            )

        try:
            aggregated = self._aggregate_rows(station, rows)
        except (KeyError, ValueError, ZeroDivisionError) as e:
            logger.error(
                "Gagal agregasi untuk station '%s' (%d baris), data dilewati: %s",
                station, len(rows), e,
            )
            return

        success = self._forwarder.send(aggregated)
        if success:
            row_ids = [r["id"] for r in rows]
            self._buffer.delete_rows(row_ids)
            logger.info(
                "Window agregasi terkirim & dihapus dari buffer: station=%s, "
                "sample_count=%d, window_end_time=%s",
                station, aggregated["sample_count"], aggregated["window_end_time"],
            )
        else:
            logger.warning(
                "Gagal kirim ke database tujuan untuk station=%s (%d baris), "
                "data tetap disimpan di buffer untuk dicoba ulang siklus berikutnya.",
                station, len(rows),
            )

    def _decide_incomplete_action(self, station: str, rows: list) -> str:
        """
        Tentukan tindakan untuk window yang belum genap sample-nya.

        Return salah satu:
            "skip"    -> biarkan di buffer, jangan dikirim, jangan dihapus
            "discard" -> hapus dari buffer, jangan dikirim
            "process" -> tetap agregasi & kirim seperti window lengkap
        """
        if self._incomplete_policy == "process_anyway":
            return "process"

        if self._incomplete_policy == "discard":
            return "discard"

        # policy == "wait_next_cycle" -> cek safety net umur data dulu.
        oldest_age_seconds = self._oldest_row_age_seconds(rows)
        if oldest_age_seconds is not None and oldest_age_seconds > self._incomplete_max_age:
            logger.warning(
                "Window untuk station=%s (menit %s) sudah menunggu %.0f detik "
                "(melebihi batas %ds) tapi belum genap -- dipaksa diproses "
                "supaya buffer tidak menumpuk.",
                station, self._chunk_minute_label(rows),
                oldest_age_seconds, self._incomplete_max_age,
            )
            return "process"

        return "skip"

    @staticmethod
    def _oldest_row_age_seconds(rows: list):
        """
        Hitung umur (detik) baris tertua berdasarkan kolom received_at.

        REVISI: received_at di SQLite sekarang WIB naive (lihat REVISI di
        sqlite_handler.py -- DEFAULT (datetime('now','localtime'))), BUKAN
        UTC lagi. Karena itu perbandingan di sini juga pakai datetime.now()
        TANPA timezone (naive, mengikuti jam sistem OS) -- bukan
        datetime.now(timezone.utc) seperti sebelumnya. Kedua sisi (received_at
        yang disimpan & waktu sekarang yang dibandingkan) harus sama-sama
        "bahasa waktu" yang sama, kalau tidak perhitungan umur data jadi
        meleset ~7 jam.

        Return None kalau received_at tidak ada/tidak bisa di-parse -- caller
        akan memperlakukan ini sebagai "belum expired" (aman, tidak dipaksa proses).
        """
        oldest_row = rows[0]  # rows sudah urut ASC by terminal_time dari query
        raw_ts = oldest_row.get("received_at")
        if not raw_ts:
            return None
        try:
            received_dt = datetime.strptime(raw_ts, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
        now_local = datetime.now()  # naive, mengikuti jam sistem OS (asumsi WIB)
        return (now_local - received_dt).total_seconds()

    def _aggregate_rows(self, station: str, rows: list) -> dict:
        """
        rows sudah terurut ASC berdasarkan terminal_time (dari query di sqlite_handler).
        """
        sample_count = len(rows)

        flow_avg = sum(r["flow"] for r in rows) / sample_count
        velocity_avg = sum(r["velocity"] for r in rows) / sample_count

        totalizer_start = rows[0]["totalizer"]
        totalizer_end = rows[-1]["totalizer"]
        totalizer_delta = totalizer_end - totalizer_start
        if totalizer_delta < 0:
            logger.warning(
                "Totalizer delta negatif untuk station=%s (start=%s, end=%s) "
                "-- kemungkinan device reset/rollover.",
                station, totalizer_start, totalizer_end,
            )

        last_row = rows[-1]

        # REVISI -- window_end_time dibulatkan ke AWAL MENIT BERIKUTNYA
        # (bukan awal menit data itu sendiri), supaya benar-benar mencerminkan
        # AKHIR window sesuai nama kolomnya.
        #
        # Contoh: window berisi sample 10:07:00 s.d. 10:07:55 (semua di menit
        # 10:07) -> window ini "berakhir" saat menit 10:07 selesai, yaitu titik
        # 10:08:00 (batas eksklusif) -- BUKAN 10:07:00 (itu awal window) dan
        # BUKAN 10:07:55 (itu cuma sample terakhir, bukan batas window).
        #
        # Ini konsisten dengan makna literal nama kolom "window_end_time" --
        # kalau suatu saat mau pakai konvensi "bucket start" ala Grafana/
        # InfluxDB (label = awal interval), tinggal hapus timedelta(minutes=1)
        # di bawah ini.
        parsed_last = self._parse_terminal_time(last_row["terminal_time"])
        if isinstance(parsed_last, datetime):
            window_start = parsed_last.replace(second=0, microsecond=0)
            window_end_time = window_start + timedelta(minutes=1)
        else:
            # Fallback: parsing gagal (format tak dikenal), tidak bisa
            # dibulatkan -- kirim apa adanya seperti sebelumnya, sudah
            # ter-warning di _parse_terminal_time.
            window_end_time = parsed_last

        return {
            "id_station": station,
            "window_end_time": window_end_time,
            "sample_count": sample_count,
            "expected_samples": EXPECTED_SAMPLES_PER_WINDOW,
            "flow_avg": flow_avg,
            "velocity_avg": velocity_avg,
            "totalizer_delta": totalizer_delta,
            "totalizer_end": totalizer_end,
            "vcc_last": last_row["vcc"],
            "battery_last": last_row["battery"],
            "vout_solar_last": last_row["vout_solar"],
            "unit_total": last_row["unit_total"],
        }

    @staticmethod
    def _parse_terminal_time(raw_value):
        """
        Konversi _terminalTime device menjadi objek datetime Python asli.

        REVISI: device ternyata mengirim LEBIH DARI SATU format seiring waktu
        (ditemukan dari log produksi):
            - Format lama:  "2026-07-31 14:41:42"           (tanpa timezone)
            - Format baru:  "2026-08-05T07:44:22+07:00"      (ISO 8601 + timezone)
        Karena itu parsing dicoba berlapis (beberapa format), bukan cuma satu
        strptime() kaku -- supaya perubahan format dari device tidak langsung
        membuat SEMUA data gagal terkirim ke database tujuan.

        Kalau timezone ikut terparse (format ISO 8601 dengan offset, mis.
        +07:00), nilainya dikonversi ke LOCAL_TZ (WIB) lalu timezone info
        dibuang (naive datetime) -- konsisten dengan received_at di SQLite
        (sekarang juga WIB naive, lihat REVISI di sqlite_handler.py) dan
        inserted_at di Oracle (SYSTIMESTAMP, waktu lokal server).

        Kalau format TIDAK ada info timezone (format lama, dianggap device
        sudah kirim jam lokal WIB apa adanya), TIDAK perlu konversi apa-apa,
        langsung dipakai sebagai naive datetime WIB.

        Kalau SEMUA format dikenal gagal, fallback ke string mentah apa adanya
        (skenario terburuk, kemungkinan ditolak Oracle) -- tapi paling tidak
        pipeline tidak berhenti, dan warning eksplisit tetap muncul supaya
        format baru yang belum dikenal bisa ditambahkan ke daftar di bawah.
        """
        if not raw_value:
            return raw_value

        # Daftar format yang pernah/mungkin dikirim device, dicoba berurutan.
        KNOWN_FORMATS = [
            "%Y-%m-%d %H:%M:%S",        # format lama, tanpa timezone
            "%Y-%m-%dT%H:%M:%S%z",      # ISO 8601 dengan timezone, mis. ...+07:00
            "%Y-%m-%dT%H:%M:%S",        # ISO 8601 tanpa timezone (jaga-jaga)
        ]

        for fmt in KNOWN_FORMATS:
            try:
                parsed = datetime.strptime(raw_value, fmt)
                if parsed.tzinfo is not None:
                    # Konversi ke WIB (LOCAL_TZ) lalu buang info timezone (naive),
                    # konsisten dengan received_at (WIB naive) di SQLite dan
                    # inserted_at (waktu lokal server) di Oracle.
                    parsed = parsed.astimezone(LOCAL_TZ).replace(tzinfo=None)
                return parsed
            except ValueError:
                continue

        logger.warning(
            "Gagal parsing _terminalTime '%s' dengan semua format yang dikenal (%s). "
            "Dikirim sebagai string mentah, kemungkinan akan ditolak oleh kolom "
            "TIMESTAMP di database tujuan. Perlu ditambahkan format baru ke "
            "KNOWN_FORMATS di aggregator.py.",
            raw_value, KNOWN_FORMATS,
        )
        return raw_value