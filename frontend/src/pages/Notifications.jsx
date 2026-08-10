import { useMemo, useState } from "react";
import "./Notifications.css";

const DUMMY_NOTIFICATIONS = [
  {
    id: 1,
    type: "critical", // critical, warning, info
    title: "Debit Air Melonjak Tajam",
    message: "Debit air di stasiun PJT-FLOW-LMG (Lamongan) melonjak tajam melebihi batas aman. Tercatat: 152 m³/s.",
    time: "Baru saja",
    read: false,
    icon: "fa-water"
  },
  {
    id: 2,
    type: "warning",
    title: "Latensi Sistem Tinggi",
    message: "Latensi tinggi terdeteksi pada Audit Log. Tercatat: 850ms pada endpoint /api/stations. Kinerja sistem mungkin terganggu.",
    time: "10 menit yang lalu",
    read: false,
    icon: "fa-server"
  },
  {
    id: 3,
    type: "warning",
    title: "Tegangan VCC Menurun Kritis",
    message: "Tegangan catu daya (VCC) pada stasiun PJT-FLOW-BBT (Babat Hilir) turun di bawah normal. Tercatat: 11.2V.",
    time: "1 jam yang lalu",
    read: true,
    icon: "fa-car-battery"
  },
  {
    id: 4,
    type: "critical",
    title: "Fluktuasi Sensor Tidak Wajar",
    message: "Pembacaan sensor Water Level di stasiun PJT-WL-BJR (Bojonegoro) tidak konsisten dalam 2 jam terakhir (Fluktuasi > 40%).",
    time: "2 jam yang lalu",
    read: true,
    icon: "fa-triangle-exclamation"
  }
];

const Notifications = () => {
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <div className="notifications-title">
          <h1>Notifikasi Sistem</h1>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount} belum dibaca</span>}
        </div>
        <button className="btn btn-outline" onClick={markAllAsRead}>
          <i className="fa-solid fa-check-double"></i> Tandai Semua Dibaca
        </button>
      </div>

      <div className="notifications-list">
        {notifications.map((notif) => (
          <div 
            key={notif.id} 
            className={`notification-card ${notif.type} ${!notif.read ? 'unread' : ''}`}
            onClick={() => markAsRead(notif.id)}
          >
            <div className="notification-icon">
              <i className={`fa-solid ${notif.icon}`}></i>
            </div>
            <div className="notification-content">
              <div className="notification-top">
                <h3>{notif.title}</h3>
                <span className="notification-time">{notif.time}</span>
              </div>
              <p className="notification-message">{notif.message}</p>
            </div>
            {!notif.read && <div className="unread-dot"></div>}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="empty-state">
            <i className="fa-regular fa-bell-slash"></i>
            <h3>Tidak ada notifikasi</h3>
            <p>Sistem berjalan normal tanpa anomali.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
