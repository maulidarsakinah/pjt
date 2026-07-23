import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import { AuthProvider } from './contexts/AuthProvider';
import useAuth from './contexts/useAuth';
import DashboardSkeleton from './components/DashboardSkeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Monitoring = lazy(() => import('./pages/Monitoring'));
const Detail = lazy(() => import('./pages/Detail'));
const Settings = lazy(() => import('./pages/Settings'));
const MasterAccount = lazy(() => import('./pages/MasterAccount'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const AdminPlaceholder = lazy(() => import('./pages/AdminPlaceholder'));

const PageFallback = () => <DashboardSkeleton />;

function isAdminUser(user) {
  const roleText = [
    user?.role,
    user?.roles?.join(' '),
    user?.role_name,
  ].filter(Boolean).join(' ').toLowerCase();

  return roleText.includes('admin') || roleText.includes('administrator');
}

const ProtectedRoute = ({ layout, requireAdmin = false }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdminUser(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return layout || <MainLayout />;
};

const RootRedirect = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={isAdminUser(user) ? '/admin' : '/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute />}>
              <Route index element={<Dashboard />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="detail/:id" element={<Detail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/admin" element={<ProtectedRoute layout={<AdminLayout />} requireAdmin />}>
              <Route index element={<Dashboard />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="detail/:id" element={<Detail />} />
              <Route path="master-account" element={<MasterAccount />} />
              <Route path="settings" element={<Settings />} />
              <Route path="master-data" element={<AdminPlaceholder title="Master Data" icon="fa-database" />} />
              <Route path="master-alat" element={<AdminPlaceholder title="Master Alat" icon="fa-microchip" />} />
              <Route path="reports" element={<AdminPlaceholder title="Laporan" icon="fa-file-lines" />} />
              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
