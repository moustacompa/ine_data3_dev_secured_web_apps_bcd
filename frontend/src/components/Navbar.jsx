import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './brand/BrandLogo';
import './Navbar.css';

// Ancres de la page d'accueil (visiteurs) et modules (utilisateurs connectés, P1)
const HOME_ANCHORS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#fonctionnement', label: 'Comment ça marche' },
];

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const onHome = pathname === '/';
  const tone = onHome ? 'dark' : 'light';
  // /auth/me ne renvoie pas le nom (seulement id, email, role) : repli sur l'e-mail
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';
  const initial = (user?.first_name || user?.email || 'U')[0].toUpperCase();

  // Le menu mobile se ferme à chaque navigation et avec Échap
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const navClass = ({ isActive }) => `vz-nav-link${isActive ? ' is-active' : ''}`;

  return (
    <header className={`vz-nav is-${tone}${open ? ' is-open' : ''}`}>
      <nav className="vz-nav-inner" aria-label="Navigation principale">
        <Link to="/" className="vz-nav-brand" aria-label="VIZENTRA, accueil">
          <BrandLogo tone={tone} size={28} />
        </Link>

        <button type="button" className="vz-nav-toggle" aria-expanded={open} aria-controls="vz-nav-menu"
          onClick={() => setOpen((o) => !o)}>
          <span className="sr-only">{open ? 'Fermer le menu' : 'Ouvrir le menu'}</span>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {open
              ? <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
          </svg>
        </button>

        <div id="vz-nav-menu" className="vz-nav-menu">
          <ul className="vz-nav-links">
            <li><NavLink to="/" end className={navClass}>Accueil</NavLink></li>
            {isAuthenticated && (
              <>
                <li><NavLink to="/datasets" className={navClass}>Datasets</NavLink></li>
                <li><NavLink to="/analyse" className={navClass}>Analyse</NavLink></li>
                <li><NavLink to="/dashboards" className={navClass}>Dashboards</NavLink></li>
                <li><NavLink to="/analyses" className={navClass}>Mes analyses</NavLink></li>
              </>
            )}
            {!isAuthenticated && onHome && HOME_ANCHORS.map((a) => (
              <li key={a.href}><a href={a.href} className="vz-nav-link" onClick={() => setOpen(false)}>{a.label}</a></li>
            ))}
            {/* Espace exclusif administrateur (P1) */}
            {isAdmin && (
              <li>
                <NavLink to="/admin" className={({ isActive }) => `vz-nav-link is-admin${isActive ? ' is-active' : ''}`}>
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Administration
                </NavLink>
              </li>
            )}
          </ul>

          <div className="vz-nav-actions">
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="vz-nav-user">
                  <span className={`vz-avatar${isAdmin ? ' is-admin' : ''}`} aria-hidden="true">
                    {initial}
                  </span>
                  <span className="vz-nav-user-text">
                    <span className="vz-nav-user-name">{displayName}</span>
                    <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-analyst'}`}>{user?.role}</span>
                  </span>
                </Link>
                <button type="button" onClick={logout} className="vz-btn vz-btn-ghost vz-btn-sm">Déconnexion</button>
              </>
            ) : (
              <>
                <Link to="/login" className="vz-btn vz-btn-ghost vz-btn-sm">Se connecter</Link>
                <Link to="/register" className="vz-btn vz-btn-primary vz-btn-sm">Commencer</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
