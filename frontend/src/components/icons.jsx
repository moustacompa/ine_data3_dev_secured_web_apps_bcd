/**
 * Icônes de l'espace de travail : même grille que l'accueil (24 px, trait 1.75,
 * extrémités arrondies), dessinées pour VIZENTRA. Décoratives : aria-hidden.
 */
const Icon = ({ children, size = 20, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);

// ------------------------------------------------------------- Navigation
export const IconHome = (p) => (
  <Icon {...p}><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9v10a1 1 0 0 0 1 1h3.5v-5.5h3V20H17a1 1 0 0 0 1-1V9" /></Icon>
);
export const IconAnalyze = (p) => (
  <Icon {...p}><path d="M4 4v16h16" /><path d="m7.5 14.5 3.5-4 3 2.5 5-6" /></Icon>
);
export const IconLayout = (p) => (
  <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M3.5 9.5h17M10 9.5v11" /></Icon>
);
export const IconFolder = (p) => (
  <Icon {...p}><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M8 13.5h8" /></Icon>
);
export const IconShare = (p) => (
  <Icon {...p}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></Icon>
);
export const IconShield = (p) => (
  <Icon {...p}><path d="M12 3l7.5 3v5.2c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V6z" /></Icon>
);
export const IconDatabase = (p) => (
  <Icon {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V5.5" /><path d="M4.5 12v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V12" /></Icon>
);
export const IconUpload = (p) => (
  <Icon {...p}><path d="M12 15V4.5" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></Icon>
);
export const IconUser = (p) => (
  <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" /></Icon>
);
export const IconLogout = (p) => (
  <Icon {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></Icon>
);
export const IconCollapse = (p) => (
  <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9 4v16" /><path d="m15.5 10-2 2 2 2" /></Icon>
);
export const IconExpand = (p) => (
  <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9 4v16" /><path d="m13.5 10 2 2-2 2" /></Icon>
);
export const IconMenu = (p) => (
  <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
);
export const IconClose = (p) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const IconChevronRight = (p) => (
  <Icon size={14} {...p}><path d="m9 6 6 6-6 6" /></Icon>
);

// ---------------------------------------------------------------- Actions
export const IconPlus = (p) => (
  <Icon size={18} {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const IconSearch = (p) => (
  <Icon size={18} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icon>
);
export const IconTrash = (p) => (
  <Icon size={18} {...p}><path d="M4.5 7h15" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" /><path d="M10 11v5.5M14 11v5.5" /></Icon>
);
export const IconPencil = (p) => (
  <Icon size={18} {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></Icon>
);
export const IconEye = (p) => (
  <Icon size={18} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.75" /></Icon>
);
export const IconPlay = (p) => (
  <Icon size={18} {...p}><path d="M7.5 5.5v13l11-6.5z" fill="currentColor" stroke="none" /></Icon>
);
export const IconReset = (p) => (
  <Icon size={18} {...p}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" /></Icon>
);
export const IconSave = (p) => (
  <Icon size={18} {...p}><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M8 4v5h7V4" /><path d="M8 20v-6h8v6" /></Icon>
);
export const IconInfo = (p) => (
  <Icon size={16} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><circle cx="12" cy="7.75" r="0.6" fill="currentColor" /></Icon>
);
export const IconWarning = (p) => (
  <Icon size={16} {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></Icon>
);
export const IconCheck = (p) => (
  <Icon size={16} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);

// ------------------------------------------------------ Analyse : sections
export const IconSigma = (p) => (
  <Icon size={18} {...p}><path d="M17.5 5h-11l6 7-6 7h11" /></Icon>
);
export const IconLayers = (p) => (
  <Icon size={18} {...p}><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" /></Icon>
);
export const IconCalendar = (p) => (
  <Icon size={18} {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>
);
export const IconFilter = (p) => (
  <Icon size={18} {...p}><path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8z" /></Icon>
);
export const IconSort = (p) => (
  <Icon size={18} {...p}><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5" /><path d="M14 6h7M14 11h5M14 16h3" /></Icon>
);

// ------------------------------------------------- Types de visualisation
export const IconChartBar = (p) => (
  <Icon {...p}><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="6.5" rx="0.8" /><rect x="10.5" y="6" width="3" height="11.5" rx="0.8" /><rect x="15.5" y="9" width="3" height="8.5" rx="0.8" /></Icon>
);
export const IconChartLine = (p) => (
  <Icon {...p}><path d="M4 20h16" /><path d="m4.5 15.5 4.5-5 4 3 6.5-7.5" /></Icon>
);
export const IconChartPie = (p) => (
  <Icon {...p}><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z" /><path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z" /></Icon>
);
export const IconChartHistogram = (p) => (
  <Icon {...p}><path d="M4 20h16" /><path d="M5 17.5v-4h3v-5h3v-4h3v6h3v3h2v4" /></Icon>
);
export const IconChartKpi = (p) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M7 14.5 10 11l2.5 2 4.5-5" /></Icon>
);
export const IconChartTable = (p) => (
  <Icon {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10" /></Icon>
);
