const assert = require("node:assert/strict");
const { collectActiveAnomalies } = require("../src/services/notifications");

const device = { id: 7, station_id: 11 };

assert.deepEqual(
  collectActiveAnomalies(device, {
    computed_status: "online",
    is_telemetry_offline: false,
    evaluations: [],
  }),
  [],
);

assert.deepEqual(
  collectActiveAnomalies(device, {
    computed_status: "offline",
    is_telemetry_offline: true,
    evaluations: [],
  }),
  [
    {
      category: "monitoring_offline",
      alat_id: 7,
      station_id: 11,
      metric_name: "telemetry_heartbeat",
    },
  ],
);

assert.deepEqual(
  collectActiveAnomalies(device, {
    computed_status: "online",
    is_telemetry_offline: false,
    evaluations: [
      { treshold_name: "flow_avg", evaluation: "alert_above_max" },
      { treshold_name: "vcc_last", evaluation: "normal" },
    ],
  }),
  [
    {
      category: "threshold_alert",
      alat_id: 7,
      station_id: 11,
      metric_name: "flow_avg",
      evaluation: "alert_above_max",
    },
  ],
);

assert.deepEqual(
  collectActiveAnomalies(device, {
    computed_status: "maintenance",
    is_telemetry_offline: false,
    evaluations: [
      { treshold_name: "flow_avg", evaluation: "alert_above_max" },
    ],
  }),
  [],
);

console.log("Active anomaly tests passed");
