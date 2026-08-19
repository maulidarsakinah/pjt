import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../contexts/useAuth";
import { getNotificationSummary } from "../services/api";
import "./Topbar.css";

const Topbar = ({ toggleSidebar, openLogoutModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const accountRef = useRef(null);
  const displayName = user?.name || "Operator";
  const companyName = user?.company?.name || user?.company_name || "Company";
  const roleText =
    user?.role || user?.role_name || user?.roles?.join(", ") || "Operator";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "OP";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setIsAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        const res = await getNotificationSummary();
        if (isMounted && res && res.data) {
          setUnreadCount(res.data.unread_count ?? 0);
        }
      } catch (_err) {
        // silent fallback
      }
    };
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleExit = () => {
    setIsAccountOpen(false);
    openLogoutModal?.();
  };

  const handleNotificationClick = () => {
    if (location.pathname.startsWith("/admin")) {
      navigate("/admin/notifications");
    } else {
      navigate("/dashboard/notifications");
    }
  };

  const getBreadcrumb = () => {
    switch (location.pathname) {
      case "/dashboard":
        return <span>Dashboard</span>;
      case "/dashboard/monitoring":
        return (
          <>
            Dashboard{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Monitoring</span>
          </>
        );
      case "/dashboard/notifications":
        return (
          <>
            Dashboard{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Notifikasi</span>
          </>
        );
      case "/dashboard/settings":
        return (
          <>
            Dashboard{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Pengaturan</span>
          </>
        );
      case "/admin":
        return <span>Admin Dashboard</span>;
      case "/admin/monitoring":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Monitoring</span>
          </>
        );
      case "/admin/notifications":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Notifikasi</span>
          </>
        );
      case "/admin/master-account":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Master Akun</span>
          </>
        );
      case "/admin/master-data":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Master Data</span>
          </>
        );
      case "/admin/master-alat":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Master Alat</span>
          </>
        );
      case "/admin/reports":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Laporan</span>
          </>
        );
      case "/admin/audit-log":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Audit Log</span>
          </>
        );
      case "/admin/settings":
        return (
          <>
            Admin{" "}
            <i
              className="fa-solid fa-chevron-right"
              style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
            ></i>{" "}
            <span>Pengaturan</span>
          </>
        );
      default:
        if (location.pathname.startsWith("/dashboard/detail")) {
          return (
            <>
              Dashboard{" "}
              <i
                className="fa-solid fa-chevron-right"
                style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
              ></i>{" "}
              <span>Detail Stasiun</span>
            </>
          );
        }
        if (location.pathname.startsWith("/admin/detail")) {
          return (
            <>
              Admin{" "}
              <i
                className="fa-solid fa-chevron-right"
                style={{ fontSize: "10px", margin: "0 8px", color: "#cbd5e1" }}
              ></i>{" "}
              <span>Detail Stasiun</span>
            </>
          );
        }
        return <span>Dashboard</span>;
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={toggleSidebar}>
          <i className="fa-solid fa-bars"></i>
        </button>
        <img
          className="topbar-logo"
          src="/Logo PJT.png"
          alt="Jasa Tirta 1"
        />
        <div className="topbar-copy">
          <span className="topbar-app-name">Jasa Tirta 1 Control Center</span>
          <div className="breadcrumb">{getBreadcrumb()}</div>
        </div>
      </div>
      <div className="topbar-right">
        <button 
          className="topbar-notification-btn" 
          title="Notifikasi" 
          type="button"
          onClick={handleNotificationClick}
        >
          <i className="fa-regular fa-bell"></i>
          {unreadCount > 0 && (
            <span className="topbar-notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </button>
        <div className="account-menu" ref={accountRef}>
          <button
            className={`user-dropdown ${isAccountOpen ? "active" : ""}`}
            type="button"
            onClick={() => setIsAccountOpen((value) => !value)}
            aria-expanded={isAccountOpen}
            aria-haspopup="menu"
          >
            <div className="user-info">
              <span className="user-role">{companyName}</span>
              <span className="user-name">{displayName}</span>
            </div>
            <div className="user-avatar">{initials}</div>
          </button>

          {isAccountOpen && (
            <div className="account-dropdown-panel" role="menu">
              <div className="account-dropdown-header">
                <div className="account-dropdown-avatar">{initials}</div>
                <div className="account-dropdown-identity">
                  <strong>{displayName}</strong>
                  <span>{user?.email || "Email belum tersedia"}</span>
                </div>
              </div>

              <div className="account-dropdown-info">
                <span>Role</span>
                <strong>{roleText}</strong>
              </div>
              <div className="account-dropdown-info">
                <span>Perusahaan</span>
                <strong>{companyName}</strong>
              </div>

              <button
                className="account-exit-button"
                type="button"
                onClick={handleExit}
                role="menuitem"
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
