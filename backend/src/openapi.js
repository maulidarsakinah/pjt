const config = require("./config");

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "PKL API",
    version: "1.0.0",
    description: "Express API for Oracle database resources.",
  },
  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: "Local development server",
    },
  ],
  tags: [
    {
      name: "Health",
      description: "Service health checks",
    },
    {
      name: "Companies",
      description: "Company records scoped to the authenticated user",
    },
    {
      name: "Access",
      description: "Authenticated user's roles and permissions",
    },
    {
      name: "Roles",
      description: "Role management and role-permission assignment",
    },
    {
      name: "Permissions",
      description: "Permission management",
    },
    {
      name: "Logs",
      description: "Administrative access to normalized backend log entries",
    },
    {
      name: "Stations",
      description: "Station records and IoT data",
    },
    {
      name: "Auth",
      description: "User registration and login",
    },
  ],
  paths: {
    "/api/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a user",
        operationId: "registerUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AuthResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          409: {
            description: "Email already registered",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/login": {
      post: {
        tags: ["Auth"],
        summary: "Login a user",
        operationId: "loginUser",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AuthResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        operationId: "getHealth",
        responses: {
          200: {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/companies": {
      get: {
        tags: ["Companies"],
        summary: "List companies",
        description: "Requires the `list companies` permission.",
        operationId: "listCompanies",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 100,
            },
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
        ],
        responses: {
          200: {
            description: "Companies returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CompaniesResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Companies"],
        summary: "Create a company",
        description: "Requires the `create companies` permission.",
        operationId: "createCompany",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CompanyRequest",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Company created successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CompanyResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/companies/{id}": {
      get: {
        tags: ["Companies"],
        summary: "Get a company by id",
        description: "Requires the `view companies` permission.",
        operationId: "getCompany",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
          },
        ],
        responses: {
          200: {
            description: "Company returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CompanyResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Company not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Companies"],
        summary: "Update a company",
        description: "Requires the `update companies` permission.",
        operationId: "updateCompany",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CompanyRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Company updated successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CompanyResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Company not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Companies"],
        summary: "Partially update a company",
        description: "Requires the `update companies` permission.",
        operationId: "patchCompany",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CompanyUpdateRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Company updated successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CompanyResponse",
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Company not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Companies"],
        summary: "Delete a company",
        description: "Requires the `delete companies` permission.",
        operationId: "deleteCompany",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
          },
        ],
        responses: {
          204: {
            description: "Company deleted successfully",
          },
          403: {
            description: "Missing required permission",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Company not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/me": {
      get: {
        tags: ["Access"],
        summary: "Get authenticated user's profile, company, roles, and permissions",
        operationId: "getMe",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          200: {
            description: "Authenticated user returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MeResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/me/password": {
      patch: {
        tags: ["Access"],
        summary: "Change authenticated user's password",
        operationId: "changeMyPassword",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ChangePasswordRequest",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Password updated successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MessageResponse",
                },
              },
            },
          },
          400: {
            description: "Invalid password change request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/me/access": {
      get: {
        tags: ["Access"],
        summary: "Get authenticated user's roles and permissions",
        operationId: "getMyAccess",
        security: [
          {
            bearerAuth: [],
          },
        ],
        responses: {
          200: {
            description: "Access data returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AccessResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/roles": {
      get: {
        tags: ["Roles"],
        summary: "List roles",
        description: "Requires the `list roles` permission.",
        operationId: "listRoles",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 100,
            },
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
        ],
        responses: {
          200: {
            description: "Roles returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RolesResponse" },
              },
            },
          },
          401: { description: "Missing or invalid bearer token" },
          403: { description: "Missing required permission" },
        },
      },
      post: {
        tags: ["Roles"],
        summary: "Create a role",
        description: "Requires the `create roles` permission.",
        operationId: "createRole",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RoleRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Role created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleResponse" },
              },
            },
          },
          400: { description: "Validation error" },
          403: { description: "Missing required permission" },
        },
      },
    },
    "/api/roles/{id}": {
      get: {
        tags: ["Roles"],
        summary: "Get a role by id",
        description: "Requires the `view roles` permission.",
        operationId: "getRole",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          200: {
            description: "Role returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleResponse" },
              },
            },
          },
          404: { description: "Role not found" },
        },
      },
      put: {
        tags: ["Roles"],
        summary: "Update a role",
        description: "Requires the `update roles` permission.",
        operationId: "updateRole",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RoleRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Role updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleResponse" },
              },
            },
          },
          404: { description: "Role not found" },
        },
      },
      patch: {
        tags: ["Roles"],
        summary: "Partially update a role",
        description: "Requires the `update roles` permission.",
        operationId: "patchRole",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RoleUpdateRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Role updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleResponse" },
              },
            },
          },
          404: { description: "Role not found" },
        },
      },
      delete: {
        tags: ["Roles"],
        summary: "Delete a role",
        description: "Requires the `delete roles` permission.",
        operationId: "deleteRole",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          204: { description: "Role deleted successfully" },
          404: { description: "Role not found" },
        },
      },
    },
    "/api/roles/{id}/permissions": {
      get: {
        tags: ["Roles"],
        summary: "List permissions attached to a role",
        description: "Requires the `view roles` permission.",
        operationId: "getRolePermissions",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          200: {
            description: "Role permissions returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionsResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Roles"],
        summary: "Replace permissions attached to a role",
        description: "Requires the `update roles` permission.",
        operationId: "syncRolePermissions",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RolePermissionsRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Role permissions updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/permissions": {
      get: {
        tags: ["Permissions"],
        summary: "List permissions",
        description: "Requires the `list permissions` permission.",
        operationId: "listPermissions",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 100,
            },
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
        ],
        responses: {
          200: {
            description: "Permissions returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionsResponse" },
              },
            },
          },
          403: { description: "Missing required permission" },
        },
      },
      post: {
        tags: ["Permissions"],
        summary: "Create a permission",
        description: "Requires the `create permissions` permission.",
        operationId: "createPermission",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PermissionRequest" },
            },
          },
        },
        responses: {
          201: {
            description: "Permission created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionResponse" },
              },
            },
          },
        },
      },
    },
    "/api/permissions/{id}": {
      get: {
        tags: ["Permissions"],
        summary: "Get a permission by id",
        description: "Requires the `view permissions` permission.",
        operationId: "getPermission",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          200: {
            description: "Permission returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionResponse" },
              },
            },
          },
          404: { description: "Permission not found" },
        },
      },
      put: {
        tags: ["Permissions"],
        summary: "Update a permission",
        description: "Requires the `update permissions` permission.",
        operationId: "updatePermission",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PermissionRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Permission updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Permissions"],
        summary: "Partially update a permission",
        description: "Requires the `update permissions` permission.",
        operationId: "patchPermission",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PermissionUpdateRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "Permission updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Permissions"],
        summary: "Delete a permission",
        description: "Requires the `delete permissions` permission.",
        operationId: "deletePermission",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          204: { description: "Permission deleted successfully" },
          404: { description: "Permission not found" },
        },
      },
    },
    "/api/users/accesses": {
      get: {
        tags: ["Access"],
        summary: "List user role assignments",
        description: "Requires the `list accesses` permission.",
        operationId: "listUserAccesses",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 100,
            },
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
        ],
        responses: {
          200: {
            description: "User access assignments returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserAccessesResponse" },
              },
            },
          },
          403: { description: "Missing required permission" },
        },
      },
    },
    "/api/users/{id}/access": {
      get: {
        tags: ["Access"],
        summary: "Get a user's assigned and effective access",
        description: "Requires the `view accesses` permission.",
        operationId: "getUserAccess",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          200: {
            description: "User access returned successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserAccessResponse" },
              },
            },
          },
          404: { description: "User not found" },
        },
      },
    },
    "/api/users/{id}/roles": {
      put: {
        tags: ["Access"],
        summary: "Replace a user's roles",
        description: "Requires the `update accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "syncUserRoles",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserRolesRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "User roles updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RolesResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/{id}/roles/{roleId}": {
      post: {
        tags: ["Access"],
        summary: "Attach one role to a user",
        description: "Requires the `create accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "attachUserRole",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/IdPath" },
          { $ref: "#/components/parameters/RoleIdPath" },
        ],
        responses: {
          201: {
            description: "Role attached successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RolesResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Access"],
        summary: "Detach one role from a user",
        description: "Requires the `delete accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "detachUserRole",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/IdPath" },
          { $ref: "#/components/parameters/RoleIdPath" },
        ],
        responses: {
          204: { description: "Role detached successfully" },
          404: { description: "Role assignment not found" },
        },
      },
    },
    "/api/users/{id}/permissions": {
      put: {
        tags: ["Access"],
        summary: "Replace a user's direct permissions",
        description: "Requires the `update accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "syncUserDirectPermissions",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserPermissionsRequest" },
            },
          },
        },
        responses: {
          200: {
            description: "User direct permissions updated successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionsResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/{id}/permissions/{permissionId}": {
      post: {
        tags: ["Access"],
        summary: "Attach one direct permission to a user",
        description: "Requires the `create accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "attachUserDirectPermission",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/IdPath" },
          { $ref: "#/components/parameters/PermissionIdPath" },
        ],
        responses: {
          201: {
            description: "Direct permission attached successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PermissionsResponse" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Access"],
        summary: "Detach one direct permission from a user",
        description: "Requires the `delete accesses` permission. The caller cannot modify their own access assignments.",
        operationId: "detachUserDirectPermission",
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: "#/components/parameters/IdPath" },
          { $ref: "#/components/parameters/PermissionIdPath" },
        ],
        responses: {
          204: { description: "Direct permission detached successfully" },
          404: { description: "Permission assignment not found" },
        },
      },
    },
    "/api/logs": {
      get: {
        tags: ["Logs"],
        summary: "List backend log entries",
        description: "Reads normalized entries from the backend log directory. Successful reads of this endpoint are excluded to prevent self-generated audit noise. Totals and pages may be cached for up to 5 seconds. Requires the `list accesses` permission.",
        operationId: "listLogs",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 200,
              default: 50,
            },
          },
          { $ref: "#/components/parameters/OffsetQuery" },
          {
            name: "date",
            in: "query",
            required: false,
            description: "Log date in Asia/Jakarta using YYYY-MM-DD.",
            schema: { type: "string", format: "date" },
          },
          {
            name: "level",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["trace", "debug", "info", "warn", "error", "fatal"],
            },
          },
          {
            name: "method",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
            },
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["success", "failed"] },
          },
          {
            name: "search",
            in: "query",
            required: false,
            description: "Case-insensitive search across trace ID, method, endpoint, message, and error fields.",
            schema: { type: "string", maxLength: 200 },
          },
        ],
        responses: {
          200: {
            description: "Log entries returned newest first",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogsResponse" },
              },
            },
          },
          400: {
            description: "Invalid filter or pagination parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: { description: "Missing or invalid bearer token" },
          403: { description: "Missing the list accesses permission" },
          500: {
            description: "Log directory or server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/stations/flow": {
      get: {
        tags: ["Stations"],
        summary: "Get stations whose station type starts with FLOW_",
        description: "Requires a valid bearer token. No named permission is required.",
        operationId: "getFlowStations",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 500,
              default: 100,
            },
            description: "Maximum number of stations to return",
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
        ],
        responses: {
          200: {
            description: "FLOW_ station records returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/StationsResponse",
                },
              },
            },
          },
          400: {
            description: "Invalid query parameter",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/stations/flow/{id}/data": {
      get: {
        tags: ["Stations"],
        summary: "Get IoT data rows for a FLOW_ station",
        description: "Requires a valid bearer token. No named permission is required.",
        operationId: "getFlowStationData",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "integer",
              minimum: 1,
            },
            description: "Station id from /api/stations/flow",
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              maximum: 1000,
              default: 100,
            },
            description: "Maximum number of IoT rows to return",
          },
          {
            $ref: "#/components/parameters/OffsetQuery",
          },
          {
            name: "mode",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["latest", "last_hour", "today", "date", "range"],
              default: "latest",
            },
            description: "Time filter mode for station data",
          },
          {
            name: "date",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date",
              example: "2026-07-08",
            },
            description: "Required when mode=date. Uses YYYY-MM-DD.",
          },
          {
            name: "start",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date-time",
              example: "2026-07-08T00:00:00+07:00",
            },
            description: "Required when mode=range. Inclusive start date-time.",
          },
          {
            name: "end",
            in: "query",
            required: false,
            schema: {
              type: "string",
              format: "date-time",
              example: "2026-07-09T00:00:00+07:00",
            },
            description: "Required when mode=range. Exclusive end date-time.",
          },
        ],
        responses: {
          200: {
            description: "Station IoT data returned successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/FlowStationDataResponse",
                },
              },
            },
          },
          400: {
            description: "Invalid parameter",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          401: {
            description: "Missing or invalid bearer token",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          404: {
            description: "Station data table not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          500: {
            description: "Database or server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      IdPath: {
        name: "id",
        in: "path",
        required: true,
        schema: {
          type: "integer",
          minimum: 1,
        },
      },
      RoleIdPath: {
        name: "roleId",
        in: "path",
        required: true,
        schema: {
          type: "integer",
          minimum: 1,
        },
      },
      PermissionIdPath: {
        name: "permissionId",
        in: "path",
        required: true,
        schema: {
          type: "integer",
          minimum: 1,
        },
      },
      OffsetQuery: {
        name: "offset",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 0,
          default: 0,
        },
        description: "Number of records to skip before returning results",
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password", "phone", "company_id"],
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "Admin User",
          },
          email: {
            type: "string",
            format: "email",
            maxLength: 255,
            example: "admin@example.com",
          },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            maxLength: 255,
            example: "password123",
          },
          phone: {
            type: "string",
            maxLength: 255,
            example: "08123456789",
          },
          company_id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "admin@example.com",
          },
          password: {
            type: "string",
            format: "password",
            example: "password123",
          },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["current_password", "new_password", "new_password_confirmation"],
        properties: {
          current_password: {
            type: "string",
            format: "password",
            maxLength: 255,
            example: "password123",
          },
          new_password: {
            type: "string",
            format: "password",
            minLength: 8,
            maxLength: 255,
            example: "newPassword123",
          },
          new_password_confirmation: {
            type: "string",
            format: "password",
            minLength: 8,
            maxLength: 255,
            example: "newPassword123",
          },
        },
      },
      MessageResponse: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
            example: "password updated",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          name: {
            type: "string",
            example: "Admin User",
          },
          email: {
            type: "string",
            format: "email",
            example: "admin@example.com",
          },
          phone: {
            type: "string",
            example: "08123456789",
          },
          status: {
            type: "string",
            example: "1",
          },
          company_id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          email_verified_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          created_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          updated_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
      AuthResponse: {
        type: "object",
        required: ["user", "token"],
        properties: {
          user: {
            $ref: "#/components/schemas/User",
          },
          token: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status", "uptime", "timestamp"],
        properties: {
          status: {
            type: "string",
            example: "ok",
          },
          uptime: {
            type: "number",
            example: 128.42,
          },
          timestamp: {
            type: "string",
            format: "date-time",
            example: "2026-07-06T03:15:00.000Z",
          },
        },
      },
      Company: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          name: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "Example Company",
          },
          address: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "Jakarta",
          },
          contact: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "+62 812 3456 7890",
          },
          created_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          updated_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
      CompanyRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "Example Company",
          },
          address: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "Jakarta",
          },
          contact: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "+62 812 3456 7890",
          },
        },
      },
      CompanyUpdateRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "Updated Company",
          },
          address: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "Bandung",
          },
          contact: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "+62 812 3456 7890",
          },
        },
      },
      CompanyResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            $ref: "#/components/schemas/Company",
          },
        },
      },
      CompaniesResponse: {
        type: "object",
        required: ["data", "count", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Company",
            },
          },
          count: {
            type: "integer",
            example: 1,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
        },
      },
      AccessResponse: {
        type: "object",
        required: ["roles", "permissions"],
        properties: {
          roles: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["user"],
          },
          permissions: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["list companies", "view companies"],
          },
        },
      },
      Me: {
        type: "object",
        required: ["id", "name", "email", "company_id", "company", "roles", "permissions"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 21,
          },
          name: {
            type: "string",
            example: "Test User",
          },
          email: {
            type: "string",
            format: "email",
            example: "test@gmail.com",
          },
          phone: {
            type: "string",
            nullable: true,
            example: "08123456789",
          },
          status: {
            type: "string",
            example: "1",
          },
          company_id: {
            type: "integer",
            format: "int64",
            nullable: true,
            example: 1,
          },
          company: {
            allOf: [{ $ref: "#/components/schemas/Company" }],
            nullable: true,
          },
          roles: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["user"],
          },
          permissions: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["list companies", "view companies"],
          },
        },
      },
      MeResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            $ref: "#/components/schemas/Me",
          },
        },
      },
      Role: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          name: {
            type: "string",
            example: "user",
          },
          guard_name: {
            type: "string",
            example: "web",
          },
          created_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          updated_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
      RoleRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "operator",
          },
          guard_name: {
            type: "string",
            maxLength: 255,
            default: "web",
            example: "web",
          },
        },
      },
      RoleUpdateRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "operator",
          },
          guard_name: {
            type: "string",
            maxLength: 255,
            example: "web",
          },
        },
      },
      RoleResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            $ref: "#/components/schemas/Role",
          },
        },
      },
      RolesResponse: {
        type: "object",
        required: ["data", "count", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Role",
            },
          },
          count: {
            type: "integer",
            example: 2,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
        },
      },
      Permission: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          name: {
            type: "string",
            example: "list companies",
          },
          guard_name: {
            type: "string",
            example: "web",
          },
          created_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          updated_at: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
        },
      },
      PermissionRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "view companies",
          },
          guard_name: {
            type: "string",
            maxLength: 255,
            default: "web",
            example: "web",
          },
        },
      },
      PermissionUpdateRequest: {
        type: "object",
        properties: {
          name: {
            type: "string",
            maxLength: 255,
            example: "view companies",
          },
          guard_name: {
            type: "string",
            maxLength: 255,
            example: "web",
          },
        },
      },
      PermissionResponse: {
        type: "object",
        required: ["data"],
        properties: {
          data: {
            $ref: "#/components/schemas/Permission",
          },
        },
      },
      PermissionsResponse: {
        type: "object",
        required: ["data", "count", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Permission",
            },
          },
          count: {
            type: "integer",
            example: 25,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
        },
      },
      RolePermissionsRequest: {
        type: "object",
        required: ["permission_ids"],
        properties: {
          permission_ids: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
            },
            example: [6, 7, 8],
          },
        },
      },
      UserAccessListItem: {
        type: "object",
        properties: {
          user_id: {
            type: "integer",
            format: "int64",
            example: 2,
          },
          user_name: {
            type: "string",
            example: "Example User",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          role_id: {
            type: "integer",
            format: "int64",
            nullable: true,
            example: 2,
          },
          role_name: {
            type: "string",
            nullable: true,
            example: "user",
          },
        },
      },
      UserAccessesResponse: {
        type: "object",
        required: ["data", "count", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/UserAccessListItem",
            },
          },
          count: {
            type: "integer",
            example: 2,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
        },
      },
      UserAccessResponse: {
        type: "object",
        required: ["user_id", "roles", "direct_permissions", "effective"],
        properties: {
          user_id: {
            type: "integer",
            format: "int64",
            example: 2,
          },
          roles: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Role",
            },
          },
          direct_permissions: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Permission",
            },
          },
          effective: {
            $ref: "#/components/schemas/AccessResponse",
          },
        },
      },
      UserRolesRequest: {
        type: "object",
        required: ["role_ids"],
        properties: {
          role_ids: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
            },
            example: [1, 2],
          },
        },
      },
      UserPermissionsRequest: {
        type: "object",
        required: ["permission_ids"],
        properties: {
          permission_ids: {
            type: "array",
            items: {
              type: "integer",
              minimum: 1,
            },
            example: [6, 7],
          },
        },
      },
      LogEntry: {
        type: "object",
        required: ["id", "level", "time", "status"],
        properties: {
          id: { type: "string", example: "2f65979c56e15f336e68a47a" },
          level: { type: "string", example: "info" },
          time: { type: "string", format: "date-time" },
          service: { type: "string", nullable: true, example: "pkl-api" },
          env: { type: "string", nullable: true, example: "development" },
          trace_id: { type: "string", nullable: true, example: "tx-ci-health" },
          method: { type: "string", nullable: true, example: "GET" },
          path: { type: "string", nullable: true, example: "/api/health" },
          ip: { type: "string", nullable: true, example: "127.0.0.1" },
          user_agent: { type: "string", nullable: true, example: "Mozilla/5.0" },
          status: { type: "string", enum: ["success", "failed"] },
          status_code: { type: "integer", nullable: true, example: 200 },
          latency_ms: { type: "number", nullable: true, example: 25 },
          error_source: { type: "string", nullable: true, example: "application" },
          error_code: { type: "string", nullable: true, example: "Error" },
          error_message: { type: "string", nullable: true, example: "authentication required" },
          message: { type: "string", nullable: true, example: "request_completed" },
        },
      },
      LogsResponse: {
        type: "object",
        required: ["data", "count", "total", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/LogEntry" },
          },
          count: { type: "integer", example: 10 },
          total: { type: "integer", example: 78 },
          limit: { type: "integer", example: 10 },
          offset: { type: "integer", example: 0 },
          has_more: { type: "boolean", example: true },
        },
      },
      Station: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          kode_station: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "ST001",
          },
          station_name: {
            type: "string",
            nullable: true,
            maxLength: 255,
            example: "Station Name",
          },
          station_type: {
            type: "string",
            nullable: true,
            maxLength: 50,
            example: "FLOW_MQTT",
          },
          table_data: {
            type: "string",
            nullable: true,
            maxLength: 100,
            example: "tb_flow_lamongan",
          },
        },
      },
      StationsResponse: {
        type: "object",
        required: ["data", "count", "limit", "offset", "has_more"],
        properties: {
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/Station",
            },
          },
          count: {
            type: "integer",
            example: 10,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
        },
      },
      FlowStationData: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "integer",
            format: "int64",
            example: 1,
          },
          nama_station: {
            type: "string",
            nullable: true,
            example: "Flowmeter Lamongan",
          },
          datetime: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          flow_1: {
            type: "number",
            nullable: true,
            example: 12.34,
          },
          flow_2: {
            type: "number",
            nullable: true,
            example: 12.34,
          },
          totalizer_1: {
            type: "number",
            nullable: true,
            example: 12345.67,
          },
          totalizer_2: {
            type: "number",
            nullable: true,
            example: 12345.67,
          },
          vcc: {
            type: "number",
            nullable: true,
            example: 12.1,
          },
          logger_temp: {
            type: "number",
            nullable: true,
            example: 31.5,
          },
          logger_humid: {
            type: "number",
            nullable: true,
            example: 72.4,
          },
        },
      },
      FlowStationDataResponse: {
        type: "object",
        required: ["station", "data", "count", "limit", "offset", "has_more", "mode"],
        properties: {
          station: {
            $ref: "#/components/schemas/Station",
          },
          data: {
            type: "array",
            items: {
              $ref: "#/components/schemas/FlowStationData",
            },
          },
          count: {
            type: "integer",
            example: 100,
          },
          limit: {
            type: "integer",
            example: 100,
          },
          offset: {
            type: "integer",
            example: 0,
          },
          has_more: {
            type: "boolean",
            example: false,
          },
          mode: {
            type: "string",
            example: "latest",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error", "code"],
        properties: {
          error: {
            type: "string",
            example: "Error message",
          },
          code: {
            type: "string",
            example: "ERROR_CODE",
          },
          requestId: {
            deprecated: true,
            type: "string",
            example: "2f1872db-193b-4439-8bd3-1fb4656f1e1c",
          },
          trace_id: {
            type: "string",
            example: "tx-2f1872db-193b-4439-8bd3-1fb4656f1e1c",
          },
        },
      },
    },
  },
};
