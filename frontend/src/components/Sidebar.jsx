import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ openLogoutModal }) => {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-mark">
          <img
            className="logo-image"
            src="/logo-hydrotrack.svg"
            alt="HydroTrack logo"
          />
        </div>
        <div className="logo-copy">
          <div className="logo-title">HydroTrack</div>
          <div className="logo-subtitle">Enterprise Water Monitoring</div>
        </div>
      </div>
      <ul className="nav-menu">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <i className="fa-solid fa-border-all"></i> Dashboard
        </NavLink>
        <NavLink 
          to="/dashboard/monitoring" 
          className={({ isActive }) => {
            const isDetailActive = location.pathname.startsWith('/dashboard/detail/');
            return `nav-item ${isActive || isDetailActive ? 'active' : ''}`;
          }}
        >
          <i className="fa-solid fa-satellite-dish"></i> Monitoring
        </NavLink>
        <NavLink
          to="/dashboard/settings"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <i className="fa-solid fa-gear"></i> Pengaturan
        </NavLink>

        <div className="nav-spacer"></div>

        <div className="nav-item text-danger" onClick={openLogoutModal}>
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Keluar Sistem
        </div>
      </ul>
    </aside>
  );
};

export default memo(Sidebar);
