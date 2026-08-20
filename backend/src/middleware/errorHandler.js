const logger = require("../logger");

const CHILD_RECORD_MESSAGES = {
  fk_users_company:
    "Perusahaan tidak dapat dihapus karena masih digunakan oleh akun pengguna.",
  fk_model_has_roles_role:
    "Role tidak dapat dihapus karena masih digunakan oleh akun pengguna.",
  fk_role_has_permissions_role:
    "Role tidak dapat dihapus karena masih memiliki permission.",
  fk_role_has_permissions_permission:
    "Permission tidak dapat dihapus karena masih digunakan oleh role.",
  fk_model_has_permissions_permission:
    "Permission tidak dapat dihapus karena masih digunakan oleh akun pengguna.",
  fk_master_alat_station:
    "Stasiun tidak dapat dihapus karena masih memiliki perangkat.",
  fk_alat_threshold_alat:
    "Perangkat tidak dapat dihapus karena masih memiliki pengaturan ambang batas.",
  fk_notifications_alat:
    "Perangkat tidak dapat dihapus karena masih memiliki riwayat notifikasi.",
  fk_notifications_station:
    "Stasiun tidak dapat dihapus karena masih memiliki riwayat notifikasi.",
  fk_notification_reads_notification:
    "Notifikasi tidak dapat dihapus karena sudah memiliki riwayat baca.",
  fk_notification_reads_user:
    "Akun pengguna tidak dapat dihapus karena masih memiliki riwayat baca notifikasi.",
};

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress;
}

function getRequestPath(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

function getErrorSource(error) {
  if (error.code && String(error.code).startsWith("ORA-")) {
    return "oracle";
  }

  if (Number.isInteger(error.errorNum)) {
    return "oracle";
  }

  if (error.code && String(error.code).startsWith("NJS-")) {
    return "oracle_driver";
  }

  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    return "auth";
  }

  if (error.type === "entity.parse.failed") {
    return "request_body";
  }

  return "application";
}

function getOracleCode(error) {
  const code = String(error.code || error.errorNum || "");

  if (code.startsWith("ORA-")) return code;
  if (/^\d+$/.test(code)) return `ORA-${code.padStart(5, "0")}`;

  return code;
}

function getDatabaseError(error) {
  const source = getErrorSource(error);
  if (source !== "oracle" && source !== "oracle_driver") {
    return null;
  }

  const code = getOracleCode(error);
  const message = String(error.message || "").toLowerCase();

  if (code === "ORA-02292") {
    const matchingConstraint = Object.entries(CHILD_RECORD_MESSAGES).find(
      ([constraintName]) => message.includes(constraintName),
    );

    return {
      statusCode: 409,
      publicCode: "DEPENDENT_RECORDS_EXIST",
      publicMessage:
        matchingConstraint?.[1] ||
        "Data ini tidak dapat dihapus karena masih digunakan oleh data lain.",
    };
  }

  if (code === "ORA-00001") {
    if (message.includes("uk_users_email")) {
      return {
        statusCode: 409,
        publicCode: "DUPLICATE_RECORD",
        publicMessage: "Akun dengan email tersebut sudah terdaftar.",
      };
    }

    return {
      statusCode: 409,
      publicCode: "DUPLICATE_RECORD",
      publicMessage: "Data dengan nilai yang sama sudah terdaftar.",
    };
  }

  if (code === "ORA-02291") {
    return {
      statusCode: 400,
      publicCode: "INVALID_REFERENCE",
      publicMessage:
        "Data terkait tidak ditemukan. Muat ulang halaman lalu pilih data yang valid.",
    };
  }

  if (code === "ORA-01400") {
    return {
      statusCode: 400,
      publicCode: "REQUIRED_VALUE_MISSING",
      publicMessage: "Ada data wajib yang belum diisi.",
    };
  }

  if (code === "ORA-01722") {
    return {
      statusCode: 400,
      publicCode: "INVALID_NUMBER",
      publicMessage: "Salah satu kolom angka berisi nilai yang tidak valid.",
    };
  }

  if (code === "ORA-12899") {
    return {
      statusCode: 400,
      publicCode: "VALUE_TOO_LONG",
      publicMessage: "Salah satu nilai melebihi panjang yang diizinkan.",
    };
  }

  if (
    code === "ORA-12170" ||
    code === "ORA-12541" ||
    source === "oracle_driver"
  ) {
    return {
      statusCode: 503,
      publicCode: "DATABASE_UNAVAILABLE",
      publicMessage:
        "Koneksi database sedang tidak tersedia. Muat ulang halaman sebelum mencoba lagi untuk memastikan perubahan tersimpan atau tidak.",
    };
  }

  return {
    statusCode: 500,
    publicCode: "DATABASE_ERROR",
    publicMessage:
      "Database tidak dapat menyelesaikan permintaan ini. Muat ulang halaman sebelum mencoba lagi.",
  };
}

