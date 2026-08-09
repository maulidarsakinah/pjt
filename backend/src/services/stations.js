const config = require("../config");
const { TtlCache } = require("../cache");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { badRequest, notFound } = require("../utils/httpErrors");
const { withConnection } = require("./database");

const stationCache = new TtlCache({
  name: "station_metadata",
  ttlMs: config.cache.stationTtlMs,
  maxItems: config.cache.stationMaxItems,
});

// Separate cache for table schema detection — same TTL as station metadata.
const schemaCache = new TtlCache({
  name: "station_schema",
  ttlMs: config.cache.stationTtlMs,
  maxItems: config.cache.stationMaxItems,
});

const IOT_DEFAULT_LIMIT = 100;
const IOT_MAX_LIMIT = 1000;
const SAFE_TABLE_NAME = /^tb_[a-z0-9_]+$/;
const DATA_MODES = new Set(["latest", "last_hour", "today", "date", "range"]);

// Columns that distinguish the new aggregated schema from the old raw schema.
const NEW_SCHEMA_COLUMNS = new Set([
  "flow_avg",
  "velocity_avg",
  "totalizer_end",
  "vcc_last",
  "battery_last",
  "vout_solar_last",
  "unit_total",
]);

function parseStationId(value) {
  const stationId = Number(value);

  if (!Number.isInteger(stationId) || stationId <= 0) {
    const error = new Error("station id must be a positive integer");

    error.statusCode = 400;
    throw error;
  }

  return stationId;
}

function assertSafeTableName(tableName) {
  if (!tableName || !SAFE_TABLE_NAME.test(tableName)) {
    const error = new Error("station data table is not configured correctly");

    error.statusCode = 500;
    error.publicMessage = "Station data table is not available";
    throw error;
  }
}

function parseMode(value) {
  const mode = value || "latest";

  if (!DATA_MODES.has(mode)) {
    const error = new Error(
      "mode must be one of latest, last_hour, today, date, or range",
    );

    error.statusCode = 400;
    throw error;
  }

  return mode;
}

