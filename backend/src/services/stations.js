const config = require("../config");
const { TtlCache } = require("../cache");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { withConnection } = require("./database");

const stationCache = new TtlCache({
  name: "station_metadata",
  ttlMs: config.cache.stationTtlMs,
  maxItems: config.cache.stationMaxItems,
});

const IOT_DEFAULT_LIMIT = 100;
const IOT_MAX_LIMIT = 1000;
const SAFE_TABLE_NAME = /^tb_[a-z0-9_]+$/;
const DATA_MODES = new Set(["latest", "last_hour", "today", "date", "range"]);

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

  return withConnection(async (connection) => {
    const station = await findFlowStationById(connection, stationId);

    if (!station) {
      const error = new Error("station data table not found");

      error.statusCode = 404;
      throw error;
    }

    assertSafeTableName(station.table_data);

    const dataResult = await connection.execute(
      `SELECT
         "id",
         "nama_station",
         "datetime",
         "flow_1",
         "flow_2",
         "totalizer_1",
         "totalizer_2",
         "vcc",
         "logger_temp",
         "logger_humid"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             "id" AS "id",
             "nama_station" AS "nama_station",
             "datetime" AS "datetime",
             "flow_1" AS "flow_1",
             "flow_2" AS "flow_2",
             "totalizer_1" AS "totalizer_1",
             "totalizer_2" AS "totalizer_2",
             "vcc" AS "vcc",
             "logger_temp" AS "logger_temp",
             "logger_humid" AS "logger_humid"
           FROM "${station.table_data}"
           ${dataFilter.whereSql}
           ORDER BY "datetime" DESC, "id" DESC
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
    );
    const response = buildListResponse(dataResult.rows, dataFilter.pagination);

    return buildFlowStationDataResponse(station, response, dataFilter.mode);
  });
}

function invalidateStation(stationId) {
  stationCache.delete(`station:flow:${stationId}`);
}

function clearCache() {
  stationCache.clear();
}

module.exports = {
  buildFlowStationDataResponse,
  clearCache,
  getFlowStationData,
  invalidateStation,
  listFlowStations,
};
