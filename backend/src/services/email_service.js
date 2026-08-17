const nodemailer = require("nodemailer");
const config = require("../config");
const logger = require("../logger");

function create_transporter() {
  const { host, port, secure, user, pass } = config.smtp;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
}

function is_smtp_configured() {
  const { user, pass, enabled } = config.smtp;
  return Boolean(enabled && user && pass);
}

async function verify_smtp_connection() {
  if (!is_smtp_configured()) {
    return {
      configured: false,
      message:
        "SMTP is disabled or credentials (SMTP_USER / SMTP_PASS) are not set in environment.",
    };
  }

  const transporter = create_transporter();
  try {
    await transporter.verify();
    return {
      configured: true,
      success: true,
      message: "Google SMTP connection verified successfully.",
    };
  } catch (error) {
    logger.error(
      { err: error, host: config.smtp.host, port: config.smtp.port },
      "[SMTP Verification Error] Failed to connect to Google SMTP: " +
        error.message,
    );
    return {
      configured: true,
      success: false,
      message: error.message,
    };
  }
}

function build_email_html(notification) {
  const {
    type,
    title,
    message,
    metric_name,
    metric_value,
    threshold_limit,
    created_at,
  } = notification;

  const bg_color =
    type === "critical"
      ? "#fee2e2"
      : type === "warning"
        ? "#ffedd5"
        : "#e0f2fe";
  const border_color =
    type === "critical"
      ? "#ef4444"
      : type === "warning"
        ? "#f97316"
        : "#0284c7";
  const badge_text_color =
    type === "critical"
      ? "#991b1b"
      : type === "warning"
        ? "#9a3412"
        : "#075985";
  const badge_label = (type || "notification").toUpperCase();

  const formatted_date = created_at
    ? new Date(created_at).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      })
    : new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  let metrics_section = "";
  if (metric_name) {
    metrics_section = `
      <div style="margin-top: 16px; padding: 12px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Metric:</td>
            <td style="padding: 4px 0; color: #0f172a; text-align: right;">${metric_name}</td>
          </tr>
          ${
            metric_value !== undefined && metric_value !== null
              ? `<tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Measured Value:</td>
                  <td style="padding: 4px 0; color: #0f172a; text-align: right; font-weight: bold;">${metric_value}</td>
                </tr>`
              : ""
          }
          ${
            threshold_limit !== undefined && threshold_limit !== null
              ? `<tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Threshold Limit:</td>
                  <td style="padding: 4px 0; color: #0f172a; text-align: right;">${threshold_limit}</td>
                </tr>`
              : ""
          }
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #334155;">
      <table style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr>
          <td style="padding: 24px; background-color: #0f172a; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">HydroTrack System Alert</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <div style="display: inline-block; padding: 4px 12px; background-color: ${bg_color}; color: ${badge_text_color}; border: 1px solid ${border_color}; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
              ${badge_label}
            </div>
            <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">${title}</h3>
            <p style="margin: 0 0 16px 0; line-height: 1.6; font-size: 15px; color: #475569;">${message}</p>
            ${metrics_section}
            <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
              Time: ${formatted_date}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background-color: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            This is an automated notification from HydroTrack System. Please do not reply directly to this email.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function send_notification_email(recipients, notification) {
  if (!is_smtp_configured()) {
    logger.info(
      { notification_title: notification.title },
      "[Email Notification Skipped] Google SMTP is not configured or disabled.",
    );
    return false;
  }

  if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
    logger.info(
      { notification_title: notification.title },
      "[Email Notification Skipped] No recipient email addresses provided.",
    );
    return false;
  }

  const recipient_list = Array.isArray(recipients) ? recipients : [recipients];
  const transporter = create_transporter();

  if (!transporter) {
    return false;
  }

  const html_content = build_email_html(notification);
  const text_content = `[HydroTrack ${notification.type ? notification.type.toUpperCase() : "ALERT"}] ${notification.title}\n\n${notification.message}\n\nTime: ${notification.created_at || new Date().toISOString()}`;

  const mail_options = {
    from: config.smtp.from,
    to: recipient_list.join(", "),
    subject: `[HydroTrack Alert] ${notification.title}`,
    text: text_content,
    html: html_content,
  };

  try {
    const info = await transporter.sendMail(mail_options);
    logger.info(
      {
        message_id: info.messageId,
        recipients: recipient_list,
        notification_title: notification.title,
      },
      "[Email Notification Sent] Successfully sent alert email via Google SMTP",
    );
    return true;
  } catch (error) {
    logger.error(
      {
        err: error,
        recipients: recipient_list,
        notification_title: notification.title,
      },
      "[Email Delivery Error] Failed to send notification email: " + error.message,
    );
    return false;
  }
}

async function dispatch_notification_emails(connection, notifications) {
  if (!notifications || notifications.length === 0) return;
  if (!is_smtp_configured()) {
    return;
  }

  try {
    const users_res = await connection.execute(
      `SELECT "email" AS "email"
       FROM "users"
       WHERE "status" = '1'
       AND "email" IS NOT NULL`,
      {},
      { fetchArraySize: 100 },
    );

    const email_set = new Set();
    for (const row of users_res.rows || []) {
      if (row.email && typeof row.email === "string" && row.email.trim()) {
        const clean_email = row.email.trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_email)) {
          email_set.add(clean_email);
        }
      }
    }

    const recipient_emails = Array.from(email_set);
    if (recipient_emails.length === 0) {
      logger.info(
        "[Email Dispatch Skipped] No active users with valid email addresses found.",
      );
      return;
    }

    for (const notif of notifications) {
      await send_notification_email(recipient_emails, notif);
    }
  } catch (error) {
    logger.error(
      { err: error },
      "[Email Dispatch Error] Failed to query user emails or dispatch notifications: " +
        error.message,
    );
  }
}

module.exports = {
  create_transporter,
  dispatch_notification_emails,
  is_smtp_configured,
  send_notification_email,
  verify_smtp_connection,
};
