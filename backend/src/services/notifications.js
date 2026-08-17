const { withConnection, withTransaction } = require("./database");
const { badRequest, notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");
const { evaluateAlatStatus } = require("./alat");
const { dispatch_notification_emails } = require("./email_service");
const logger = require("../logger");

let isEvaluationRunning = false;

async function listNotifications(query = {}, userId) {
  const pagination = parsePagination(query);
  const uid = parsePositiveInteger(userId, "user_id");
  const where_clauses = [];
  const binds = {
    user_id: uid,
    page_end: pagination.pageEnd,
    offset: pagination.offset,
  };

  if (query.category && typeof query.category === "string" && query.category.trim()) {
    where_clauses.push('n."CATEGORY" = :category');
    binds.category = query.category.trim().toLowerCase();
  }

  if (query.type && typeof query.type === "string" && query.type.trim()) {
    where_clauses.push('LOWER(n."TYPE") = :type');
    binds.type = query.type.trim().toLowerCase();
  }

  if (query.is_read !== undefined && query.is_read !== "") {
    const isRead = String(query.is_read) === "1" || String(query.is_read) === "true";
    if (isRead) {
      where_clauses.push(
        'EXISTS (SELECT 1 FROM "tb_notification_reads" r WHERE r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id)',
      );
    } else {
      where_clauses.push(
        'NOT EXISTS (SELECT 1 FROM "tb_notification_reads" r WHERE r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id)',
      );
    }
  }

  const where_sql =
    where_clauses.length > 0 ? `WHERE ${where_clauses.join(" AND ")}` : "";

  const count_binds = Object.fromEntries(
    Object.entries(binds).filter(
      ([k]) => !["page_end", "offset"].includes(k) && where_sql.includes(`:${k}`),
    ),
  );

  return withConnection(async (connection) => {
    const dataResult = await connection.execute(
      `SELECT
         "id",
         "type",
         "category",
         "title",
         "message",
         "alat_id",
         "station_id",
         "metric_name",
         "metric_value",
         "threshold_limit",
         "created_at",
         "is_read"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             n."ID" AS "id",
             n."TYPE" AS "type",
             n."CATEGORY" AS "category",
             n."TITLE" AS "title",
             n."MESSAGE" AS "message",
             n."ALAT_ID" AS "alat_id",
             n."STATION_ID" AS "station_id",
             n."METRIC_NAME" AS "metric_name",
             n."METRIC_VALUE" AS "metric_value",
             n."THRESHOLD_LIMIT" AS "threshold_limit",
             n."CREATED_AT" AS "created_at",
             CASE WHEN r."ID" IS NOT NULL THEN 1 ELSE 0 END AS "is_read"
           FROM "tb_notifications" n
           LEFT JOIN "tb_notification_reads" r
                  ON r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id
           ${where_sql}
           ORDER BY n."ID" DESC
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

    const totalResult = await connection.execute(
      `SELECT COUNT(*) AS "total"
       FROM "tb_notifications" n
       ${where_sql}`,
      count_binds,
      { fetchArraySize: 1, maxRows: 1 },
    );

    const rows = dataResult.rows || [];
    const total = Number(totalResult.rows?.[0]?.total ?? 0);

    const response = buildListResponse(rows, pagination);
    response.total = total;

    const unreadResult = await connection.execute(
      `SELECT COUNT(*) AS "unread"
       FROM "tb_notifications" n
       WHERE NOT EXISTS (
         SELECT 1 FROM "tb_notification_reads" r
         WHERE r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id
       )`,
      { user_id: uid },
      { fetchArraySize: 1, maxRows: 1 },
    );
    response.unread_count = Number(unreadResult.rows?.[0]?.unread ?? 0);

    return response;
  });
}

async function getNotificationSummary(userId) {
  const uid = parsePositiveInteger(userId, "user_id");

  return withConnection(async (connection) => {
    const unreadRes = await connection.execute(
      `SELECT COUNT(*) AS "unread"
       FROM "tb_notifications" n
       WHERE NOT EXISTS (
         SELECT 1 FROM "tb_notification_reads" r
         WHERE r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id
       )`,
      { user_id: uid },
      { fetchArraySize: 1, maxRows: 1 },
    );
    const unread_count = Number(unreadRes.rows?.[0]?.unread ?? 0);

    const recentRes = await connection.execute(
      `SELECT
         n."ID" AS "id",
         n."TYPE" AS "type",
         n."CATEGORY" AS "category",
         n."TITLE" AS "title",
         n."MESSAGE" AS "message",
         n."ALAT_ID" AS "alat_id",
         n."STATION_ID" AS "station_id",
         n."METRIC_NAME" AS "metric_name",
         n."METRIC_VALUE" AS "metric_value",
         n."THRESHOLD_LIMIT" AS "threshold_limit",
         n."CREATED_AT" AS "created_at",
         CASE WHEN r."ID" IS NOT NULL THEN 1 ELSE 0 END AS "is_read"
       FROM "tb_notifications" n
       LEFT JOIN "tb_notification_reads" r
              ON r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id
       WHERE ROWNUM <= 5
       ORDER BY n."ID" DESC`,
      { user_id: uid },
    );

    return {
      unread_count,
      data: recentRes.rows || [],
    };
  });
}

async function markNotificationRead(notificationIdValue, userId) {
  const notif_id = parsePositiveInteger(notificationIdValue, "notification_id");
  const uid = parsePositiveInteger(userId, "user_id");

  return withTransaction(async (connection) => {
    const notifRes = await connection.execute(
      `SELECT "ID" FROM "tb_notifications" WHERE "ID" = :id AND ROWNUM = 1`,
      { id: notif_id },
    );
    if (!notifRes.rows || notifRes.rows.length === 0) {
      throw notFound("notification not found");
    }

    const checkRes = await connection.execute(
      `SELECT "ID" FROM "tb_notification_reads" WHERE "NOTIFICATION_ID" = :notif_id AND "USER_ID" = :user_id AND ROWNUM = 1`,
      { notif_id, user_id: uid },
    );

    if (!checkRes.rows || checkRes.rows.length === 0) {
      await connection.execute(`LOCK TABLE "tb_notification_reads" IN EXCLUSIVE MODE`);
      const nextIdRes = await connection.execute(
        `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_notification_reads"`,
      );
      const next_id = nextIdRes.rows[0].next_id;

      await connection.execute(
        `INSERT INTO "tb_notification_reads" ("ID", "NOTIFICATION_ID", "USER_ID", "READ_AT")
         VALUES (:id, :notif_id, :user_id, SYSTIMESTAMP)`,
        { id: next_id, notif_id, user_id: uid },
      );
    }

    return true;
  });
}

