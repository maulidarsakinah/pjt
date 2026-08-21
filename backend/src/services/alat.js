const { withConnection, withTransaction } = require("./database");
const { badRequest, conflict, notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

const SAFE_TABLE_NAME = /^tb_[a-z0-9_]+$/;
const SAFE_COLUMN_NAME = /^[a-zA-Z0-9_]+$/;
const OFFLINE_TIMEOUT_MS = 15 * 60 * 1000;

function assertSafeTableName(tableName) {
  if (!tableName || !SAFE_TABLE_NAME.test(tableName)) {
    throw badRequest("station data table is not configured correctly");
  }
}

function validateThresholds(thresholds) {
  if (thresholds === undefined || thresholds === null) {
    return [];
  }

  if (!Array.isArray(thresholds)) {
    throw badRequest("thresholds must be an array");
  }

  const validated = [];
  const seenNames = new Set();

  for (const item of thresholds) {
    if (!item || typeof item !== "object") {
      throw badRequest("threshold item must be an object");
    }

    const treshold_name = item.treshold_name ? String(item.treshold_name).trim() : "";
    if (!treshold_name || !SAFE_COLUMN_NAME.test(treshold_name)) {
      throw badRequest(
        "treshold_name is required and must contain alphanumeric characters and underscores only",
      );
    }

    if (seenNames.has(treshold_name)) {
      throw badRequest(`duplicate treshold_name '${treshold_name}' in payload`);
    }
    seenNames.add(treshold_name);

    const min =
      item.treshold_minimum === null ||
      item.treshold_minimum === undefined ||
      String(item.treshold_minimum).trim() === ""
        ? null
        : Number(item.treshold_minimum);
    if (min !== null && Number.isNaN(min)) {
      throw badRequest(
        `treshold_minimum for '${treshold_name}' must be a valid number or null`,
      );
    }

    const max =
      item.treshold_maximum === null ||
      item.treshold_maximum === undefined ||
      String(item.treshold_maximum).trim() === ""
        ? null
        : Number(item.treshold_maximum);
    if (max !== null && Number.isNaN(max)) {
      throw badRequest(
        `treshold_maximum for '${treshold_name}' must be a valid number or null`,
      );
    }

    if (min !== null && max !== null && min > max) {
      throw badRequest(
        `treshold_minimum (${min}) cannot be greater than treshold_maximum (${max}) for threshold '${treshold_name}'`,
      );
    }

    validated.push({
      id: item.id ? parsePositiveInteger(item.id, "threshold id") : undefined,
      treshold_name,
      treshold_minimum: min,
      treshold_maximum: max,
    });
  }

  return validated;
}

function validateAlatPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object") {
    throw badRequest("request body must be an object");
  }

  const payload = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw badRequest("name is required");
    }
    if (body.name.trim().length > 255) {
      throw badRequest("name must be 255 characters or less");
    }
    payload.name = body.name.trim();
  } else if (!partial) {
    throw badRequest("name is required");
  }

  if (body.station_id !== undefined) {
    payload.station_id = parsePositiveInteger(body.station_id, "station_id");
  } else if (!partial) {
    throw badRequest("station_id is required");
  }

  if (body.wilayah_sungai !== undefined) {
    if (body.wilayah_sungai !== null && typeof body.wilayah_sungai !== "string") {
      throw badRequest("wilayah_sungai must be a string or null");
    }
    const val = body.wilayah_sungai === null ? null : body.wilayah_sungai.trim();
    if (val !== null && val.length > 255) {
      throw badRequest("wilayah_sungai must be 255 characters or less");
    }
    payload.wilayah_sungai = val;
  } else if (!partial) {
    payload.wilayah_sungai = null;
  }

  if (body.lokasi !== undefined) {
    if (body.lokasi !== null && typeof body.lokasi !== "string") {
      throw badRequest("lokasi must be a string or null");
    }
    const val = body.lokasi === null ? null : body.lokasi.trim();
    if (val !== null && val.length > 255) {
      throw badRequest("lokasi must be 255 characters or less");
    }
    payload.lokasi = val;
  } else if (!partial) {
    payload.lokasi = null;
  }

  if (body.status !== undefined) {
    const status_num = Number(body.status);
    if (![0, 1, 2].includes(status_num)) {
      throw badRequest(
        "status must be 0 (inactive), 1 (active), or 2 (maintenance)",
      );
    }
    payload.status = status_num;
  } else if (!partial) {
    payload.status = 1;
  }

  if (body.thresholds !== undefined) {
    payload.thresholds = validateThresholds(body.thresholds);
  }

  if (partial && Object.keys(payload).length === 0) {
    throw badRequest("at least one field is required for partial update");
  }

  return payload;
}

