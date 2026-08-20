-- This script is executed only during first initialization of the local Docker
-- Oracle volume. It never connects to the database configured in `.env`.
--
-- The initializer is run as SYS by the container image. APP_USER creates PKL_APP
-- before this script runs, so all application objects are explicitly owned by it.

ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE TABLE PKL_APP."companies" (
  "id" NUMBER(19, 0) NOT NULL,
  "name" VARCHAR2(255),
  "address" VARCHAR2(255),
  "contact" VARCHAR2(255),
  "created_at" TIMESTAMP(6),
  "updated_at" TIMESTAMP(6),
  CONSTRAINT "pk_companies" PRIMARY KEY ("id")
);

CREATE TABLE PKL_APP."users" (
  "id" NUMBER(19, 0) NOT NULL,
  "name" VARCHAR2(255),
  "email" VARCHAR2(255),
  "email_verified_at" TIMESTAMP(6),
  "password" VARCHAR2(255),
  "remember_token" VARCHAR2(100),
  "phone" VARCHAR2(255),
  "status" CHAR(1),
  "company_id" NUMBER(19, 0),
  "created_at" TIMESTAMP(6),
  "updated_at" TIMESTAMP(6),
  CONSTRAINT "pk_users" PRIMARY KEY ("id"),
  CONSTRAINT "uk_users_email" UNIQUE ("email"),
  CONSTRAINT "fk_users_company" FOREIGN KEY ("company_id")
    REFERENCES PKL_APP."companies" ("id")
);

CREATE TABLE PKL_APP."roles" (
  "id" NUMBER(19, 0) NOT NULL,
  "name" VARCHAR2(255),
  "guard_name" VARCHAR2(255),
  "created_at" TIMESTAMP(6),
  "updated_at" TIMESTAMP(6),
  CONSTRAINT "pk_roles" PRIMARY KEY ("id")
);

CREATE TABLE PKL_APP."permissions" (
  "id" NUMBER(19, 0) NOT NULL,
  "name" VARCHAR2(255),
  "guard_name" VARCHAR2(255),
  "created_at" TIMESTAMP(6),
  "updated_at" TIMESTAMP(6),
  CONSTRAINT "pk_permissions" PRIMARY KEY ("id")
);

CREATE TABLE PKL_APP."model_has_roles" (
  "role_id" NUMBER(19, 0) NOT NULL,
  "model_type" VARCHAR2(255) NOT NULL,
  "model_id" NUMBER(19, 0) NOT NULL,
  CONSTRAINT "pk_model_has_roles" PRIMARY KEY ("role_id", "model_type", "model_id"),
  CONSTRAINT "fk_model_has_roles_role" FOREIGN KEY ("role_id")
    REFERENCES PKL_APP."roles" ("id")
);

CREATE TABLE PKL_APP."role_has_permissions" (
  "permission_id" NUMBER(19, 0) NOT NULL,
  "role_id" NUMBER(19, 0) NOT NULL,
  CONSTRAINT "pk_role_has_permissions" PRIMARY KEY ("permission_id", "role_id"),
  CONSTRAINT "fk_role_has_permissions_permission" FOREIGN KEY ("permission_id")
    REFERENCES PKL_APP."permissions" ("id"),
  CONSTRAINT "fk_role_has_permissions_role" FOREIGN KEY ("role_id")
    REFERENCES PKL_APP."roles" ("id")
);

CREATE TABLE PKL_APP."model_has_permissions" (
  "permission_id" NUMBER(19, 0) NOT NULL,
  "model_type" VARCHAR2(255) NOT NULL,
  "model_id" NUMBER(19, 0) NOT NULL,
  CONSTRAINT "pk_model_has_permissions" PRIMARY KEY ("permission_id", "model_type", "model_id"),
  CONSTRAINT "fk_model_has_permissions_permission" FOREIGN KEY ("permission_id")
    REFERENCES PKL_APP."permissions" ("id")
);

CREATE TABLE PKL_APP."tb_master_station_position" (
  "id" NUMBER NOT NULL,
  "kode_station" VARCHAR2(255),
  "nama" VARCHAR2(255),
  "x" NUMBER,
  "y" NUMBER,
  "z" NUMBER,
  "id_desa" NUMBER,
  "WaterLevel" NUMBER,
  "Rainfall" NUMBER,
  "Repeater" NUMBER,
  "Master" NUMBER,
  "Sub" NUMBER,
  "Branch" NUMBER,
  "GSMRainfall" NUMBER,
  "GSMWaterlevel" NUMBER,
  "TableData" VARCHAR2(100),
  "indexhuluhilir" NUMBER,
  "nostation" VARCHAR2(100),
  "clock" NUMBER,
  "validpos" VARCHAR2(20),
  "objecttype" VARCHAR2(50),
  "SIAGAWaterlevel" VARCHAR2(20),
  "SIAGADisch" VARCHAR2(20),
  "ws" NUMBER,
  "wl_decimal_num" NUMBER,
  "visible" VARCHAR2(20),
  "enabled" NUMBER,
  "GSMWQMS" NUMBER,
  "TableDataForecast" VARCHAR2(100),
  "hasForecast" NUMBER,
  "hasWLOffset" NUMBER,
  "WLOffset" NUMBER,
  "history_nomor" VARCHAR2(1000),
  "provider" VARCHAR2(10),
  "sigab_enabled" NUMBER,
  "stastion_type" VARCHAR2(50),
  "aq_location_identifier" NUMBER,
  "id_api" VARCHAR2(100),
  "template_api" VARCHAR2(50),
  "GSMINSTR" NUMBER,
  "GSMFLOW" NUMBER,
  "resolution" VARCHAR2(20),
  CONSTRAINT "pk_master_station_position" PRIMARY KEY ("id")
);

