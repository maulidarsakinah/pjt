import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  const confirmLogout = async () => {
    await logout();
    closeLogoutModal();
    navigate('/login', { replace: true });
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const location = useLocation();
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="main-layout-container">
      <div className={`sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar openLogoutModal={openLogoutModal} />
      </div>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <main className="main-content">
        <Topbar toggleSidebar={toggleSidebar} openLogoutModal={openLogoutModal} />
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