async function assertUniqueAlat(connection, { name, station_id }, excludeId) {
  const binds = {
    name: name.toLowerCase(),
    station_id,
  };
  const exclusions = [];

  if (excludeId !== undefined) {
    binds.exclude_id = excludeId;
    exclusions.push(`"ID" <> :exclude_id`);
  }

  const result = await connection.execute(
    `SELECT "ID"
     FROM "tb_master_alat"
     WHERE LOWER("NAME") = :name
       AND "STATION_ID" = :station_id
       ${exclusions.length ? `AND ${exclusions.join(" AND ")}` : ""}
       AND ROWNUM = 1`,
    binds,
    { maxRows: 1 },
  );

  if (result.rows.length) {
    throw conflict("Nama perangkat sudah terdaftar pada stasiun ini");
  }
}

async function getThresholdsByAlatId(connection, alat_id) {
  const result = await connection.execute(
    `SELECT
       "ID" AS "id",
       "ALAT_ID" AS "alat_id",
       "TRESHOLD_NAME" AS "treshold_name",
       "TRESHOLD_MINIMUM" AS "treshold_minimum",
       "TRESHOLD_MAXIMUM" AS "treshold_maximum"
     FROM "tb_alat_threshold"
     WHERE "ALAT_ID" = :alat_id
     ORDER BY "ID" ASC`,
    { alat_id },
  );

  return result.rows || [];
}

async function checkTelemetryOffline(connection, table_name) {
  if (!table_name || !SAFE_TABLE_NAME.test(table_name)) return true;
  try {
    const table_sample = await connection.execute(
      `SELECT * FROM "${table_name}" WHERE ROWNUM = 1`,
    );
    const col_names = (table_sample.metaData || []).map((col) =>
      String(col.name).toLowerCase(),
    );
    const time_col = col_names.includes("window_end_time")
      ? '"window_end_time"'
      : col_names.includes("datetime")
        ? '"datetime"'
        : col_names.includes("timestamp")
          ? '"timestamp"'
          : col_names.includes("created_at")
            ? '"created_at"'
            : null;

    const id_col = col_names.includes("id") ? '"id"' : col_names.includes("ID") ? '"ID"' : null;
    const order_clause = time_col
      ? (id_col ? `ORDER BY ${time_col} DESC, ${id_col} DESC` : `ORDER BY ${time_col} DESC`)
      : (id_col ? `ORDER BY ${id_col} DESC` : ``);

    const telemetry_result = await connection.execute(
      `SELECT * FROM (
         SELECT * FROM "${table_name}" ${order_clause}
       ) WHERE ROWNUM = 1`,
    );
    const latest_row = telemetry_result.rows?.[0];
    if (!latest_row) return true;

    let raw_time;
    for (const key of Object.keys(latest_row)) {
      const k = key.toLowerCase();
      if (["window_end_time", "datetime", "timestamp", "created_at"].includes(k)) {
        raw_time = latest_row[key];
        break;
      }
    }

    if (raw_time) {
      const telemetry_date = new Date(raw_time);
      if (!Number.isNaN(telemetry_date.getTime())) {
        const age_ms = Date.now() - telemetry_date.getTime();
        return age_ms > OFFLINE_TIMEOUT_MS;
      }
    }
    return false;
  } catch (_err) {
    return true;
  }
}