function getResourceLabel(req) {
  const path = getRequestPath(req);

  if (path.startsWith("/api/companies")) return "perusahaan";
  if (path.startsWith("/api/users")) return "akun pengguna";
  if (path.startsWith("/api/roles")) return "role";
  if (path.startsWith("/api/permissions")) return "permission";
  if (path.startsWith("/api/alat")) return "perangkat";
  if (path.startsWith("/api/stations")) return "stasiun";
  if (path.startsWith("/api/register")) return "akun pengguna";

  return "data";
}

function getUnexpectedRequestMessage(req) {
  const resource = getResourceLabel(req);

  if (req.method === "POST") {
    return `Status pembuatan ${resource} belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.`;
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    return `Status perubahan ${resource} belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.`;
  }

  if (req.method === "DELETE") {
    return `Status penghapusan ${resource} belum dapat dipastikan. Muat ulang halaman sebelum mencoba lagi.`;
  }

  return "Permintaan belum dapat diselesaikan. Muat ulang halaman lalu coba lagi.";
}

function getErrorCode(error, statusCode) {
  return error.code || error.name || `HTTP_${statusCode}`;
}

function getPublicCode(error, statusCode, databaseError, req) {
  if (databaseError?.publicCode) {
    return databaseError.publicCode;
  }
  if (error.publicCode) {
    return error.publicCode;
  }

  if (statusCode === 400) {
    return "BAD_REQUEST";
  }

  if (statusCode === 401) {
    return "UNAUTHORIZED";
  }

  if (statusCode === 403) {
    return "FORBIDDEN";
  }

  if (statusCode === 404) {
    return "NOT_FOUND";
  }

  if (statusCode === 409) {
    return "CONFLICT";
  }

  if (statusCode === 413) {
    return "PAYLOAD_TOO_LARGE";
  }

  if (statusCode === 415) {
    return "UNSUPPORTED_MEDIA_TYPE";
  }

  if (statusCode === 429) {
    return "RATE_LIMITED";
  }

  if (
    statusCode >= 500 &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req?.method)
  ) {
    return "REQUEST_OUTCOME_UNKNOWN";
  }

  return statusCode >= 500 ? "REQUEST_FAILED" : `HTTP_${statusCode}`;
}

function getPublicMessage(error, statusCode, req, databaseError) {
  if (error.publicMessage) {
    return error.publicMessage;
  }

  if (databaseError?.publicMessage) {
    return databaseError.publicMessage;
  }

  if (statusCode === 413) {
    return "Ukuran data permintaan terlalu besar.";
  }

  if (statusCode === 400 && error.type === "entity.parse.failed") {
    return "Format JSON pada permintaan tidak valid.";
  }

  if (statusCode >= 500) {
    return getUnexpectedRequestMessage(req);
  }

  if (
    getErrorSource(error) === "oracle" ||
    getErrorSource(error) === "oracle_driver"
  ) {
    return "Permintaan database tidak dapat diselesaikan. Muat ulang halaman lalu coba lagi.";
  }

  return error.message;
}

function buildErrorLogPayload(error, req, statusCode, traceId) {
  const payload = {
    method: req.method,
    path: getRequestPath(req),
    route: req.route?.path,
    ip: getClientIp(req),
    user_agent: req.headers["user-agent"],
    user_id: req.user?.id,
    status: "failed",
    status_code: statusCode,
    error_source: getErrorSource(error),
    error_code: getErrorCode(error, statusCode),
    error_message: error.message,
    journey: true,
    journey_stage: "request_failed",
    journey_outcome: "failed",
  };

  if (error.errorNum !== undefined) {
    payload.oracle_error_num = error.errorNum;
  }

  if (error.offset !== undefined) {
    payload.oracle_error_offset = error.offset;
  }

  if (error.isRecoverable !== undefined) {
    payload.is_recoverable = error.isRecoverable;
  }

  if (statusCode >= 500) {
    payload.err = error;
  }

  return payload;
}

module.exports = (error, req, res, next) => {
  const databaseError = getDatabaseError(error);
  const statusCode =
    error.statusCode || error.status || databaseError?.statusCode || 500;
  const traceId = req.trace_id || req.id;
  const logTarget = req.log || logger.child({ trace_id: traceId });
  const log =
    statusCode >= 500
      ? logTarget.error.bind(logTarget)
      : logTarget.warn.bind(logTarget);

  log(buildErrorLogPayload(error, req, statusCode, traceId), "request_error");

  res.status(statusCode).json({
    error: getPublicMessage(error, statusCode, req, databaseError),
    code: getPublicCode(error, statusCode, databaseError, req),
    trace_id: traceId,
  });
};
