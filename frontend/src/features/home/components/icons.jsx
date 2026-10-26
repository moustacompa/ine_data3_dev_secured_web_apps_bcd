/**
 * Icônes de la page d'accueil : grille 24 px, trait 1.75, extrémités arrondies.
 * Dessinées pour VIZENTRA (pas de bibliothèque tierce). Décoratives : aria-hidden.
 */
const Icon = ({ children, size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

export const IconImport = (p) => (
  <Icon {...p}><path d="M12 3v11" /><path d="m7.5 9.5 4.5 4.5 4.5-4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>
);
export const IconExplore = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /><path d="M8.5 11h5M11 8.5v5" /></Icon>
);
export const IconAnalyze = (p) => (
  <Icon {...p}><path d="M4 4v16h16" /><path d="m7.5 14.5 3.5-4 3 2.5 5-6" /><circle cx="19" cy="7" r="0.6" fill="currentColor" /></Icon>
);
export const IconVisualize = (p) => (
  <Icon {...p}><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></Icon>
);
export const IconShare = (p) => (
  <Icon {...p}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></Icon>
);
export const IconShield = (p) => (
  <Icon {...p}><path d="M12 3l7.5 3v5.2c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></Icon>
);
export const IconDatabase = (p) => (
  <Icon {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V5.5" /><path d="M4.5 12v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V12" /></Icon>
);
export const IconChart = (p) => (
  <Icon {...p}><rect x="4" y="12" width="3.5" height="8" rx="1" /><rect x="10.25" y="7" width="3.5" height="13" rx="1" /><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1" /></Icon>
);
export const IconLayout = (p) => (
  <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M3.5 9.5h17M10 9.5v11" /></Icon>
);
export const IconArrowRight = (p) => (
  <Icon size={18} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);
export const IconCheck = (p) => (
  <Icon size={16} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const IconLock = (p) => (
  <Icon size={16} {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></Icon>
);