async function evaluateAlatStatus(connection, alat_row, threshold_rows = []) {
  const is_telemetry_offline = await checkTelemetryOffline(connection, alat_row.table_data);

  if (alat_row.status === 0) {
    return {
      computed_status: "inactive",
      is_telemetry_offline,
      evaluations: threshold_rows.map((t) => ({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "inactive",
      })),
    };
  }

  if (alat_row.status === 2) {
    return {
      computed_status: "maintenance",
      is_telemetry_offline,
      evaluations: threshold_rows.map((t) => ({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "maintenance",
      })),
    };
  }

  const table_name = alat_row.table_data;
  if (!table_name || !SAFE_TABLE_NAME.test(table_name)) {
    return {
      computed_status: "offline",
      evaluations: threshold_rows.map((t) => ({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "no_data",
      })),
    };
  }

  let table_sample;
  try {
    table_sample = await connection.execute(
      `SELECT * FROM "${table_name}" WHERE ROWNUM = 1`,
    );
  } catch (_error) {
    return {
      computed_status: "offline",
      evaluations: threshold_rows.map((t) => ({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "no_data",
      })),
    };
  }

  const col_names = (table_sample.metaData || []).map((col) =>
    String(col.name).toLowerCase(),
  );
  const time_col = col_names.includes("window_end_time")
    ? '"window_end_time"'
    : col_names.includes("datetime")
      ? '"datetime"'
      : col_names.includes("timestamp")
        ? '"timestamp"'
        : col_names.includes("created_at")
          ? '"created_at"'
          : null;

  const id_col = col_names.includes("id") ? '"id"' : col_names.includes("ID") ? '"ID"' : null;
  const order_clause = time_col
    ? (id_col ? `ORDER BY ${time_col} DESC, ${id_col} DESC` : `ORDER BY ${time_col} DESC`)
    : (id_col ? `ORDER BY ${id_col} DESC` : ``);

  let telemetry_result;
  try {
    telemetry_result = await connection.execute(
      `SELECT * FROM (
         SELECT * FROM "${table_name}" ${order_clause}
       ) WHERE ROWNUM = 1`,
    );
  } catch (_error) {
    telemetry_result = { rows: [] };
  }

  const latest_row = telemetry_result.rows?.[0];
  if (!latest_row) {
    return {
      computed_status: "offline",
      evaluations: threshold_rows.map((t) => ({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "no_data",
      })),
    };
  }

  let raw_time;
  for (const key of Object.keys(latest_row)) {
    const k = key.toLowerCase();
    if (["window_end_time", "datetime", "timestamp", "created_at"].includes(k)) {
      raw_time = latest_row[key];
      break;
    }
  }

  if (raw_time) {
    const telemetry_date = new Date(raw_time);
    if (!Number.isNaN(telemetry_date.getTime())) {
      const age_ms = Date.now() - telemetry_date.getTime();
      if (age_ms > OFFLINE_TIMEOUT_MS) {
        return {
          computed_status: "offline",
          last_telemetry_at: telemetry_date.toISOString(),
          evaluations: threshold_rows.map((t) => ({
            threshold_id: t.id,
            treshold_name: t.treshold_name,
            evaluation: "stale_data",
          })),
        };
      }
    }
  }

  let overall_status = "online";
  const evaluations = [];

  for (const t of threshold_rows) {
    let val;
    for (const key of Object.keys(latest_row)) {
      if (key.toLowerCase() === t.treshold_name.toLowerCase()) {
        val = latest_row[key];
        break;
      }
    }

    if (val === undefined || val === null) {
      evaluations.push({
        threshold_id: t.id,
        treshold_name: t.treshold_name,
        evaluation: "no_data",
      });
      continue;
    }

    const num_val = Number(val);
    let item_eval = "normal";

    if (t.treshold_maximum !== null && num_val > Number(t.treshold_maximum)) {
      item_eval = "alert_above_max";
      overall_status = "alert_above_max";
    } else if (
      t.treshold_minimum !== null &&
      num_val < Number(t.treshold_minimum)
    ) {
      item_eval = "alert_below_min";
      if (overall_status !== "alert_above_max") {
        overall_status = "alert_below_min";
      }
    }

    evaluations.push({
      threshold_id: t.id,
      treshold_name: t.treshold_name,
      last_value: num_val,
      treshold_minimum: t.treshold_minimum,
      treshold_maximum: t.treshold_maximum,
      evaluation: item_eval,
    });
  }

  return {
    computed_status: overall_status,
    last_telemetry_at: raw_time ? new Date(raw_time).toISOString() : null,
    evaluations,
  };
}

async function getAlatByIdInternal(connection, id) {
  let result;
  try {
    result = await connection.execute(
      `SELECT
         a."ID" AS "id",
         a."NAME" AS "name",
         a."STATION_ID" AS "station_id",
         s."nama" AS "station_name",
         s."TableData" AS "table_data",
         a."WILAYAH_SUNGAI" AS "wilayah_sungai",
         a."LOKASI" AS "lokasi",
         a."STATUS" AS "status",
         a."CREATED_AT" AS "created_at",
         a."UPDATED_AT" AS "updated_at"
       FROM "tb_master_alat" a
       LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
       WHERE a."ID" = :id
       AND ROWNUM = 1`,
      { id },
      { fetchArraySize: 1, maxRows: 1 },
    );
  } catch (err) {
    if (err && (String(err.message).includes("00904") || String(err.message).toUpperCase().includes("STATUS") || err.code === "ORA-00904")) {
      result = await connection.execute(
        `SELECT
           a."ID" AS "id",
           a."NAME" AS "name",
           a."STATION_ID" AS "station_id",
           s."nama" AS "station_name",
           s."TableData" AS "table_data",
           a."WILAYAH_SUNGAI" AS "wilayah_sungai",
           a."LOKASI" AS "lokasi",
           1 AS "status",
           a."CREATED_AT" AS "created_at",
           a."UPDATED_AT" AS "updated_at"
         FROM "tb_master_alat" a
         LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
         WHERE a."ID" = :id
         AND ROWNUM = 1`,
        { id },
        { fetchArraySize: 1, maxRows: 1 },
      );
    } else {
      throw err;
    }
  }

  const alat = result.rows?.[0];
  if (!alat) {
    return null;
  }

  const thresholds = await getThresholdsByAlatId(connection, id);
  const status_info = await evaluateAlatStatus(connection, alat, thresholds);

  delete alat.table_data;

  return {
    ...alat,
    computed_status: status_info.computed_status,
    last_telemetry_at: status_info.last_telemetry_at || null,
    thresholds: thresholds.map((t) => {
      const eval_item = status_info.evaluations.find(
        (e) => e.threshold_id === t.id,
      );
      return {
        ...t,
        last_value: eval_item?.last_value ?? null,
        evaluation: eval_item?.evaluation || "normal",
      };
    }),
  };
}

async function getAlatById(id_value) {
  const id = parsePositiveInteger(id_value, "id");

  return withConnection(async (connection) => {
    const data = await getAlatByIdInternal(connection, id);
    if (!data) {
      throw notFound("master alat not found");
    }
    return data;
  });
}

