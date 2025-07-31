import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/admin/ClientsPage';
import AdSitesPage from './pages/admin/AdSitesPage';
import AdvertisementsPage from './pages/admin/AdvertisementsPage';
import WordPressPage from './pages/admin/WordPressPage';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route
            path="admin/clients"
            element={
              <ProtectedRoute requireAdmin>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/adsites"
            element={
              <ProtectedRoute requireAdmin>
                <AdSitesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/advertisements"
            element={
              <ProtectedRoute requireAdmin>
                <AdvertisementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/wordpress"
            element={
              <ProtectedRoute requireAdmin>
                <WordPressPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
