/**
 * Feature Analyse & Visualisation (P3).
 *
 * Route protégée (App.jsx) : /analyse, /analyse?analysisId=… pour ouvrir une analyse P4.
 * Les graphiques sont aussi utilisés par les dashboards P4 via
 * features/dashboards/charts/source.js.
 */
export { default as AnalysisPage } from './pages/AnalysisPage';
export { analyticsApi } from './api/analyticsApi';
export { BarChart, LineChart, PieChart, Histogram, KpiCard } from './components/charts';