async function getAlatStatusDetail(id_value) {
  const id = parsePositiveInteger(id_value, "id");

  return withConnection(async (connection) => {
    let result;
    try {
      result = await connection.execute(
        `SELECT
           a."ID" AS "id",
           a."NAME" AS "name",
           a."STATION_ID" AS "station_id",
           s."nama" AS "station_name",
           s."TableData" AS "table_data",
           a."WILAYAH_SUNGAI" AS "wilayah_sungai",
           a."LOKASI" AS "lokasi",
           a."STATUS" AS "status",
           a."CREATED_AT" AS "created_at",
           a."UPDATED_AT" AS "updated_at"
         FROM "tb_master_alat" a
         LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
         WHERE a."ID" = :id
         AND ROWNUM = 1`,
        { id },
        { fetchArraySize: 1, maxRows: 1 },
      );
    } catch (err) {
      if (err && (String(err.message).includes("00904") || String(err.message).toUpperCase().includes("STATUS") || err.code === "ORA-00904")) {
        result = await connection.execute(
          `SELECT
             a."ID" AS "id",
             a."NAME" AS "name",
             a."STATION_ID" AS "station_id",
             s."nama" AS "station_name",
             s."TableData" AS "table_data",
             a."WILAYAH_SUNGAI" AS "wilayah_sungai",
             a."LOKASI" AS "lokasi",
             1 AS "status",
             a."CREATED_AT" AS "created_at",
             a."UPDATED_AT" AS "updated_at"
           FROM "tb_master_alat" a
           LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
           WHERE a."ID" = :id
           AND ROWNUM = 1`,
          { id },
          { fetchArraySize: 1, maxRows: 1 },
        );
      } else {
        throw err;
      }
    }

    const alat = result.rows?.[0];
    if (!alat) {
      throw notFound("master alat not found");
    }

    const thresholds = await getThresholdsByAlatId(connection, id);
    const status_info = await evaluateAlatStatus(connection, alat, thresholds);

    delete alat.table_data;

    return {
      alat,
      computed_status: status_info.computed_status,
      last_telemetry_at: status_info.last_telemetry_at || null,
      evaluations: status_info.evaluations,
    };
  });
}