async function markAllNotificationsRead(userId) {
  const uid = parsePositiveInteger(userId, "user_id");

  return withTransaction(async (connection) => {
    const unreadRes = await connection.execute(
      `SELECT n."ID"
       FROM "tb_notifications" n
       WHERE NOT EXISTS (
         SELECT 1 FROM "tb_notification_reads" r
         WHERE r."NOTIFICATION_ID" = n."ID" AND r."USER_ID" = :user_id
       )`,
      { user_id: uid },
    );

    const unreadNotifs = unreadRes.rows || [];
    if (unreadNotifs.length > 0) {
      await connection.execute(`LOCK TABLE "tb_notification_reads" IN EXCLUSIVE MODE`);
      for (const item of unreadNotifs) {
        const nextIdRes = await connection.execute(
          `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_notification_reads"`,
        );
        const next_id = nextIdRes.rows[0].next_id;

        await connection.execute(
          `INSERT INTO "tb_notification_reads" ("ID", "NOTIFICATION_ID", "USER_ID", "READ_AT")
           VALUES (:id, :notif_id, :user_id, SYSTIMESTAMP)`,
          { id: next_id, notif_id: item.ID, user_id: uid },
        );
      }
    }

    return true;
  });
}

async function evaluateNotificationsInternal() {
  if (isEvaluationRunning) {
    return { inserted: 0, skipped: true };
  }
  isEvaluationRunning = true;
  try {
    return await withTransaction(async (connection) => {
    let alatRes;
    try {
      alatRes = await connection.execute(
        `SELECT
           a."ID" AS "id",
           a."NAME" AS "name",
           a."STATION_ID" AS "station_id",
           s."nama" AS "station_name",
           s."kode_station" AS "kode_station",
           s."TableData" AS "table_data",
           a."STATUS" AS "status"
         FROM "tb_master_alat" a
         LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"`,
      );
    } catch (err) {
      if (err.message && err.message.includes("ORA-00904")) {
        alatRes = await connection.execute(
          `SELECT
             a."ID" AS "id",
             a."NAME" AS "name",
             a."STATION_ID" AS "station_id",
             s."nama" AS "station_name",
             s."kode_station" AS "kode_station",
             s."TableData" AS "table_data",
             1 AS "status"
           FROM "tb_master_alat" a
           LEFT JOIN "tb_master_station_position" s ON a."STATION_ID" = s."id"`,
        );
      } else {
        throw err;
      }
    }
    const devices = alatRes.rows || [];
    if (devices.length === 0) return { inserted: 0 };

    let insertedCount = 0;
    const new_notifications = [];

    for (const dev of devices) {
      const tRes = await connection.execute(
        `SELECT "ID" AS "id", "TRESHOLD_NAME" AS "treshold_name", "TRESHOLD_MINIMUM" AS "treshold_minimum", "TRESHOLD_MAXIMUM" AS "treshold_maximum"
         FROM "tb_alat_threshold" WHERE "ALAT_ID" = :alat_id`,
        { alat_id: dev.id },
      );
      const thresholds = tRes.rows || [];

      const evalInfo = await evaluateAlatStatus(connection, dev, thresholds);

      if (["inactive", "maintenance"].includes(evalInfo.computed_status)) {
        const statusMetric = `master_alat_${evalInfo.computed_status}`;
        const checkStateAlerted = await connection.execute(
          `SELECT "METRIC_NAME" FROM (
             SELECT "METRIC_NAME" FROM "tb_notifications"
             WHERE "ALAT_ID" = :alat_id AND "CATEGORY" = 'master_alat'
             ORDER BY "CREATED_AT" DESC, "ID" DESC
           ) WHERE ROWNUM = 1`,
          { alat_id: dev.id },
        );

        const latestMetric = checkStateAlerted.rows?.[0]?.METRIC_NAME;

        if (latestMetric !== statusMetric) {
          await connection.execute(`LOCK TABLE "tb_notifications" IN EXCLUSIVE MODE`);
          const nIdRes = await connection.execute(
            `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_notifications"`,
          );
          const next_n_id = nIdRes.rows[0].next_id;

          const isMaint = evalInfo.computed_status === "maintenance";
          const title = `Perangkat ${dev.name} ${isMaint ? "Maintenance" : "Inactive"}`;
          const message = isMaint
            ? `Perangkat ${dev.name} pada stasiun ${dev.station_name || `#${dev.station_id}`} saat ini sedang dalam perbaikan (Maintenance).`
            : `Perangkat ${dev.name} pada stasiun ${dev.station_name || `#${dev.station_id}`} saat ini dalam status nonaktif (Inactive).`;

          await connection.execute(
            `INSERT INTO "tb_notifications" (
               "ID", "TYPE", "CATEGORY", "TITLE", "MESSAGE", "ALAT_ID", "STATION_ID",
               "METRIC_NAME", "METRIC_VALUE", "THRESHOLD_LIMIT", "CREATED_AT"
             ) VALUES (
               :id, 'warning', 'master_alat', :title, :message, :alat_id, :station_id,
               :status_metric, NULL, NULL, SYSTIMESTAMP
             )`,
            {
              id: next_n_id,
              title,
              message,
              alat_id: dev.id,
              station_id: dev.station_id,
              status_metric: statusMetric,
            },
          );
          insertedCount++;
          new_notifications.push({
            id: next_n_id,
            type: "warning",
            category: "master_alat",
            title,
            message,
            alat_id: dev.id,
            station_id: dev.station_id,
            metric_name: statusMetric,
            metric_value: null,
            threshold_limit: null,
            created_at: new Date(),
          });
        }
      }

      if ((evalInfo.computed_status === "offline" || evalInfo.is_telemetry_offline) && dev.station_id) {
        const checkCooling = await connection.execute(
          `SELECT "ID" FROM "tb_notifications"
           WHERE "STATION_ID" = :station_id AND "CATEGORY" = 'monitoring_offline'
           AND "CREATED_AT" > SYSTIMESTAMP - INTERVAL '60' MINUTE
           AND ROWNUM = 1`,
          { station_id: dev.station_id },
        );

        if (!checkCooling.rows || checkCooling.rows.length === 0) {
          await connection.execute(`LOCK TABLE "tb_notifications" IN EXCLUSIVE MODE`);
          const nIdRes = await connection.execute(
            `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_notifications"`,
          );
          const next_n_id = nIdRes.rows[0].next_id;

          const stName = dev.station_name || dev.name;
          const stCode = dev.kode_station ? ` (${dev.kode_station})` : "";
          const title = `Pemantauan ${stName}${stCode}: Telemetry Offline`;
          const message = `Stasiun ${stName}${stCode} tidak menerima data telemetry > 15 menit.`;

          await connection.execute(
            `INSERT INTO "tb_notifications" (
               "ID", "TYPE", "CATEGORY", "TITLE", "MESSAGE", "ALAT_ID", "STATION_ID",
               "METRIC_NAME", "METRIC_VALUE", "THRESHOLD_LIMIT", "CREATED_AT"
             ) VALUES (
               :id, 'warning', 'monitoring_offline', :title, :message, NULL, :station_id,
               'telemetry_heartbeat', NULL, NULL, SYSTIMESTAMP
             )`,
            {
              id: next_n_id,
              title,
              message,
              station_id: dev.station_id,
            },
          );
          insertedCount++;
          new_notifications.push({
            id: next_n_id,
            type: "warning",
            category: "monitoring_offline",
            title,
            message,
            alat_id: null,
            station_id: dev.station_id,
            metric_name: "telemetry_heartbeat",
            metric_value: null,
            threshold_limit: null,
            created_at: new Date(),
          });
        }
      }

      for (const item of evalInfo.evaluations || []) {
        if (["alert_above_max", "alert_below_min"].includes(item.evaluation)) {
          const checkCooling = await connection.execute(
            `SELECT "ID" FROM "tb_notifications"
             WHERE "ALAT_ID" = :alat_id AND "CATEGORY" = 'threshold_alert'
             AND LOWER("METRIC_NAME") = :metric_name
             AND "CREATED_AT" > SYSTIMESTAMP - INTERVAL '30' MINUTE
             AND ROWNUM = 1`,
            { alat_id: dev.id, metric_name: item.treshold_name.toLowerCase() },
          );

          if (!checkCooling.rows || checkCooling.rows.length === 0) {
            await connection.execute(`LOCK TABLE "tb_notifications" IN EXCLUSIVE MODE`);
            const nIdRes = await connection.execute(
              `SELECT NVL(MAX("ID"), 0) + 1 AS "next_id" FROM "tb_notifications"`,
            );
            const next_n_id = nIdRes.rows[0].next_id;

            const isHigh = item.evaluation === "alert_above_max";
            const boundVal = isHigh ? item.treshold_maximum : item.treshold_minimum;
            const stName = dev.station_name || dev.name;
            const stCode = dev.kode_station ? ` (${dev.kode_station})` : "";
            const title = `Pemantauan ${stName}${stCode}: ${item.treshold_name.toUpperCase()} Alert`;
            const message = `Stasiun ${stName}${stCode} mencatat nilai ${item.treshold_name} = ${item.last_value} (Batas ${isHigh ? 'Maksimum' : 'Minimum'}: ${boundVal}).`;

            await connection.execute(
              `INSERT INTO "tb_notifications" (
                 "ID", "TYPE", "CATEGORY", "TITLE", "MESSAGE", "ALAT_ID", "STATION_ID",
                 "METRIC_NAME", "METRIC_VALUE", "THRESHOLD_LIMIT", "CREATED_AT"
               ) VALUES (
                 :id, 'critical', 'threshold_alert', :title, :message, :alat_id, :station_id,
                 :metric_name, :metric_value, :threshold_limit, SYSTIMESTAMP
               )`,
              {
                id: next_n_id,
                title,
                message,
                alat_id: dev.id,
                station_id: dev.station_id,
                metric_name: item.treshold_name,
                metric_value: item.last_value,
                threshold_limit: boundVal,
              },
            );
            insertedCount++;
            new_notifications.push({
              id: next_n_id,
              type: "critical",
              category: "threshold_alert",
              title,
              message,
              alat_id: dev.id,
              station_id: dev.station_id,
              metric_name: item.treshold_name,
              metric_value: item.last_value,
              threshold_limit: boundVal,
              created_at: new Date(),
            });
          }
        }
      }
    }

    if (new_notifications.length > 0) {
      await dispatch_notification_emails(connection, new_notifications);
    }

    return { inserted: insertedCount };
  });
  } catch (error) {
    logger.error(
      { err: error, service: "notification-evaluator" },
      "[Notification Evaluation Error] " + error.message,
    );
    throw error;
  } finally {
    isEvaluationRunning = false;
  }
}

module.exports = {
  evaluateNotificationsInternal,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
};
