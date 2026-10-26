import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BrandLogo, { BrandMark } from '../brand/BrandLogo';
import {
  IconAnalyze, IconChevronRight, IconCollapse, IconExpand, IconFolder, IconHome, IconLayout, IconLogout,
  IconMenu, IconPlus, IconShare, IconShield, IconClose,
} from '../icons';
import './AppShell.css';

/*
 * Espace de travail des pages authentifiées : barre latérale navy, barre
 * supérieure (fil d'Ariane, utilisateur) et zone de travail pleine largeur.
 * Seules les routes existantes de App.jsx sont proposées (pas de lien vers
 * le module Datasets P2 tant qu'il n'a pas de page).
 */
const NAV = [
  { to: '/', label: 'Accueil', icon: IconHome, end: true },
  { to: '/analyse', label: 'Analyse', icon: IconAnalyze },
  { to: '/mes-analyses', label: 'Mes analyses', icon: IconFolder, alias: '/analyses' },
  { to: '/dashboards', label: 'Dashboards', icon: IconLayout },
  { to: '/partages', label: 'Partagés avec moi', icon: IconShare },
];

// Titre et parent de chaque page (fil d'Ariane), du plus précis au plus général
const PAGES = [
  { test: /^\/analyse/, title: 'Analyse' },
  { test: /^\/(mes-analyses|analyses)/, title: 'Mes analyses' },
  { test: /^\/dashboards\/[^/]+\/edit/, title: 'Édition', parent: { to: '/dashboards', label: 'Dashboards' } },
  { test: /^\/dashboards\/[^/]+/, title: 'Consultation', parent: { to: '/dashboards', label: 'Dashboards' } },
  { test: /^\/dashboards/, title: 'Dashboards' },
  { test: /^\/partages/, title: 'Partagés avec moi' },
  { test: /^\/admin/, title: 'Administration' },
  { test: /^\/profile/, title: 'Mon profil' },
];

const ROLE_LABELS = { analyst: 'Analyst', admin: 'Admin' };
const COLLAPSE_KEY = 'vz-sidebar-collapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

/** Nom et initiales depuis le profil P1 (prénom, nom), repli sur l'e-mail. */
export function identityOf(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  const initials = name
    ? [user.first_name, user.last_name].filter(Boolean).map((s) => s.trim()[0]).join('').toUpperCase()
    : (user?.email || 'U')[0].toUpperCase();
  return { name: name || user?.email || '', initials };
}

function SideLink({ item, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined}
      className={({ isActive }) => `vz-side-link${isActive || (item.alias && pathname.startsWith(item.alias)) ? ' is-active' : ''}${item.danger ? ' is-admin' : ''}`}>
      <Icon size={20} />
      <span className="vz-side-label">{item.label}</span>
    </NavLink>
  );
}

export default function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const sidebarRef = useRef(null);
  const page = PAGES.find((p) => p.test.test(pathname));
  const { name, initials } = identityOf(user);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* stockage indisponible */ }
  }, [collapsed]);

  // Tiroir mobile : fermé à chaque navigation, Échap pour fermer, focus sur le premier lien
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!drawer) return undefined;
    sidebarRef.current?.querySelector('a, button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const close = () => setDrawer(false);

  return (
    <div className={`vz-shell${collapsed ? ' is-collapsed' : ''}${drawer ? ' is-drawer' : ''}`}>
      <a href="#vz-main" className="vz-skip">Aller au contenu</a>

      <aside id="vz-sidebar" ref={sidebarRef} className="vz-sidebar" aria-label="Navigation de l'espace de travail">
        <div className="vz-side-head">
          <Link to="/" className="vz-side-brand" aria-label="VIZENTRA, accueil" onClick={close}>
            {collapsed ? <BrandMark tone="dark" size={28} /> : <BrandLogo tone="dark" size={28} />}
          </Link>
          <button type="button" className="vz-side-icon-btn vz-drawer-close" onClick={close} aria-label="Fermer le menu">
            <IconClose size={20} />
          </button>
        </div>

        <nav className="vz-side-nav">
          <p className="vz-side-section">Espace de travail</p>
          <ul>
            {NAV.map((item) => <li key={item.to}><SideLink item={item} collapsed={collapsed} onNavigate={close} /></li>)}
          </ul>
          {isAdmin && (
            <>
              <p className="vz-side-section">Administration</p>
              <ul>
                <li><SideLink item={{ to: '/admin', label: 'Administration', icon: IconShield, danger: true }} collapsed={collapsed} onNavigate={close} /></li>
              </ul>
            </>
          )}
        </nav>

        <div className="vz-side-foot">
          <NavLink to="/profile" onClick={close} title={collapsed ? `${name} · Mon profil` : undefined}
            className={({ isActive }) => `vz-side-user${isActive ? ' is-active' : ''}`}>
            <span className={`vz-avatar${isAdmin ? ' is-admin' : ''}`} aria-hidden="true">{initials}</span>
            <span className="vz-side-label vz-side-user-text">
              <span className="vz-side-user-name">{name}</span>
              <span className="vz-side-user-role">{ROLE_LABELS[user?.role] || user?.role} · Mon profil</span>
            </span>
          </NavLink>
          <button type="button" className="vz-side-link vz-side-logout" onClick={logout} title={collapsed ? 'Déconnexion' : undefined}>
            <IconLogout size={20} />
            <span className="vz-side-label">Déconnexion</span>
          </button>
          <button type="button" className="vz-side-link vz-collapse-btn" onClick={() => setCollapsed((c) => !c)}
            aria-pressed={collapsed} title={collapsed ? 'Déplier la barre latérale' : undefined}>
            {collapsed ? <IconExpand size={20} /> : <IconCollapse size={20} />}
            <span className="vz-side-label">Réduire le menu</span>
          </button>
        </div>
      </aside>

      {drawer && <div className="vz-backdrop" onClick={close} aria-hidden="true" />}

      <div className="vz-workspace">
        <header className="vz-topbar">
          <button type="button" className="vz-top-menu" onClick={() => setDrawer(true)}
            aria-expanded={drawer} aria-controls="vz-sidebar">
            <IconMenu size={22} /><span className="sr-only">Ouvrir la navigation</span>
          </button>

          <div className="vz-top-title">
            <nav aria-label="Fil d'Ariane">
              <ol className="vz-crumbs">
                <li><Link to="/analyse">Espace de travail</Link></li>
                {page?.parent && (
                  <li><IconChevronRight /><Link to={page.parent.to}>{page.parent.label}</Link></li>
                )}
                <li aria-current="page"><IconChevronRight /><span>{page?.title || 'Page'}</span></li>
              </ol>
            </nav>
          </div>

          <div className="vz-top-actions">
            {!pathname.startsWith('/analyse') && (
              <Link to="/analyse" className="vz-btn vz-btn-primary vz-btn-sm vz-top-cta">
                <IconPlus /><span>Nouvelle analyse</span>
              </Link>
            )}
            <Link to="/profile" className="vz-top-user" aria-label={`${name}, ${ROLE_LABELS[user?.role] || user?.role} : voir mon profil`}>
              <span className={`vz-avatar${isAdmin ? ' is-admin' : ''}`} aria-hidden="true">{initials}</span>
              <span className="vz-top-user-text" aria-hidden="true">
                <span className="vz-top-user-name">{name}</span>
                <span className={`vz-role${isAdmin ? ' is-admin' : ''}`}>{ROLE_LABELS[user?.role] || user?.role}</span>
              </span>
            </Link>
          </div>
        </header>

        <div id="vz-main" className="vz-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