function parseDateOnly(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${field} must use YYYY-MM-DD format`);

    error.statusCode = 400;
    throw error;
  }

  return value;
}

function parseDateTime(value, field) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    const error = new Error(`${field} must be a valid date-time`);

    error.statusCode = 400;
    throw error;
  }

  return new Date(value);
}

function buildDataFilter(query) {
  const mode = parseMode(query.mode);
  const binds = {};

  if (mode === "latest") {
    return {
      mode,
      whereSql: "",
      binds,
      pagination: {
        limit: 1,
        offset: 0,
        pageEnd: 2,
      },
    };
  }

  const pagination = parsePagination(query, {
    defaultLimit: IOT_DEFAULT_LIMIT,
    maxLimit: IOT_MAX_LIMIT,
  });

  if (mode === "last_hour") {
    return {
      mode,
      whereSql: `WHERE "datetime" >= SYSDATE - (1 / 24)`,
      binds,
      pagination,
    };
  }

  if (mode === "today") {
    return {
      mode,
      whereSql: `WHERE "datetime" >= TRUNC(SYSDATE) AND "datetime" < TRUNC(SYSDATE) + 1`,
      binds,
      pagination,
    };
  }

  if (mode === "date") {
    binds.date_value = parseDateOnly(query.date, "date");

    return {
      mode,
      whereSql: `WHERE "datetime" >= TO_DATE(:date_value, 'YYYY-MM-DD') AND "datetime" < TO_DATE(:date_value, 'YYYY-MM-DD') + 1`,
      binds,
      pagination,
    };
  }

  binds.start_date = parseDateTime(query.start, "start");
  binds.end_date = parseDateTime(query.end, "end");

  if (binds.start_date >= binds.end_date) {
    const error = new Error("start must be before end");

    error.statusCode = 400;
    throw error;
  }

  const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

  if (binds.end_date - binds.start_date > MAX_RANGE_MS) {
    const error = new Error("date range must not exceed 31 days");

    error.statusCode = 400;
    throw error;
  }

  return {
    mode,
    whereSql: `WHERE "datetime" >= :start_date AND "datetime" < :end_date`,
    binds,
    pagination,
  };
}

function buildFlowStationDataResponse(station, response, mode) {
  return {
    station,
    data: response.data,
    count: response.count,
    total: response.total ?? response.count,
    limit: response.limit,
    offset: response.offset,
    has_more: mode === "latest" ? false : response.has_more,
    mode,
  };
}

async function findFlowStationById(connection, stationId) {
  const cacheKey = `station:flow:${stationId}`;
  const cachedStation = stationCache.get(cacheKey);

  if (cachedStation) {
    return cachedStation;
  }

  const stationResult = await connection.execute(
    `SELECT
       "id" AS "id",
       "kode_station" AS "kode_station",
       "nama" AS "station_name",
       "stastion_type" AS "station_type",
       "TableData" AS "table_data"
     FROM "tb_master_station_position"
     WHERE "id" = :station_id
     AND "stastion_type" LIKE 'FLOW!_%' ESCAPE '!'
     AND "TableData" IS NOT NULL
     AND ROWNUM = 1`,
    { station_id: stationId },
    {
      fetchArraySize: 1,
      maxRows: 1,
    },
  );

  const station = stationResult.rows[0];

  if (station) {
    stationCache.set(cacheKey, station);
  }

  return station;
}

// Detect whether a table uses the new aggregated schema or the old raw schema.
// Result is cached to avoid hitting the database on every request.
async function detectTableSchema(connection, tableName) {
  assertSafeTableName(tableName);

  const cacheKey = `schema:${tableName}`;
  const cached = schemaCache.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  // Querying the table directly with ROWNUM = 1 is safer than ALL_TAB_COLUMNS
  // because it completely avoids issues with case sensitivity and quoted identifiers.
  // Re-assert the safe name guard immediately before interpolation.
  assertSafeTableName(tableName);
  const result = await connection.execute(
    `SELECT * FROM "${tableName}" WHERE ROWNUM = 1`
  );

  const columns = new Set(
    (result.metaData || []).map((col) => String(col.name).toLowerCase())
  );
  
  const is_new_schema = columns.has("flow_avg");

  schemaCache.set(cacheKey, is_new_schema);

  return is_new_schema;
}

async function listFlowStations(query) {
  const pagination = parsePagination(query);

  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT
         "id",
         "kode_station",
         "station_name",
         "station_type",
         "table_data"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             "id" AS "id",
             "kode_station" AS "kode_station",
             "nama" AS "station_name",
             "stastion_type" AS "station_type",
             "TableData" AS "table_data"
           FROM "tb_master_station_position"
           WHERE "stastion_type" LIKE 'FLOW!_%' ESCAPE '!'
           ORDER BY "nama" ASC
         ) page_query
         WHERE ROWNUM <= :page_end
       )
       WHERE "rn" > :offset`,
      {
        page_end: pagination.pageEnd,
        offset: pagination.offset,
      },
      {
        fetchArraySize: Math.min(pagination.limit + 1, 100),
        maxRows: pagination.limit + 1,
      },
    );

    return buildListResponse(result.rows, pagination);
  });
}

