-- Local-development bootstrap data. This is applied only to a newly created
-- Docker volume, after 001_schema.sql. It never reaches the configured `.env`
-- database.

ALTER SESSION SET CONTAINER = FREEPDB1;

INSERT INTO PKL_APP."companies" (
  "id",
  "name",
  "address",
  "contact",
  "created_at",
  "updated_at"
) VALUES (
  1,
  'Local Development Company',
  NULL,
  NULL,
  SYSTIMESTAMP,
  SYSTIMESTAMP
);

INSERT INTO PKL_APP."roles" (
  "id",
  "name",
  "guard_name",
  "created_at",
  "updated_at"
) VALUES (
  1,
  'super-admin',
  'web',
  SYSTIMESTAMP,
  SYSTIMESTAMP
);

INSERT ALL
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (1, 'create accesses', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (2, 'create companies', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (3, 'create permissions', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (4, 'create roles', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (5, 'create stations', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (6, 'create users', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (7, 'delete accesses', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (8, 'delete companies', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (9, 'delete permissions', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (10, 'delete roles', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (11, 'delete stations', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (30, 'delete users', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (12, 'list companies', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (13, 'list permissions', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (14, 'list roles', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (15, 'list users', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (16, 'receive notifications', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (17, 'update accesses', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (18, 'update companies', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (19, 'update permissions', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (20, 'update roles', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (21, 'update stations', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (22, 'update users', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (23, 'view accesses', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (24, 'view companies', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (25, 'view logs', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (26, 'view notifications', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (27, 'view permissions', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (28, 'view roles', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
  INTO PKL_APP."permissions" ("id", "name", "guard_name", "created_at", "updated_at") VALUES (29, 'view users', 'web', SYSTIMESTAMP, SYSTIMESTAMP)
SELECT 1 FROM DUAL;

INSERT INTO PKL_APP."users" (
  "id",
  "name",
  "email",
  "password",
  "phone",
  "status",
  "company_id",
  "created_at",
  "updated_at"
) VALUES (
  1,
  'Local Administrator',
  'admin@local.test',
  '$2b$12$IrT.ZeVDAmawrOR2WV3F/OKKKrS.1q9Gn1wfiS4COsjb4OCi38YBi',
  '+620000000000',
  '1',
  1,
  SYSTIMESTAMP,
  SYSTIMESTAMP
);

INSERT INTO PKL_APP."model_has_roles" (
  "role_id",
  "model_type",
  "model_id"
) VALUES (
  1,
  'App\Models\User',
  1
);

INSERT ALL
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (1, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (2, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (3, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (4, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (5, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (6, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (7, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (8, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (9, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (10, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (11, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (12, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (13, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (14, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (15, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (16, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (17, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (18, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (19, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (20, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (21, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (22, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (23, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (24, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (25, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (26, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (27, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (28, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (29, 1)
  INTO PKL_APP."role_has_permissions" ("permission_id", "role_id") VALUES (30, 1)
SELECT 1 FROM DUAL;

COMMIT;
