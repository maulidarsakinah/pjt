const assert = require("assert/strict");
const {
  buildFieldChanges,
  buildMutationMetadata,
} = require("../src/services/audit");

function main() {
  const body = {
    status: "completed",
    category: "operations",
    quantity: 4,
    item_id: 81,
    permission_ids: [2, 3],
    password: "must-never-appear",
    token: "must-never-appear",
    phone: "+62123456789",
    address: "must-never-appear",
  };
  const mutation = buildMutationMetadata({
    method: "PATCH",
    originalUrl: "/api/items/81?source=test",
    params: { id: "81" },
    body,
  });

  assert.deepEqual(mutation.fields_touched, Object.keys(body).sort());
  assert.equal(mutation.payload_bytes, Buffer.byteLength(JSON.stringify(body)));
  assert.deepEqual(mutation.target, { type: "items", id: "81" });
  assert.deepEqual(mutation.safe_values, {
    category: "operations",
    item_id: 81,
    permission_ids: [2, 3],
    quantity: 4,
    status: "completed",
  });
  assert.equal(JSON.stringify(mutation).includes("must-never-appear"), false);
  assert.equal(JSON.stringify(mutation).includes("+62123456789"), false);
  assert.equal(
    buildMutationMetadata({
      method: "POST",
      originalUrl: "/api/items",
      headers: { "content-length": "2048" },
      body: { status: "active" },
    }).payload_bytes,
    2048,
  );

  const changes = buildFieldChanges(
    { status: "pending", phone: "old", role_ids: [1] },
    { status: "completed", phone: "new", role_ids: [1, 2] },
    ["status", "phone", "role_ids"],
    { targetType: "user" },
  );

  assert.deepEqual(changes.status, { from: "pending", to: "completed" });
  assert.deepEqual(changes.role_ids, { from: [1], to: [1, 2] });
  assert.deepEqual(changes.phone, { changed: true, value_logged: false });
  assert.equal(JSON.stringify(changes).includes("old"), false);
  assert.equal(buildMutationMetadata({ method: "GET" }), undefined);

  console.log("Audit service tests passed");
}

main();
