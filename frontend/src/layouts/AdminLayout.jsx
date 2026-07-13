import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import LogoutModal from '../components/LogoutModal';
import Topbar from '../components/Topbar';
import useAuth from '../contexts/useAuth';
import './MainLayout.css';

const AdminLayout = () => {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const openLogoutModal = () => setIsLogoutModalOpen(true);
  const closeLogoutModal = () => setIsLogoutModalOpen(false);
  const confirmLogout = () => {
    logout();
    closeLogoutModal();
    navigate('/login', { replace: true });
  };

  return (
    <div className="main-layout-container">
      <div className={`sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
        <AdminSidebar openLogoutModal={openLogoutModal} />
      </div>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

      <main className="main-content">
        <Topbar toggleSidebar={() => setIsSidebarOpen((value) => !value)} />
        <Outlet />
      </main>

      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={closeLogoutModal}
        onConfirm={confirmLogout}
      />
    </div>
  );
};

export default AdminLayout;
