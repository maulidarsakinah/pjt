import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import LogoutModal from '../components/LogoutModal';
import useAuth from '../contexts/useAuth';
import './MainLayout.css';

const MainLayout = () => {
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

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="main-layout-container">
      <div className={`sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar openLogoutModal={openLogoutModal} />
      </div>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <main className="main-content">
        <Topbar toggleSidebar={toggleSidebar} />
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

export default MainLayout;
