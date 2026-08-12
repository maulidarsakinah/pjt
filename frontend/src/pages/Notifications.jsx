import { useCallback, useEffect, useState } from "react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/api";
import "./Notifications.css";

function formatRelativeTime(dateString) {
  if (!dateString) return "Baru saja";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari yang lalu`;
}

function getIconForCategory(category, type) {
  if (category === "master_alat") return "fa-microchip";
  if (category === "monitoring_offline" || category === "device_offline") return "fa-power-off";
  if (category === "threshold_alert") return "fa-water";
  if (type === "critical") return "fa-triangle-exclamation";
  return "fa-bell";
}

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = {};
      if (filterCategory) query.category = filterCategory;
      if (filterUnreadOnly) query.is_read = "0";

      const res = await getNotifications(query);
      if (res && Array.isArray(res.data)) {
        setNotifications(res.data);
        setUnreadCount(res.unread_count ?? 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Gagal memuat notifikasi dari server: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterUnreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMarkAsRead = async (notif) => {
    if (notif.is_read) return;
    try {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="notifications-title">
          <h1>Notifikasi Sistem</h1>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} belum dibaca</span>
          )}
        </div>
        <button
          className="btn btn-outline"
          onClick={handleMarkAllAsRead}
          disabled={loading || unreadCount === 0}
        >
          <i className="fa-solid fa-check-double"></i> Tandai Semua Dibaca
        </button>
      </div>

      {/* Filter Tabs */}
      <div
        className="notification-filters"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`btn ${!filterCategory && !filterUnreadOnly ? "btn-primary" : "btn-outline"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() => {
            setFilterCategory("");
            setFilterUnreadOnly(false);
          }}
        >
          Semua
        </button>
        <button
          className={`btn ${filterUnreadOnly ? "btn-primary" : "btn-outline"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() => setFilterUnreadOnly((prev) => !prev)}
        >
          Belum Dibaca
        </button>
        <button
          className={`btn ${filterCategory === "master_alat" ? "btn-primary" : "btn-outline"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() =>
            setFilterCategory((prev) =>
              prev === "master_alat" ? "" : "master_alat",
            )
          }
        >
          Master Alat
        </button>
        <button
          className={`btn ${filterCategory === "threshold_alert" ? "btn-primary" : "btn-outline"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() =>
            setFilterCategory((prev) =>
              prev === "threshold_alert" ? "" : "threshold_alert",
            )
          }
        >
          Threshold Alerts
        </button>
        <button
          className={`btn ${filterCategory === "monitoring_offline" ? "btn-primary" : "btn-outline"}`}
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() =>
            setFilterCategory((prev) =>
              prev === "monitoring_offline" ? "" : "monitoring_offline",
            )
          }
        >
          Pemantauan Offline
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "14px",
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="notifications-list">
        {loading ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            <i
              className="fa-solid fa-spinner fa-spin"
              style={{ marginRight: "8px" }}
            />
            Memuat notifikasi...
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <i className="fa-regular fa-bell-slash"></i>
            <h3>Tidak ada notifikasi</h3>
            <p>Sistem berjalan normal tanpa anomali.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`notification-card ${notif.type || "info"} ${!notif.is_read ? "unread" : ""}`}
              onClick={() => handleMarkAsRead(notif)}
              style={{ cursor: "pointer" }}
            >
              <div className="notification-icon">
                <i
                  className={`fa-solid ${getIconForCategory(notif.category, notif.type)}`}
                ></i>
              </div>
              <div className="notification-content">
                <div className="notification-top">
                  <h3>{notif.title}</h3>
                  <span className="notification-time">
                    {formatRelativeTime(notif.created_at)}
                  </span>
                </div>
                <p className="notification-message">{notif.message}</p>
              </div>
              {!notif.is_read && <div className="unread-dot"></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