async function listAlat(query = {}) {
  const pagination = parsePagination(query);
  const search = query.search || query.q;
  const where_clauses = [];
  const binds = {
    page_end: pagination.pageEnd,
    offset: pagination.offset,
  };

  if (search && typeof search === "string" && search.trim().length > 0) {
    where_clauses.push(
      '(LOWER(a."NAME") LIKE :search OR LOWER(a."LOKASI") LIKE :search OR LOWER(a."WILAYAH_SUNGAI") LIKE :search)',
    );
    binds.search = `%${search.trim().toLowerCase()}%`;
  }

  if (query.status !== undefined && query.status !== "") {
    where_clauses.push('a."STATUS" = :status');
    binds.status = parsePositiveInteger(query.status, "status");
  }

  if (query.station_id !== undefined && query.station_id !== "") {
    where_clauses.push('a."STATION_ID" = :station_id');
    binds.station_id = parsePositiveInteger(query.station_id, "station_id");
  }

  if (query.wilayah_sungai && typeof query.wilayah_sungai === "string") {
    where_clauses.push('LOWER(a."WILAYAH_SUNGAI") = :wilayah_sungai');
    binds.wilayah_sungai = query.wilayah_sungai.trim().toLowerCase();
  }

  const where_sql =
    where_clauses.length > 0 ? `WHERE ${where_clauses.join(" AND ")}` : "";

  const count_binds = Object.fromEntries(
    Object.entries(binds).filter(([k]) => !["page_end", "offset"].includes(k)),
  );

  return withConnection(async (connection) => {
    let dataResult;
    try {
      dataResult = await connection.execute(
        `SELECT
           "id",
           "name",
           "station_id",
           "station_name",
           "table_data",
           "wilayah_sungai",
           "lokasi",
           "status",
           "created_at",
           "updated_at"
         FROM (
           SELECT page_query.*, ROWNUM AS "rn"
           FROM (
             SELECT
               a."ID" AS "id",
               a."NAME" AS "name",
               a."STATION_ID" AS "station_id",
               s."nama" AS "station_name",
               s."TableData" AS "table_data",
               a."WILAYAH_SUNGAI" AS "wilayah_sungai",
               a."LOKASI" AS "lokasi",
               a."STATUS" AS "status",
               a."CREATED_AT" AS "created_at",
               a."UPDATED_AT" AS "updated_at"
             FROM "tb_master_alat" a
             LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
             ${where_sql}
             ORDER BY a."ID" ASC
           ) page_query
           WHERE ROWNUM <= :page_end
         )
         WHERE "rn" > :offset`,
        binds,
        {
          fetchArraySize: Math.min(pagination.limit + 1, 100),
          maxRows: pagination.limit + 1,
        },
      );
    } catch (err) {
      if (err.message && err.message.includes("ORA-00904")) {
        const altWhereSql = where_sql.replace(/a\."STATUS"\s*=\s*:status/gi, '1 = :status');
        dataResult = await connection.execute(
          `SELECT
             "id",
             "name",
             "station_id",
             "station_name",
             "table_data",
             "wilayah_sungai",
             "lokasi",
             "status",
             "created_at",
             "updated_at"
           FROM (
             SELECT page_query.*, ROWNUM AS "rn"
             FROM (
               SELECT
                 a."ID" AS "id",
                 a."NAME" AS "name",
                 a."STATION_ID" AS "station_id",
                 s."nama" AS "station_name",
                 s."TableData" AS "table_data",
                 a."WILAYAH_SUNGAI" AS "wilayah_sungai",
                 a."LOKASI" AS "lokasi",
                 1 AS "status",
                 a."CREATED_AT" AS "created_at",
                 a."UPDATED_AT" AS "updated_at"
               FROM "tb_master_alat" a
               LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
               ${altWhereSql}
               ORDER BY a."ID" ASC
             ) page_query
             WHERE ROWNUM <= :page_end
           )
           WHERE "rn" > :offset`,
          binds,
          {
            fetchArraySize: Math.min(pagination.limit + 1, 100),
            maxRows: pagination.limit + 1,
          },
        );
      } else {
        throw err;
      }
    }

    const totalResult = await connection.execute(
      `SELECT COUNT(*) AS "total"
       FROM "tb_master_alat" a
       LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"
       ${where_sql}`,
      count_binds,
      { fetchArraySize: 1, maxRows: 1 },
    );

    const rows = dataResult.rows || [];
    const total = Number(totalResult.rows?.[0]?.total ?? 0);

    if (rows.length === 0) {
      const resp = buildListResponse([], pagination);
      resp.total = total;
      return resp;
    }

    const alatIds = rows.map((r) => r.id);

    // 1. Bulk fetch thresholds for all returned alat IDs in a single query
    const thresholdBinds = {};
    const idPlaceholders = alatIds
      .map((id, index) => {
        const bindKey = `id_${index}`;
        thresholdBinds[bindKey] = id;
        return `:${bindKey}`;
      })
      .join(", ");

    const thresholdRes = await connection.execute(
      `SELECT
         "ID" AS "id",
         "ALAT_ID" AS "alat_id",
         "TRESHOLD_NAME" AS "treshold_name",
         "TRESHOLD_MINIMUM" AS "treshold_minimum",
         "TRESHOLD_MAXIMUM" AS "treshold_maximum"
       FROM "tb_alat_threshold"
       WHERE "ALAT_ID" IN (${idPlaceholders})
       ORDER BY "ID" ASC`,
      thresholdBinds,
    );

    const thresholdMap = new Map();
    (thresholdRes.rows || []).forEach((t) => {
      if (!thresholdMap.has(t.alat_id)) {
        thresholdMap.set(t.alat_id, []);
      }
      thresholdMap.get(t.alat_id).push(t);
    });

    // 2. Fetch latest telemetry for unique table_data tables in batch
    const tableNames = [
      ...new Set(rows.map((r) => r.table_data).filter(Boolean)),
    ];
    const telemetryCache = new Map();

    await Promise.all(
      tableNames.map(async (tableName) => {
        if (!SAFE_TABLE_NAME.test(tableName)) return;
        try {
          const sample = await connection.execute(
            `SELECT * FROM "${tableName}" WHERE ROWNUM = 1`,
          );
          const colNames = (sample.metaData || []).map((col) =>
            String(col.name).toLowerCase(),
          );
          const timeCol = colNames.includes("window_end_time")
            ? '"window_end_time"'
            : colNames.includes("datetime")
              ? '"datetime"'
              : colNames.includes("timestamp")
                ? '"timestamp"'
                : colNames.includes("created_at")
                  ? '"created_at"'
                  : null;

          const idCol = colNames.includes("id") ? '"id"' : colNames.includes("ID") ? '"ID"' : null;
          const orderClause = timeCol
            ? (idCol ? `ORDER BY ${timeCol} DESC, ${idCol} DESC` : `ORDER BY ${timeCol} DESC`)
            : (idCol ? `ORDER BY ${idCol} DESC` : ``);

          const latestRes = await connection.execute(
            `SELECT * FROM (SELECT * FROM "${tableName}" ${orderClause}) WHERE ROWNUM = 1`,
          );
          telemetryCache.set(tableName, latestRes.rows?.[0] || null);
        } catch (_err) {
          telemetryCache.set(tableName, null);
        }
      }),
    );

    // 3. Evaluate each row using pre-fetched thresholds and cached telemetry
    const enriched_rows = rows.map((row) => {
      const thresholds = thresholdMap.get(row.id) || [];
      const latestRow = row.table_data ? telemetryCache.get(row.table_data) : null;

      let computed_status = "online";

      if (row.status === 0) {
        computed_status = "inactive";
      } else if (row.status === 2) {
        computed_status = "maintenance";
      } else if (!latestRow) {
        computed_status = "offline";
      } else {
        let raw_time;
        for (const key of Object.keys(latestRow)) {
          const k = key.toLowerCase();
          if (
            ["window_end_time", "datetime", "timestamp", "created_at"].includes(k)
          ) {
            raw_time = latestRow[key];
            break;
          }
        }

        if (raw_time) {
          const telemetry_date = new Date(raw_time);
          if (!Number.isNaN(telemetry_date.getTime())) {
            const age_ms = Date.now() - telemetry_date.getTime();
            if (age_ms > OFFLINE_TIMEOUT_MS) {
              computed_status = "offline";
            }
          }
        }

        if (computed_status !== "offline") {
          for (const t of thresholds) {
            let val;
            for (const key of Object.keys(latestRow)) {
              if (key.toLowerCase() === t.treshold_name.toLowerCase()) {
                val = latestRow[key];
                break;
              }
            }

            if (val !== undefined && val !== null) {
              const num_val = Number(val);
              if (
                t.treshold_maximum !== null &&
                num_val > Number(t.treshold_maximum)
              ) {
                computed_status = "alert_above_max";
                break;
              } else if (
                t.treshold_minimum !== null &&
                num_val < Number(t.treshold_minimum)
              ) {
                computed_status = "alert_below_min";
              }
            }
          }
        }
      }

      delete row.table_data;
      return {
        ...row,
        computed_status,
        threshold_count: thresholds.length,
        thresholds,
      };
    });

    const response = buildListResponse(enriched_rows, pagination);
    response.total = total;
    return response;
  });
}

