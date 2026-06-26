import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import UpdateNotification from './components/UpdateNotification';
import { initPushNotifications } from './utils/mobileNotifications';

// Lazy load heavy pages for faster initial load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Reports = lazy(() => import('./pages/Reports'));
const QuickReport = lazy(() => import('./pages/QuickReport'));
const Settings = lazy(() => import('./pages/Settings'));
const TestManagement = lazy(() => import('./pages/TestManagement'));
const ReportLayoutSettings = lazy(() => import('./pages/ReportLayoutSettings'));
const StaffManagement = lazy(() => import('./pages/StaffManagement'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="patients" element={<Patients />} />
          <Route path="reports" element={<Reports />} />
          <Route path="quick-report" element={<QuickReport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="test-management" element={<TestManagement />} />
          <Route path="report-layout" element={<ReportLayoutSettings />} />
          <Route path="staff-management" element={<StaffManagement />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    initPushNotifications();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <UpdateNotification />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
