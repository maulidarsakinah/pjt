"""
inputs/filter.py

Tanggung jawab modul ini: GUARD STRUKTURAL, bukan validasi nilai/anomali.

Yang DICEK di sini:
    - Apakah field wajib ada (key exists)
    - Apakah field wajib tidak None (None = gagal dinormalisasi di mqtt_client.py,
      atau memang tidak dikirim device)
    - Apakah tipe data sesuai ekspektasi dasar (angka vs bukan angka)
    - Apakah _terminalTime formatnya bisa di-parse (lihat REVISI di bawah)

Yang SENGAJA TIDAK dicek di sini (sesuai kesepakatan proyek):
    - Apakah flow/velocity bernilai negatif
    - Apakah nilai di luar rentang wajar (outlier)
    - Threshold battery/vcc rendah
    Semua itu didelegasikan ke observasi manual di dashboard/web, karena
    interpretasi "wajar atau tidak" butuh konteks domain yang lebih baik
    dinilai manusia daripada aturan kaku di kode.

REVISI -- validasi format _terminalTime ditambahkan:
    Ditemukan kasus device/publisher mengirim _terminalTime dengan format
    rusak (mis. " + 2026-08-20+10:20:56" -- ada sisa karakter literal dan
    pemisah tanggal/jam yang tidak sesuai format manapun yang dikenal).

    Sebelumnya, payload seperti ini TETAP LOLOS filter (karena _terminalTime
    cuma dicek "ada dan bertipe string", bukan formatnya), lalu gagal di-parse
    di processors/aggregator.py, dikirim sebagai string mentah ke database
    tujuan, dan DITOLAK oleh kolom TIMESTAMP -- MASALAHNYA, karena string ini
    tidak akan pernah berubah, retry otomatis (dirancang untuk kasus database
    down sementara) akan GAGAL TERUS-MENERUS TANPA HENTI untuk data ini,
    karena akar masalahnya bukan soal ketersediaan database, tapi data itu
    sendiri yang cacat permanen.

    Sekarang format _terminalTime divalidasi DI SINI (sebelum masuk buffer),
    supaya payload dengan format waktu rusak ditolak sejak awal -- konsisten
    dengan prinsip filter ini (guard struktural), dan mencegah retry tak
    berkesudahan yang tidak akan pernah berhasil.

    PENTING: daftar format di KNOWN_TIME_FORMATS di bawah ini HARUS SELALU
    SINKRON dengan KNOWN_FORMATS di processors/aggregator.py (_parse_terminal_time).
    Kalau nanti ada format baru yang sah ditambahkan di salah satu tempat,
    wajib ditambahkan juga di tempat yang lain -- supaya filter tidak
    menolak format yang sebenarnya valid dan bisa diproses aggregator.
"""

import logging
import re
from datetime import datetime

logger = logging.getLogger("filter")

# Field yang WAJIB ada dan tidak boleh None supaya data bisa diproses
# lebih lanjut (disimpan ke buffer, diagregasi, dst).
REQUIRED_FIELDS = [
    "idStation",
    "_terminalTime",
    "flow",
    "velocity",
    "totalizer",
    "vcc",
    "battery",
    "vout_solar",
    "unitTotal",
]

# Field numerik -- dicek tipenya harus int/float setelah normalisasi,
# BUKAN dicek rentang nilainya.
NUMERIC_FIELDS = [
    "flow",
    "velocity",
    "totalizer",
    "vcc",
    "battery",
    "vout_solar",
    "unitTotal",
]

# HARUS SINKRON dengan KNOWN_FORMATS di processors/aggregator.py.
KNOWN_TIME_FORMATS = [
    "%Y-%m-%d %H:%M:%S",        # format lama, tanpa timezone
    "%Y-%m-%dT%H:%M:%S%z",      # ISO 8601 dengan timezone, mis. ...+07:00
    "%Y-%m-%dT%H:%M:%S",        # ISO 8601 tanpa timezone
]


def _clean_terminal_time_artifact(raw_value: str) -> str:
    """
    TAMBALAN SEMENTARA -- HARUS SINKRON dengan fungsi sama persis di
    processors/aggregator.py (_clean_terminal_time_artifact). Kalau salah
    satu diubah, yang lain WAJIB ikut diubah -- supaya filter ini tidak
    menolak payload yang sebenarnya nanti masih bisa diproses aggregator,
    atau sebaliknya meloloskan payload yang ternyata tetap gagal di sana.

    Membersihkan artefak sementara device, contoh: " + 2026-08-20+10:11:31"
    -> "2026-08-20T10:11:31". Kalau tidak cocok pola ini, dikembalikan
    apa adanya.
    """
    if not isinstance(raw_value, str):
        return raw_value

    cleaned = raw_value.strip()
    cleaned = re.sub(r"^\+\s*", "", cleaned)

    match = re.match(r"^(\d{4}-\d{2}-\d{2})\+(\d{2}:\d{2}:\d{2})$", cleaned)
    if match:
        cleaned = f"{match.group(1)}T{match.group(2)}"

    return cleaned


def _is_valid_terminal_time(value) -> bool:
    """Cek apakah string _terminalTime cocok dengan salah satu format yang
    dikenal, SETELAH dibersihkan dari artefak sementara (lihat
    _clean_terminal_time_artifact). Tidak peduli NILAI waktunya (bisa jadi
    jam janggal tapi format benar tetap lolos di sini -- itu bukan urusan
    filter struktural)."""
    if not isinstance(value, str):
        return False
    candidate = _clean_terminal_time_artifact(value)
    for fmt in KNOWN_TIME_FORMATS:
        try:
            datetime.strptime(candidate, fmt)
            return True
        except ValueError:
            continue
    return False


def validate_payload(data: dict):
    """
    Mengecek kelengkapan struktur & tipe dasar data yang sudah dinormalisasi
    oleh mqtt_client.py.

    Return:
        (True, None)          -> data lolos, aman diteruskan ke buffer
        (False, "alasan...")  -> data ditolak, caller wajib log & skip,
                                  TIDAK boleh dilanjutkan ke buffer/aggregator
    """
    # 1. Cek semua field wajib ada di dict
    missing_fields = [f for f in REQUIRED_FIELDS if f not in data]
    if missing_fields:
        return False, f"field wajib tidak ada: {missing_fields}"

    # 2. Cek tidak ada field wajib bernilai None
    #    (None berarti gagal normalisasi di mqtt_client.py, atau device
    #    memang mengirim null untuk field tersebut)
    none_fields = [f for f in REQUIRED_FIELDS if data.get(f) is None]
    if none_fields:
        return False, f"field wajib bernilai None (gagal normalisasi atau null dari device): {none_fields}"

    # 3. Cek tipe dasar field numerik -- harus int atau float,
    #    bukan soal rentang nilainya wajar atau tidak.
    invalid_type_fields = []
    for f in NUMERIC_FIELDS:
        value = data[f]
        if not isinstance(value, (int, float)):
            invalid_type_fields.append((f, type(value).__name__))

    if invalid_type_fields:
        return False, f"field numerik dengan tipe tidak sesuai: {invalid_type_fields}"

    # 4. Cek format _terminalTime bisa di-parse -- mencegah payload dengan
    #    format waktu rusak permanen lolos ke buffer & menyebabkan retry
    #    tak berkesudahan di tahap agregasi/forwarding.
    if not _is_valid_terminal_time(data["_terminalTime"]):
        return False, f"_terminalTime format tidak dikenali: {data['_terminalTime']!r}"

    return True, None