async function getFlowStationData(stationIdValue, query) {
  const stationId = parseStationId(stationIdValue);
  const dataFilter = buildDataFilter(query);
  const includeTotal = dataFilter.mode !== "latest";

  return withConnection(async (connection) => {
    const station = await findFlowStationById(connection, stationId);

    if (!station) {
      const error = new Error("station data table not found");

      error.statusCode = 404;
      throw error;
    }

    assertSafeTableName(station.table_data);

    const is_new_schema = await detectTableSchema(connection, station.table_data);

    // New schema uses window_end_time instead of datetime — rewrite WHERE clause.
    const where_sql = is_new_schema
      ? dataFilter.whereSql.replace(/\"datetime\"/g, '"window_end_time"')
      : dataFilter.whereSql;

    // Build schema-specific SELECT and ORDER BY clauses.
    const select_cols = is_new_schema
      ? `"id"            AS "id",
               "id_station"    AS "nama_station",
               "window_end_time"   AS "datetime",
               "flow_avg"      AS "flow_avg",
               "velocity_avg"  AS "velocity_avg",
               "totalizer_end" AS "totalizer_end",
               "vcc_last"      AS "vcc_last",
               "battery_last"  AS "battery_last",
               "vout_solar_last" AS "vout_solar_last",
               "unit_total"    AS "unit_total"`
      : `"id"            AS "id",
               "nama_station"  AS "nama_station",
               "datetime"      AS "datetime",
               "flow_1"        AS "flow_1",
               "flow_2"        AS "flow_2",
               "totalizer_1"   AS "totalizer_1",
               "totalizer_2"   AS "totalizer_2",
               "vcc"           AS "vcc",
               "logger_temp"   AS "logger_temp",
               "logger_humid"  AS "logger_humid"`;

    const order_by = is_new_schema
      ? `ORDER BY "window_end_time" DESC, "id" DESC`
      : `ORDER BY "datetime" DESC, "id" DESC`;

    // Run count and data queries in parallel when total is needed.
    // Separating them ensures total is always accurate even when offset
    // exceeds the number of available rows (which would make rows empty).
    const [dataResult, total] = await Promise.all([
      connection.execute(
        `SELECT
           "id",
           "nama_station",
           "datetime",
           ${is_new_schema
             ? `"flow_avg", "velocity_avg", "totalizer_end",
           "vcc_last", "battery_last", "vout_solar_last", "unit_total"`
             : `"flow_1", "flow_2", "totalizer_1", "totalizer_2",
           "vcc", "logger_temp", "logger_humid"`}
         FROM (
           SELECT page_query.*, ROWNUM AS "rn"
           FROM (
             SELECT
               ${select_cols}
             FROM "${station.table_data}"
             ${where_sql}
             ${order_by}
           ) page_query
           WHERE ROWNUM <= :page_end
         )
         WHERE "rn" > :offset`,
        {
          ...dataFilter.binds,
          page_end: dataFilter.pagination.pageEnd,
          offset: dataFilter.pagination.offset,
        },
        {
          fetchArraySize: Math.min(dataFilter.pagination.limit + 1, 100),
          maxRows: dataFilter.pagination.limit + 1,
        },
      ),
      includeTotal
        ? connection
            .execute(
              `SELECT COUNT(*) AS "total"
               FROM "${station.table_data}"
               ${where_sql}`,
              dataFilter.binds,
              { fetchArraySize: 1, maxRows: 1 },
            )
            .then((r) => Number(r.rows[0]?.total ?? 0))
        : Promise.resolve(null),
    ]);

    const resolved_total = includeTotal
      ? total
      : Math.min(dataResult.rows.length, dataFilter.pagination.limit);
    const response = {
      ...buildListResponse(dataResult.rows, dataFilter.pagination),
      total: resolved_total,
    };

    return buildFlowStationDataResponse(station, response, dataFilter.mode);
  });
}

function invalidateStation(stationId) {
  stationCache.delete(`station:flow:${stationId}`);
}

function clearCache() {
  stationCache.clear();
}

const MASTER_COLUMNS = [
  "kode_station", "nama", "x", "y", "z", "id_desa", "WaterLevel", "Rainfall",
  "Repeater", "Master", "Sub", "Branch", "GSMRainfall", "GSMWaterlevel",
  "TableData", "indexhuluhilir", "nostation", "clock", "validpos", "objecttype",
  "SIAGAWaterlevel", "SIAGADisch", "ws", "wl_decimal_num", "visible", "enabled",
  "GSMWQMS", "TableDataForecast", "hasForecast", "hasWLOffset", "WLOffset",
  "history_nomor", "provider", "sigab_enabled", "stastion_type", "aq_location_identifier",
  "id_api", "template_api", "GSMINSTR", "GSMFLOW", "resolution"
];

const MASTER_NUMERIC_COLUMNS = new Set([
  "x", "y", "z", "id_desa", "WaterLevel", "Rainfall", "Repeater", "Master",
  "Sub", "Branch", "GSMRainfall", "GSMWaterlevel", "indexhuluhilir",
  "ws", "wl_decimal_num", "enabled", "GSMWQMS",
  "hasForecast", "hasWLOffset", "WLOffset",
  "sigab_enabled", "GSMINSTR", "GSMFLOW", "aq_location_identifier",
]);

const MASTER_REQUIRED_ON_CREATE = ["kode_station", "nama"];

function validateMasterStationPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("request body must be an object");
  }

  const unknown = Object.keys(body).filter((k) => !MASTER_COLUMNS.includes(k));
  if (unknown.length && !partial) {
    // silently ignore unknowns on PATCH leniency but still surface typos on create
  }

  if (!partial) {
    for (const field of MASTER_REQUIRED_ON_CREATE) {
      const v = body[field];
      if (typeof v !== "string" || v.trim().length === 0) {
        throw badRequest(`${field} is required`);
      }
    }
  } else if (Object.keys(body).length === 0) {
    throw badRequest("at least one field is required");
  }

  const payload = {};
  for (const col of MASTER_COLUMNS) {
    if (body[col] === undefined) continue;

    const raw = body[col];
    // empty string => null (clear field)
    if (raw === "" || raw === null) {
      payload[col] = null;
      continue;
    }

    if (MASTER_NUMERIC_COLUMNS.has(col)) {
      const num = Number(raw);
      if (!Number.isFinite(num)) throw badRequest(`${col} must be a number`);
      payload[col] = num;
      continue;
    }

    if (typeof raw !== "string" && typeof raw !== "number") {
      throw badRequest(`${col} must be a string or number`);
    }
    const str = String(raw).trim();
    if (str.length > 500) throw badRequest(`${col} must be 500 characters or less`);
    payload[col] = str;
  }

  if (!partial) {
    for (const f of MASTER_REQUIRED_ON_CREATE) {
      if (payload[f] == null || String(payload[f]).trim() === "") {
        throw badRequest(`${f} is required`);
      }
    }
  }

  if (payload.TableData != null && !SAFE_TABLE_NAME.test(payload.TableData)) {
    throw badRequest("TableData must match the pattern tb_[a-z0-9_]+");
  }
  if (payload.TableDataForecast != null && !SAFE_TABLE_NAME.test(payload.TableDataForecast)) {
    throw badRequest("TableDataForecast must match the pattern tb_[a-z0-9_]+");
  }

  return payload;
}

