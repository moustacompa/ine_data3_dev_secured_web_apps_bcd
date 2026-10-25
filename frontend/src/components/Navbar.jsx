import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav style={{
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0.85rem 1.5rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/" style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none'
          }}>
            <span style={{ fontSize: '1.4rem' }}>📊</span> DataPlatform
          </Link>

          {/* Navigation links for modules */}
          <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.92rem' }}>
            <Link to="/" style={{ color: '#475569', fontWeight: 500 }}>Accueil</Link>

            {/* Accessible to connected analysts and admin */}
            {isAuthenticated && (
              <>
                <Link to="/dashboards" style={{ color: '#475569', fontWeight: 500 }}>
                  Dashboards (P4)
                </Link>
                <Link to="/analyses" style={{ color: '#475569', fontWeight: 500 }}>
                  Analyses
                </Link>
              </>
            )}

            {/* Exclusive Admin Space (P1) */}
            {isAdmin && (
              <Link to="/admin" style={{
                color: '#dc2626',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                🛡️ Administration
              </Link>
            )}
          </div>
        </div>

        {/* User Account / Auth Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: isAdmin ? '#fee2e2' : '#e0e7ff',
                  color: isAdmin ? '#991b1b' : '#3730a3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  {user?.first_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-analyst'}`} style={{ fontSize: '0.65rem' }}>
                    {user?.role}
                  </span>
                </div>
              </Link>
              <button onClick={logout} className="btn btn-secondary btn-sm">
                Déconnexion
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" className="btn btn-secondary btn-sm">
                Connexion
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Créer un compte
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