CREATE TABLE PKL_APP."tb_flow_lamongan" (
  "id" NUMBER(19, 0) NOT NULL,
  "id_station" VARCHAR2(100) NOT NULL,
  "window_end_time" TIMESTAMP(6),
  "sample_count" NUMBER(5, 0),
  "expected_samples" NUMBER(5, 0),
  "flow_avg" NUMBER(12, 6),
  "velocity_avg" NUMBER(12, 6),
  "totalizer_delta" NUMBER(15, 3),
  "totalizer_end" NUMBER(15, 3),
  "vcc_last" NUMBER(6, 2),
  "battery_last" NUMBER(6, 2),
  "vout_solar_last" NUMBER(6, 2),
  "unit_total" NUMBER(2, 0),
  "inserted_at" TIMESTAMP(6),
  CONSTRAINT "pk_flow_lamongan" PRIMARY KEY ("id")
);

CREATE TABLE PKL_APP."tb_master_alat" (
  "ID" NUMBER NOT NULL,
  "NAME" VARCHAR2(100),
  "STATION_ID" NUMBER,
  "WILAYAH_SUNGAI" VARCHAR2(100),
  "LOKASI" VARCHAR2(200),
  "STATUS" NUMBER(1, 0),
  "CREATED_AT" TIMESTAMP(6),
  "UPDATED_AT" TIMESTAMP(6),
  CONSTRAINT "pk_master_alat" PRIMARY KEY ("ID"),
  CONSTRAINT "fk_master_alat_station" FOREIGN KEY ("STATION_ID")
    REFERENCES PKL_APP."tb_master_station_position" ("id")
);

CREATE TABLE PKL_APP."tb_alat_threshold" (
  "ID" NUMBER NOT NULL,
  "ALAT_ID" NUMBER,
  "TRESHOLD_NAME" VARCHAR2(50),
  "TRESHOLD_MINIMUM" NUMBER,
  "TRESHOLD_MAXIMUM" NUMBER,
  CONSTRAINT "pk_alat_threshold" PRIMARY KEY ("ID"),
  CONSTRAINT "uk_alat_threshold_name" UNIQUE ("ALAT_ID", "TRESHOLD_NAME"),
  CONSTRAINT "fk_alat_threshold_alat" FOREIGN KEY ("ALAT_ID")
    REFERENCES PKL_APP."tb_master_alat" ("ID")
);

CREATE TABLE PKL_APP."tb_notifications" (
  "ID" NUMBER NOT NULL,
  "TYPE" VARCHAR2(20),
  "CATEGORY" VARCHAR2(30),
  "TITLE" VARCHAR2(200),
  "MESSAGE" VARCHAR2(500),
  "ALAT_ID" NUMBER,
  "STATION_ID" NUMBER,
  "METRIC_NAME" VARCHAR2(50),
  "METRIC_VALUE" NUMBER,
  "THRESHOLD_LIMIT" NUMBER,
  "IS_READ" NUMBER(1, 0),
  "CREATED_AT" TIMESTAMP(6),
  CONSTRAINT "pk_notifications" PRIMARY KEY ("ID"),
  CONSTRAINT "fk_notifications_alat" FOREIGN KEY ("ALAT_ID")
    REFERENCES PKL_APP."tb_master_alat" ("ID"),
  CONSTRAINT "fk_notifications_station" FOREIGN KEY ("STATION_ID")
    REFERENCES PKL_APP."tb_master_station_position" ("id")
);

CREATE TABLE PKL_APP."tb_notification_reads" (
  "ID" NUMBER NOT NULL,
  "NOTIFICATION_ID" NUMBER,
  "USER_ID" NUMBER(19, 0),
  "READ_AT" TIMESTAMP(6),
  CONSTRAINT "pk_notification_reads" PRIMARY KEY ("ID"),
  CONSTRAINT "uk_notification_reads_user" UNIQUE ("NOTIFICATION_ID", "USER_ID"),
  CONSTRAINT "fk_notification_reads_notification" FOREIGN KEY ("NOTIFICATION_ID")
    REFERENCES PKL_APP."tb_notifications" ("ID"),
  CONSTRAINT "fk_notification_reads_user" FOREIGN KEY ("USER_ID")
    REFERENCES PKL_APP."users" ("id")
);

COMMIT;
