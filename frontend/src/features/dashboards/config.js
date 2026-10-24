/** Routes des autres features (à ajuster à l'intégration). */
export const ROUTES = {
  dashboards: '/dashboards',
  dashboard: (id) => `/dashboards/${id}`,
  dashboardEdit: (id) => `/dashboards/${id}/edit`,
  myAnalyses: '/mes-analyses',
  sharedWithMe: '/partages',
  // Page Analyse de P3 : création et modification d'une analyse
  analysisNew: '/analyse',
  analysisEdit: (id) => `/analyse?analysisId=${id}`,
};

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