async function createAlat(body) {
  const payload = validateAlatPayload(body, { partial: false });

  return withTransaction(async (connection) => {
    const station_res = await connection.execute(
      `SELECT "id" FROM "tb_master_station_position" WHERE "id" = :station_id AND ROWNUM = 1`,
      { station_id: payload.station_id },
    );
    if (!station_res.rows || station_res.rows.length === 0) {
      throw badRequest(`station with id ${payload.station_id} does not exist`);
    }

    await connection.execute(`LOCK TABLE "tb_master_alat" IN EXCLUSIVE MODE`);
    await assertUniqueAlat(connection, payload);
    const id_result = await connection.execute(
      `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_master_alat"`,
    );
    const next_id = id_result.rows[0].next_id;

    await connection.execute(
      `INSERT INTO "tb_master_alat" (
         "ID",
         "NAME",
         "STATION_ID",
         "WILAYAH_SUNGAI",
         "LOKASI",
         "STATUS",
         "CREATED_AT",
         "UPDATED_AT"
       ) VALUES (
         :id,
         :name,
         :station_id,
         :wilayah_sungai,
         :lokasi,
         :status,
         SYSTIMESTAMP,
         SYSTIMESTAMP
       )`,
      {
        id: next_id,
        name: payload.name,
        station_id: payload.station_id,
        wilayah_sungai: payload.wilayah_sungai,
        lokasi: payload.lokasi,
        status: payload.status,
      },
    );

    if (payload.thresholds && payload.thresholds.length > 0) {
      await connection.execute(
        `LOCK TABLE "tb_alat_threshold" IN EXCLUSIVE MODE`,
      );
      for (const t of payload.thresholds) {
        const t_id_result = await connection.execute(
          `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_alat_threshold"`,
        );
        const next_t_id = t_id_result.rows[0].next_id;

        await connection.execute(
          `INSERT INTO "tb_alat_threshold" (
             "ID",
             "ALAT_ID",
             "TRESHOLD_NAME",
             "TRESHOLD_MINIMUM",
             "TRESHOLD_MAXIMUM"
           ) VALUES (
             :id,
             :alat_id,
             :treshold_name,
             :treshold_minimum,
             :treshold_maximum
           )`,
          {
            id: next_t_id,
            alat_id: next_id,
            treshold_name: t.treshold_name,
            treshold_minimum: t.treshold_minimum,
            treshold_maximum: t.treshold_maximum,
          },
        );
      }
    }

    return getAlatByIdInternal(connection, next_id);
  });
}

