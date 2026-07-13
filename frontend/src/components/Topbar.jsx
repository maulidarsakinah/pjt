import { useLocation } from 'react-router-dom';
import useAuth from '../contexts/useAuth';
import './Topbar.css';

const Topbar = ({ toggleSidebar }) => {
  const location = useLocation();
  const { user } = useAuth();
  const displayName = user?.name || 'Operator';
  const companyName = user?.company?.name || user?.company_name || 'Company';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'OP';
  
  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/dashboard':
        return <span>Dashboard</span>;
      case '/dashboard/monitoring':
        return (
          <>
            Dashboard <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Monitoring</span>
          </>
        );
      case '/dashboard/settings':
        return (
          <>
            Dashboard <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Pengaturan</span>
          </>
        );
      case '/admin':
        return <span>Admin Dashboard</span>;
      case '/admin/monitoring':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Monitoring</span>
          </>
        );
      case '/admin/master-account':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Master Akun</span>
          </>
        );
      case '/admin/master-data':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Master Data</span>
          </>
        );
      case '/admin/master-alat':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Master Alat</span>
          </>
        );
      case '/admin/reports':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Laporan</span>
          </>
        );
      case '/admin/audit-log':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Audit Log</span>
          </>
        );
      case '/admin/settings':
        return (
          <>
            Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Pengaturan</span>
          </>
        );
      default:
        if (location.pathname.startsWith('/dashboard/detail')) {
          return (
            <>
              Dashboard <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Detail Stasiun</span>
            </>
          );
        }
        if (location.pathname.startsWith('/admin/detail')) {
          return (
            <>
              Admin <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', margin: '0 8px', color: '#cbd5e1' }}></i> <span>Detail Stasiun</span>
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
        <img className="topbar-logo" src="/logo-hydrotrack.svg" alt="HydroTrack" />
        <div className="topbar-copy">
          <span className="topbar-app-name">HydroTrack Control Center</span>
          <div className="breadcrumb">
            {getBreadcrumb()}
          </div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="user-dropdown">
          <div className="user-info">
            <span className="user-role">{companyName}</span>
            <span className="user-name">{displayName}</span>
          </div>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;


