"""
inputs/filter.py

Tanggung jawab modul ini: GUARD STRUKTURAL, bukan validasi nilai/anomali.

Yang DICEK di sini:
    - Apakah field wajib ada (key exists)
    - Apakah field wajib tidak None (None = gagal dinormalisasi di mqtt_client.py,
      atau memang tidak dikirim device)
    - Apakah tipe data sesuai ekspektasi dasar (angka vs bukan angka)

Yang SENGAJA TIDAK dicek di sini (sesuai kesepakatan proyek):
    - Apakah flow/velocity bernilai negatif
    - Apakah nilai di luar rentang wajar (outlier)
    - Threshold battery/vcc rendah
    Semua itu didelegasikan ke observasi manual di dashboard/web, karena
    interpretasi "wajar atau tidak" butuh konteks domain yang lebih baik
    dinilai manusia daripada aturan kaku di kode.
"""

import logging

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

    return True, None