async function updateAlat(id_value, body, { partial = false } = {}) {
  const id = parsePositiveInteger(id_value, "id");
  const payload = validateAlatPayload(body, { partial });

  return withTransaction(async (connection) => {
    await connection.execute(`LOCK TABLE "tb_master_alat" IN EXCLUSIVE MODE`);
    const existing = await getAlatByIdInternal(connection, id);
    if (!existing) {
      throw notFound("master alat not found");
    }

    await assertUniqueAlat(
      connection,
      {
        name: payload.name ?? existing.alat.name,
        station_id: payload.station_id ?? existing.alat.station_id,
      },
      id,
    );

    if (payload.station_id !== undefined) {
      const station_res = await connection.execute(
        `SELECT "id" FROM "tb_master_station_position" WHERE "id" = :station_id AND ROWNUM = 1`,
        { station_id: payload.station_id },
      );
      if (!station_res.rows || station_res.rows.length === 0) {
        throw badRequest(`station with id ${payload.station_id} does not exist`);
      }
    }

    const FIELD_MAPPING = {
      name: "NAME",
      station_id: "STATION_ID",
      wilayah_sungai: "WILAYAH_SUNGAI",
      lokasi: "LOKASI",
      status: "STATUS",
    };

    const set_clauses = [];
    const binds = { id };

    for (const [jsField, dbCol] of Object.entries(FIELD_MAPPING)) {
      if (payload[jsField] !== undefined) {
        set_clauses.push(`"${dbCol}" = :${jsField}`);
        binds[jsField] = payload[jsField];
      }
    }

    if (set_clauses.length > 0) {
      set_clauses.push(`"UPDATED_AT" = SYSTIMESTAMP`);
      await connection.execute(
        `UPDATE "tb_master_alat" SET ${set_clauses.join(", ")} WHERE "ID" = :id`,
        binds,
      );
    }

    if (payload.thresholds !== undefined) {
      await connection.execute(
        `DELETE FROM "tb_alat_threshold" WHERE "ALAT_ID" = :id`,
        { id },
      );

      if (payload.thresholds.length > 0) {
        await connection.execute(
          `LOCK TABLE "tb_alat_threshold" IN EXCLUSIVE MODE`,
        );
        for (const t of payload.thresholds) {
          const t_id_result = await connection.execute(
            `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_alat_threshold"`,
          );
          const next_t_id = t_id_result.rows[0].next_id;

          await connection.execute(
            `INSERT INTO "tb_alat_threshold" (
               "ID",
               "ALAT_ID",
               "TRESHOLD_NAME",
               "TRESHOLD_MINIMUM",
               "TRESHOLD_MAXIMUM"
             ) VALUES (
               :id,
               :alat_id,
               :treshold_name,
               :treshold_minimum,
               :treshold_maximum
             )`,
            {
              id: next_t_id,
              alat_id: id,
              treshold_name: t.treshold_name,
              treshold_minimum: t.treshold_minimum,
              treshold_maximum: t.treshold_maximum,
            },
          );
        }
      }
    }

    const updated = await getAlatByIdInternal(connection, id);
    return { before: existing, data: updated };
  });
}

async function deleteAlat(id_value) {
  const id = parsePositiveInteger(id_value, "id");

  return withTransaction(async (connection) => {
    const existing = await getAlatByIdInternal(connection, id);
    if (!existing) {
      throw notFound("master alat not found");
    }

    await connection.execute(
      `DELETE FROM "tb_notification_reads"
       WHERE "NOTIFICATION_ID" IN (
         SELECT "ID" FROM "tb_notifications" WHERE "ALAT_ID" = :id
       )`,
      { id },
    );

    await connection.execute(
      `DELETE FROM "tb_notifications" WHERE "ALAT_ID" = :id`,
      { id },
    );

    await connection.execute(
      `DELETE FROM "tb_alat_threshold" WHERE "ALAT_ID" = :id`,
      { id },
    );

    await connection.execute(
      `DELETE FROM "tb_master_alat" WHERE "ID" = :id`,
      { id },
    );

    return existing;
  });
}

async function addThreshold(alat_id_value, body) {
  const alat_id = parsePositiveInteger(alat_id_value, "alat_id");
  const validated_list = validateThresholds([body]);
  const t = validated_list[0];

  return withTransaction(async (connection) => {
    const alat = await getAlatByIdInternal(connection, alat_id);
    if (!alat) {
      throw notFound("master alat not found");
    }

    const dup_check = await connection.execute(
      `SELECT "ID" FROM "tb_alat_threshold" WHERE "ALAT_ID" = :alat_id AND LOWER("TRESHOLD_NAME") = :treshold_name AND ROWNUM = 1`,
      { alat_id, treshold_name: t.treshold_name.toLowerCase() },
    );
    if (dup_check.rows && dup_check.rows.length > 0) {
      throw badRequest(
        `threshold with name '${t.treshold_name}' already exists for this alat`,
      );
    }

    await connection.execute(
      `LOCK TABLE "tb_alat_threshold" IN EXCLUSIVE MODE`,
    );
    const t_id_result = await connection.execute(
      `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_alat_threshold"`,
    );
    const next_t_id = t_id_result.rows[0].next_id;

    await connection.execute(
      `INSERT INTO "tb_alat_threshold" (
         "ID",
         "ALAT_ID",
         "TRESHOLD_NAME",
         "TRESHOLD_MINIMUM",
         "TRESHOLD_MAXIMUM"
       ) VALUES (
         :id,
         :alat_id,
         :treshold_name,
         :treshold_minimum,
         :treshold_maximum
       )`,
      {
        id: next_t_id,
        alat_id: alat_id,
        treshold_name: t.treshold_name,
        treshold_minimum: t.treshold_minimum,
        treshold_maximum: t.treshold_maximum,
      },
    );

    const result = await connection.execute(
      `SELECT
         "ID" AS "id",
         "ALAT_ID" AS "alat_id",
         "TRESHOLD_NAME" AS "treshold_name",
         "TRESHOLD_MINIMUM" AS "treshold_minimum",
         "TRESHOLD_MAXIMUM" AS "treshold_maximum"
       FROM "tb_alat_threshold"
       WHERE "ID" = :id AND ROWNUM = 1`,
      { id: next_t_id },
    );

    return result.rows[0];
  });
}

