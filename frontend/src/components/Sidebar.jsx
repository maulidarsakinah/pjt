import { memo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import useAuth from "../contexts/useAuth";
import { has_permission } from "../utils/permission_utils";
import "./Sidebar.css";

const nav_items = [
  { to: "/dashboard", end: true, icon: "fa-border-all", label: "Dashboard" },
  {
    to: "/dashboard/monitoring",
    icon: "fa-satellite-dish",
    label: "Monitoring",
  },
  {
    to: "/dashboard/master-data",
    icon: "fa-database",
    label: "Master Data",
    permission: "view stations",
  },
  {
    to: "/dashboard/master-alat",
    icon: "fa-microchip",
    label: "Master Alat",
    permission: "view stations",
  },
  {
    to: "/dashboard/master-account",
    icon: "fa-users-gear",
    label: "Master Akun",
    permission: ["list users", "list roles", "list permissions"],
  },
  {
    to: "/dashboard/audit-log",
    icon: "fa-clock-rotate-left",
    label: "Audit Log",
    permission: "view logs",
  },
  { to: "/dashboard/settings", icon: "fa-gear", label: "Pengaturan" },
];

const Sidebar = ({ openLogoutModal }) => {
  const location = useLocation();
  const { user } = useAuth();

  const filtered_nav_items = nav_items.filter((item) =>
    has_permission(user, item.permission),
  );

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
        {filtered_nav_items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => {
              let isDetailActive = false;
              if (
                item.to === "/dashboard/monitoring" &&
                location.pathname.startsWith("/dashboard/detail/")
              ) {
                isDetailActive = true;
              }
              return `nav-item ${isActive || isDetailActive ? "active" : ""}`;
            }}
          >
            <i className={`fa-solid ${item.icon}`}></i> {item.label}
          </NavLink>
        ))}

        <div className="nav-spacer"></div>

        <div className="nav-item text-danger" onClick={openLogoutModal}>
          <i className="fa-solid fa-arrow-right-from-bracket"></i> Keluar Sistem
        </div>
      </ul>
    </aside>
  );
};

export default memo(Sidebar);
