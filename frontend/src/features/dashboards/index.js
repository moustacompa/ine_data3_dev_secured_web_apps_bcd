/**
 * Feature Dashboards & Partage (P4).
 *
 * Intégration dans App.jsx (React Router v6) :
 *
 *   import { DashboardsListPage, DashboardViewPage, DashboardEditorPage,
 *            MyAnalysesPage, SharedWithMePage, PublicDashboardPage } from './features/dashboards';
 *
 *   <Route path="/public/dashboards/:token" element={<PublicDashboardPage />} />   // hors ProtectedRoute
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboards" element={<DashboardsListPage />} />
 *     <Route path="/dashboards/:id" element={<DashboardViewPage />} />
 *     <Route path="/dashboards/:id/edit" element={<DashboardEditorPage />} />
 *     <Route path="/mes-analyses" element={<MyAnalysesPage />} />
 *     <Route path="/partages" element={<SharedWithMePage />} />
 *   </Route>
 */
import './dashboards.css';

export { default as DashboardsListPage } from './pages/DashboardsListPage';
export { default as DashboardViewPage } from './pages/DashboardViewPage';
export { default as DashboardEditorPage } from './pages/DashboardEditorPage';
export { default as MyAnalysesPage } from './pages/MyAnalysesPage';
export { default as SharedWithMePage } from './pages/SharedWithMePage';
export { default as PublicDashboardPage } from './pages/PublicDashboardPage';

// Réutilisables par P3 (bouton « Enregistrer l'analyse ») et P1 (dashboard admin)
export { analysesApi, dashboardsApi } from './api/dashboardsApi';
export { default as ShareDialog } from './components/ShareDialog';
export { default as OutlierView } from './components/OutlierView';
export { ROUTES } from './config';
