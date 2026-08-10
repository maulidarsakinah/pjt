import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './AdminSidebar.css';

const adminNavItems = [
  { to: "/admin", end: true, icon: "fa-border-all", label: "Dashboard" },
  { to: "/admin/monitoring", icon: "fa-satellite-dish", label: "Monitoring" },
  { to: "/admin/master-data", icon: "fa-database", label: "Master Data" },
  { to: "/admin/master-alat", icon: "fa-microchip", label: "Master Alat" },
  { to: "/admin/master-account", icon: "fa-users-gear", label: "Master Akun" },

  { to: "/admin/audit-log", icon: "fa-clock-rotate-left", label: "Audit Log" },
  { to: "/admin/settings", icon: "fa-gear", label: "Pengaturan" },
];

const AdminSidebar = ({ openLogoutModal }) => {
  const location = useLocation();

  return (
    <aside className="sidebar admin-sidebar">
    <div className="logo-container admin-logo-container">
      <div className="logo-mark">
        <img
          className="logo-image"
          src="/logo-hydrotrack.svg"
          alt="HydroTrack logo"
        />
      </div>
      <div className="logo-copy">
        <div className="logo-title">HydroTrack</div>
        <div className="logo-subtitle">Enterprise IoT Admin</div>
      </div>
    </div>

    <ul className="nav-menu admin-nav-menu">
      {adminNavItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => {
            let isDetailActive = false;
            if (item.to === '/admin/monitoring' && location.pathname.startsWith('/admin/detail/')) {
              isDetailActive = true;
            }
            return `nav-item ${isActive || isDetailActive ? 'active' : ''}`;
          }}
        >
          <i className={`fa-solid ${item.icon}`}></i> {item.label}
        </NavLink>
      ))}

      <div className="nav-spacer"></div>

      <div className="nav-item text-danger" onClick={openLogoutModal}>
        <i className="fa-solid fa-arrow-right-from-bracket"></i> Keluar
      </div>
    </ul>
  </aside>
  );
};

export default memo(AdminSidebar);