async function updateThreshold(threshold_id_value, body) {
  const threshold_id = parsePositiveInteger(threshold_id_value, "threshold_id");

  return withTransaction(async (connection) => {
    const existing_res = await connection.execute(
      `SELECT
         "ID" AS "id",
         "ALAT_ID" AS "alat_id",
         "TRESHOLD_NAME" AS "treshold_name",
         "TRESHOLD_MINIMUM" AS "treshold_minimum",
         "TRESHOLD_MAXIMUM" AS "treshold_maximum"
       FROM "tb_alat_threshold"
       WHERE "ID" = :id AND ROWNUM = 1`,
      { id: threshold_id },
    );

    if (!existing_res.rows || existing_res.rows.length === 0) {
      throw notFound("threshold rule not found");
    }

    const current = existing_res.rows[0];
    const merged = {
      treshold_name:
        body.treshold_name !== undefined
          ? body.treshold_name
          : current.treshold_name,
      treshold_minimum:
        body.treshold_minimum !== undefined
          ? body.treshold_minimum
          : current.treshold_minimum,
      treshold_maximum:
        body.treshold_maximum !== undefined
          ? body.treshold_maximum
          : current.treshold_maximum,
    };

    const validated_list = validateThresholds([merged]);
    const t = validated_list[0];

    await connection.execute(
      `UPDATE "tb_alat_threshold"
       SET "TRESHOLD_NAME" = :treshold_name,
           "TRESHOLD_MINIMUM" = :treshold_minimum,
           "TRESHOLD_MAXIMUM" = :treshold_maximum
       WHERE "ID" = :id`,
      {
        id: threshold_id,
        treshold_name: t.treshold_name,
        treshold_minimum: t.treshold_minimum,
        treshold_maximum: t.treshold_maximum,
      },
    );

    const updated_res = await connection.execute(
      `SELECT
         "ID" AS "id",
         "ALAT_ID" AS "alat_id",
         "TRESHOLD_NAME" AS "treshold_name",
         "TRESHOLD_MINIMUM" AS "treshold_minimum",
         "TRESHOLD_MAXIMUM" AS "treshold_maximum"
       FROM "tb_alat_threshold"
       WHERE "ID" = :id AND ROWNUM = 1`,
      { id: threshold_id },
    );

    return updated_res.rows[0];
  });
}

async function deleteThreshold(threshold_id_value) {
  const threshold_id = parsePositiveInteger(threshold_id_value, "threshold_id");

  return withTransaction(async (connection) => {
    const existing_res = await connection.execute(
      `SELECT "ID" FROM "tb_alat_threshold" WHERE "ID" = :id AND ROWNUM = 1`,
      { id: threshold_id },
    );

    if (!existing_res.rows || existing_res.rows.length === 0) {
      throw notFound("threshold rule not found");
    }

    await connection.execute(
      `DELETE FROM "tb_alat_threshold" WHERE "ID" = :id`,
      { id: threshold_id },
    );

    return true;
  });
}

async function getStationColumns(station_id_value) {
  const station_id = parsePositiveInteger(station_id_value, "station_id");

  return withConnection(async (connection) => {
    const station_res = await connection.execute(
      `SELECT "TableData" AS "table_data" FROM "tb_master_station_position" WHERE "id" = :station_id AND ROWNUM = 1`,
      { station_id },
    );

    if (!station_res.rows || station_res.rows.length === 0) {
      throw notFound("station not found");
    }

    const table_name = station_res.rows[0].table_data;
    if (!table_name) {
      throw badRequest("station table_data is empty or not configured");
    }

    assertSafeTableName(table_name);

    const table_sample = await connection.execute(
      `SELECT * FROM "${table_name}" WHERE ROWNUM = 1`,
    );

    const EXCLUDED_COLUMNS = new Set([
      "id",
      "timestamp",
      "datetime",
      "window_start_time",
      "window_end_time",
      "created_at",
      "updated_at",
      "device_id",
      "station_id",
      "nama_station",
      "id_station",
      "kode_station",
      "stastion_type",
      "tabledata",
      "rn",
    ]);

    const columns = (table_sample.metaData || [])
      .map((col) => String(col.name).toLowerCase())
      .filter((col_name) => !EXCLUDED_COLUMNS.has(col_name))
      .sort();

    return columns;
  });
}

module.exports = {
  addThreshold,
  createAlat,
  deleteAlat,
  deleteThreshold,
  evaluateAlatStatus,
  getAlatById,
  getAlatStatusDetail,
  getStationColumns,
  listAlat,
  updateAlat,
  updateThreshold,
  validateAlatPayload,
};
