import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import DatasetsPage from './features/datasets/DatasetsPage';
import ImportDatasetPage from './features/datasets/ImportDatasetPage';
import DatasetExplorePage from './features/datasets/DatasetExplorePage';

// P1 Pages (Auth & Admin)
import { HomePage } from './features/home/HomePage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ProfilePage } from './features/auth/ProfilePage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';

// P4 Pages (Dashboards & Partage)
import {
  DashboardsListPage,
  DashboardViewPage,
  DashboardEditorPage,
  MyAnalysesPage,
  SharedWithMePage,
  PublicDashboardPage,
} from './features/dashboards';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />

          <main style={{ flex: 1 }}>
            <Routes>
              {/* Routes Publiques */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/public/dashboards/:token" element={<PublicDashboardPage />} />

              {/* Routes Protégées (Tout utilisateur authentifié) */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/datasets" element={<ProtectedRoute><DatasetsPage /></ProtectedRoute>} />
              <Route path="/datasets/import" element={<ProtectedRoute><ImportDatasetPage /></ProtectedRoute>} />
              <Route path="/datasets/:id" element={<ProtectedRoute><DatasetExplorePage /></ProtectedRoute>} />
              <Route
                path="/dashboards"
                element={
                  <ProtectedRoute>
                    <DashboardsListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboards/:id"
                element={
                  <ProtectedRoute>
                    <DashboardViewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboards/:id/edit"
                element={
                  <ProtectedRoute>
                    <DashboardEditorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mes-analyses"
                element={
                  <ProtectedRoute>
                    <MyAnalysesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analyses"
                element={
                  <ProtectedRoute>
                    <MyAnalysesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/partages"
                element={
                  <ProtectedRoute>
                    <SharedWithMePage />
                  </ProtectedRoute>
                }
              />

              {/* Route Protégée Exclusive : Rôle Administrateur (P1) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Redirection par défaut */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