async function getMasterStationById(connection, id) {
  const result = await connection.execute(
    `SELECT * FROM "tb_master_station_position" WHERE "id" = :id AND ROWNUM = 1`,
    { id },
    { fetchArraySize: 1, maxRows: 1 }
  );
  const row = result.rows[0];
  if (!row) return null;
  const { rn, ...rest } = row;
  return rest;
}

async function listMasterStations(query) {
  const pagination = parsePagination(query);
  const binds = {
    page_end: pagination.pageEnd,
    offset: pagination.offset,
  };
  const conditions = [`"kode_station" LIKE 'FLOW!_%' ESCAPE '!'`];

  if (query.search && String(query.search).trim()) {
    const s = `%${String(query.search).trim().toLowerCase()}%`;
    binds.search = s;
    conditions.push(`(LOWER("kode_station") LIKE :search OR LOWER("nama") LIKE :search)`);
  }

  if (query.enabled !== undefined && query.enabled !== "") {
    const v = String(query.enabled);
    if (v === "0" || v === "1") {
      binds.enabled = Number(v);
      conditions.push(`"enabled" = :enabled`);
    }
  }

  if (query.station_type && String(query.station_type).trim()) {
    binds.station_type = String(query.station_type).trim();
    conditions.push(`"stastion_type" = :station_type`);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return withConnection(async (connection) => {
    const [dataResult, totalResult] = await Promise.all([
      connection.execute(
        `SELECT *
         FROM (
           SELECT page_query.*, ROWNUM AS "rn"
           FROM (
             SELECT *
             FROM "tb_master_station_position"
             ${whereSql}
             ORDER BY "nama" ASC
           ) page_query
           WHERE ROWNUM <= :page_end
         )
         WHERE "rn" > :offset`,
        binds,
        {
          fetchArraySize: Math.min(pagination.limit + 1, 100),
          maxRows: pagination.limit + 1,
        },
      ),
      connection.execute(
        `SELECT COUNT(*) AS "total"
         FROM "tb_master_station_position"
         ${whereSql}`,
        Object.fromEntries(Object.entries(binds).filter(([k]) => !["page_end", "offset"].includes(k))),
        { fetchArraySize: 1, maxRows: 1 }
      ),
    ]);

    const rows = dataResult.rows.map((row) => {
      const { rn, ...rest } = row;
      return rest;
    });

    const response = buildListResponse(rows, pagination);
    response.total = Number(totalResult.rows[0]?.total ?? 0);
    return response;
  });
}

async function findMasterStation(idValue) {
  const id = parseStationId(idValue);
  return withConnection(async (connection) => {
    const row = await getMasterStationById(connection, id);
    if (!row) throw notFound("master station not found");
    return row;
  });
}

async function createMasterStation(data) {
  const payload = validateMasterStationPayload(data, { partial: false });

  for (const col of MASTER_COLUMNS) {
    if (payload[col] === undefined) payload[col] = null;
  }

  const placeholders = MASTER_COLUMNS.map(c => `:${c}`).join(", ");
  const colNames = MASTER_COLUMNS.map(c => `"${c}"`).join(", ");

  return withConnection(async (connection) => {
    // generate id explicitly to avoid trigger dependency and to return it
    let shouldRollback = false;
    try {
      await connection.execute(`LOCK TABLE "tb_master_station_position" IN EXCLUSIVE MODE`);
      shouldRollback = true;
      const idResult = await connection.execute(`SELECT NVL(MAX("id"),0)+1 AS "next_id" FROM "tb_master_station_position"`);
      const nextId = Number(idResult.rows[0].next_id);
      await connection.execute(
        `INSERT INTO "tb_master_station_position" ("id", ${colNames}) VALUES (:id, ${placeholders})`,
        { id: nextId, ...payload },
      );
      await connection.commit();
      shouldRollback = false;
      const created = await getMasterStationById(connection, nextId);
      return { data: created };
    } catch (error) {
      if (shouldRollback) try { await connection.rollback(); } catch {}
      if (error.code === "ORA-00001" || String(error.message).includes("ORA-00001")) {
        const e = new Error("kode_station already exists");
        e.statusCode = 409;
        throw e;
      }
      throw error;
    }
  });
}

async function updateMasterStation(idValue, data, { partial = true } = {}) {
  const id = parseStationId(idValue);
  const payload = validateMasterStationPayload(data, { partial });

  if (Object.keys(payload).length === 0) {
    throw badRequest("no updatable fields provided");
  }

  return withConnection(async (connection) => {
    let shouldRollback = false;
    try {
      const before = await getMasterStationById(connection, id);
      if (!before) throw notFound("master station not found");

      const setClauses = Object.keys(payload).map((field) => `"${field}" = :${field}`);
      const binds = { ...payload, id };
      shouldRollback = true;
      const result = await connection.execute(
        `UPDATE "tb_master_station_position" SET ${setClauses.join(", ")} WHERE "id" = :id`,
        binds,
      );
      if (result.rowsAffected === 0) throw notFound("master station not found");
      await connection.commit();
      shouldRollback = false;
      const after = await getMasterStationById(connection, id);
      return { data: after, before };
    } catch (error) {
      if (shouldRollback) try { await connection.rollback(); } catch {}
      if (error.statusCode) throw error;
      if (error.code === "ORA-00001" || String(error.message).includes("ORA-00001")) {
        const e = new Error("kode_station already exists");
        e.statusCode = 409;
        throw e;
      }
      throw error;
    }
  });
}

async function deleteMasterStation(idValue) {
  const id = parseStationId(idValue);
  return withConnection(async (connection) => {
    const existing = await getMasterStationById(connection, id);
    if (!existing) throw notFound("master station not found");
    let shouldRollback = false;
    try {
      shouldRollback = true;
      const result = await connection.execute(`DELETE FROM "tb_master_station_position" WHERE "id" = :id`, { id });
      if (result.rowsAffected === 0) throw notFound("master station not found");
      await connection.commit();
      shouldRollback = false;
    } catch (error) {
      if (shouldRollback) try { await connection.rollback(); } catch {}
      throw error;
    }
  });
}

module.exports = {
  MASTER_COLUMNS,
  buildFlowStationDataResponse,
  clearCache,
  createMasterStation,
  deleteMasterStation,
  findMasterStation,
  getFlowStationData,
  invalidateStation,
  listFlowStations,
  listMasterStations,
  updateMasterStation,
  validateMasterStationPayload,
};
