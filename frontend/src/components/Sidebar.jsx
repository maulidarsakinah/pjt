import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ openLogoutModal }) => {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <img
          className="sidebar-logo-img"
          src="/Logo PJT.png"
          alt="Logo Jasa Tirta I"
        />
        <span className="sidebar-logo-text">JASA TIRTA I</span>
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
