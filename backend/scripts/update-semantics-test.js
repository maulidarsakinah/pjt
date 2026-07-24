const assert = require("assert/strict");
const { validateCompanyPayload } = require("../src/services/companies");
const { validatePermissionPayload } = require("../src/services/permissions");
const { validateRolePayload } = require("../src/services/roles");
const { buildFlowStationDataResponse } = require("../src/services/stations");

function testPutAndPatchValidation() {
  assert.deepEqual(validateCompanyPayload({ name: "Acme" }), {
    name: "Acme",
    address: null,
    contact: null,
  });
  assert.deepEqual(
    validateCompanyPayload({ address: "Bandung" }, { partial: true }),
    {
      address: "Bandung",
    },
  );
  assert.throws(
    () => validateCompanyPayload({ address: "Bandung" }),
    /name is required/,
  );

  assert.deepEqual(validateRolePayload({ name: "operator" }), {
    name: "operator",
    guard_name: "web",
  });
  assert.deepEqual(
    validateRolePayload({ guard_name: "api" }, { partial: true }),
    {
      guard_name: "api",
    },
  );
  assert.throws(
    () => validateRolePayload({ guard_name: "api" }),
    /name is required/,
  );

  assert.deepEqual(validatePermissionPayload({ name: "view stations" }), {
    name: "view stations",
    guard_name: "web",
  });
  assert.deepEqual(
    validatePermissionPayload({ guard_name: "api" }, { partial: true }),
    {
      guard_name: "api",
    },
  );
  assert.throws(
    () => validatePermissionPayload({ guard_name: "api" }),
    /name is required/,
  );
}

function testLatestHasMore() {
  const station = { id: 1 };
  const page = {
    data: [{ id: 10 }],
    count: 1,
    limit: 1,
    offset: 0,
    has_more: true,
  };

  assert.equal(
    buildFlowStationDataResponse(station, page, "latest").has_more,
    false,
  );
  assert.equal(
    buildFlowStationDataResponse(station, page, "today").has_more,
    true,
  );
}

testPutAndPatchValidation();
testLatestHasMore();
console.log("Update semantics tests passed");
