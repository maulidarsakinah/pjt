const assert = require("node:assert/strict");
const config = require("../src/config");
const {
  dispatch_notification_emails,
  is_smtp_configured,
  send_notification_email,
  verify_smtp_connection,
} = require("../src/services/email_service");

async function run_test_suite() {
  // Test 1: Check SMTP configuration status when credentials are unset
  const initial_smtp_status = is_smtp_configured();
  assert.equal(typeof initial_smtp_status, "boolean");

  // Test 2: Verify connection status when not configured
  const verify_res = await verify_smtp_connection();
  assert.equal(typeof verify_res.configured, "boolean");
  assert.equal(typeof verify_res.message, "string");

  // Test 3: Test send_notification_email gracefully handles unconfigured SMTP
  const mock_notification = {
    type: "critical",
    title: "Test Alert",
    message: "Unit test notification message",
    metric_name: "WATER_LEVEL",
    metric_value: 85.5,
    threshold_limit: 80.0,
    created_at: new Date(),
  };

  const send_res = await send_notification_email(["test@example.com"], mock_notification);
  assert.equal(typeof send_res, "boolean");

  // Test 4: Test dispatch_notification_emails with mock Oracle database connection
  let mock_query_executed = false;
  const mock_connection = {
    async execute(query) {
      if (query.includes('"users"')) {
        mock_query_executed = true;
        return {
          rows: [
            { email: "user1@example.com" },
            { email: "user2@example.com" },
            { email: null },
          ],
        };
      }
      return { rows: [] };
    },
  };

  // Enable test SMTP temporarily
  const original_user = config.smtp.user;
  const original_pass = config.smtp.pass;
  config.smtp.user = "testuser@gmail.com";
  config.smtp.pass = "testpass12345678";

  assert.equal(is_smtp_configured(), true);

  await dispatch_notification_emails(mock_connection, [mock_notification]);
  assert.equal(mock_query_executed, true);

  // Restore original config
  config.smtp.user = original_user;
  config.smtp.pass = original_pass;

  console.log("Email service unit tests passed successfully.");
}

run_test_suite().catch((err) => {
  console.error("Email service test failed:", err);
  process.exit(1);
});
