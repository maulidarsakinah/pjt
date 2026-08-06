import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/Login";
import { AuthProvider } from "./contexts/AuthProvider";
import useAuth from "./contexts/useAuth";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { DetailSkeleton, MonitoringSkeleton } from "./components/PageSkeletons";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const Detail = lazy(() => import("./pages/Detail"));
const Settings = lazy(() => import("./pages/Settings"));
const MasterAccount = lazy(() => import("./pages/MasterAccount"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const MasterData = lazy(() => import("./pages/MasterData"));
const AdminPlaceholder = lazy(() => import("./pages/AdminPlaceholder"));

const PageFallback = () => {
  const { pathname } = useLocation();

  if (pathname.includes("/monitoring")) {
    return <MonitoringSkeleton />;
  }

  if (pathname.includes("/detail/")) {
    return <DetailSkeleton />;
  }

  return <DashboardSkeleton />;
};

function isAdminUser(user) {
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.role_name,
  ]
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());

  return (
    roles.includes("admin") ||
    roles.includes("administrator") ||
    roles.includes("super-admin")
  );
}

const ProtectedRoute = ({ layout, requireAdmin = false }) => {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return <PageFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdminUser(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return layout || <MainLayout />;
};

const RootRedirect = () => {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return <PageFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={isAdminUser(user) ? "/admin" : "/dashboard"} replace />;
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
              <Route path="detail/:stationKey" element={<Detail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route
              path="/admin"
              element={<ProtectedRoute layout={<AdminLayout />} requireAdmin />}
            >
              <Route index element={<Dashboard />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="detail/:stationKey" element={<Detail />} />
              <Route path="master-account" element={<MasterAccount />} />
              <Route path="settings" element={<Settings />} />
              <Route path="master-data" element={<MasterData />} />
              <Route
                path="master-alat"
                element={
                  <AdminPlaceholder title="Master Alat" icon="fa-microchip" />
                }
              />

              <Route path="audit-log" element={<AuditLog />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
