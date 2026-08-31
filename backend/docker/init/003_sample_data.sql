SET SQLBLANKLINES ON;
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Ensure station 740 exists
MERGE INTO PKL_APP."tb_master_station_position" target
USING (SELECT 740 AS "id" FROM DUAL) src
ON (target."id" = src."id")
WHEN MATCHED THEN
  UPDATE SET 
    target."kode_station" = 'FLOW_LAMONGAN',
    target."nama" = 'FLOWMETER LAMONGAN',
    target."TableData" = 'tb_flow_lamongan',
    target."stastion_type" = 'FLOW_METER',
    target."GSMFLOW" = 1,
    target."enabled" = 1,
    target."visible" = '1',
    target."x" = 112.4168,
    target."y" = -7.1197
WHEN NOT MATCHED THEN
  INSERT ("id", "kode_station", "nama", "TableData", "stastion_type", "GSMFLOW", "enabled", "visible", "x", "y")
  VALUES (740, 'FLOW_LAMONGAN', 'FLOWMETER LAMONGAN', 'tb_flow_lamongan', 'FLOW_METER', 1, 1, '1', 112.4168, -7.1197);

-- Ensure master alat 1 exists
MERGE INTO PKL_APP."tb_master_alat" target
USING (SELECT 1 AS "ID" FROM DUAL) src
ON (target."ID" = src."ID")
WHEN MATCHED THEN
  UPDATE SET target."NAME" = 'FLOWMETER LAMONGAN', target."STATION_ID" = 740, target."STATUS" = 1
WHEN NOT MATCHED THEN
  INSERT ("ID", "NAME", "STATION_ID", "WILAYAH_SUNGAI", "LOKASI", "STATUS", "CREATED_AT", "UPDATED_AT")
  VALUES (1, 'FLOWMETER LAMONGAN', 740, 'Bengawan Solo', 'Lamongan', 1, SYSTIMESTAMP, SYSTIMESTAMP);

-- Clean old sample telemetry
DELETE FROM PKL_APP."tb_flow_lamongan" WHERE "id" <= 10;

-- Individual inserts for maximum SQL*Plus compatibility
INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (1, 'FLOW_LAMONGAN', SYSTIMESTAMP - INTERVAL '25' MINUTE, 12, 12, 138.500000, 1.250000, 831.000, 452000.000, 12.38, 12.40, 18.50, 1, SYSTIMESTAMP);

INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (2, 'FLOW_LAMONGAN', SYSTIMESTAMP - INTERVAL '20' MINUTE, 12, 12, 140.200000, 1.280000, 841.200, 452841.200, 12.39, 12.41, 18.50, 1, SYSTIMESTAMP);

INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (3, 'FLOW_LAMONGAN', SYSTIMESTAMP - INTERVAL '15' MINUTE, 12, 12, 141.800000, 1.300000, 850.800, 453692.000, 12.40, 12.42, 18.40, 1, SYSTIMESTAMP);

INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (4, 'FLOW_LAMONGAN', SYSTIMESTAMP - INTERVAL '10' MINUTE, 12, 12, 143.100000, 1.320000, 858.600, 454550.600, 12.41, 12.42, 18.30, 1, SYSTIMESTAMP);

INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (5, 'FLOW_LAMONGAN', SYSTIMESTAMP - INTERVAL '5' MINUTE, 12, 12, 144.500000, 1.350000, 867.000, 455417.600, 12.42, 12.43, 18.20, 1, SYSTIMESTAMP);

INSERT INTO PKL_APP."tb_flow_lamongan" ("id", "id_station", "window_end_time", "sample_count", "expected_samples", "flow_avg", "velocity_avg", "totalizer_delta", "totalizer_end", "vcc_last", "battery_last", "vout_solar_last", "unit_total", "inserted_at")
VALUES (6, 'FLOW_LAMONGAN', SYSTIMESTAMP, 12, 12, 145.200000, 1.360000, 871.200, 456288.800, 12.42, 12.43, 18.10, 1, SYSTIMESTAMP);

COMMIT;
EXIT;
