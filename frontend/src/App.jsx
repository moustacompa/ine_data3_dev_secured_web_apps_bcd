import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import AppShell from './components/layout/AppShell';

// P1 Pages (Auth & Admin)
import { HomePage } from './features/home/HomePage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ProfilePage } from './features/auth/ProfilePage';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';

// P2 Pages (Import & Exploration des datasets)
import DatasetsPage from './features/datasets/DatasetsPage';
import ImportDatasetPage from './features/datasets/ImportDatasetPage';
import DatasetExplorePage from './features/datasets/DatasetExplorePage';

// P4 Pages (Dashboards & Partage)
import {
  DashboardsListPage,
  DashboardViewPage,
  DashboardEditorPage,
  MyAnalysesPage,
  SharedWithMePage,
  PublicDashboardPage,
} from './features/dashboards';

// P3 Page (Analyse & Visualisation)
import { AnalysisPage } from './features/analytics';

// Pages publiques : barre de navigation du site (accueil, connexion…)
function PublicLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes Publiques */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/public/dashboards/:token" element={<PublicDashboardPage />} />
          </Route>

          {/* Routes Protégées (Tout utilisateur authentifié) : espace de travail avec barre latérale */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/datasets/import" element={<ImportDatasetPage />} />
            <Route path="/datasets/:id" element={<DatasetExplorePage />} />
            <Route path="/dashboards" element={<DashboardsListPage />} />
            <Route path="/dashboards/:id" element={<DashboardViewPage />} />
            <Route path="/dashboards/:id/edit" element={<DashboardEditorPage />} />
            <Route path="/mes-analyses" element={<MyAnalysesPage />} />
            <Route path="/analyses" element={<MyAnalysesPage />} />
            <Route path="/analyse" element={<AnalysisPage />} />
            <Route path="/partages" element={<SharedWithMePage />} />

            {/* Route Protégée Exclusive : Rôle Administrateur (P1) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
