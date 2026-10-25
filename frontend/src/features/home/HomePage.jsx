import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="container" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <span style={{
          display: 'inline-block',
          padding: '0.4rem 1rem',
          background: '#eef2ff',
          color: '#4338ca',
          borderRadius: '9999px',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}>
          Plateforme Collaborative d'Analyse & Visualisation
        </span>

        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginBottom: '1.5rem' }}>
          Explorez, Analysez et Partagez vos Données en toute Sécurité
        </h1>

        <p style={{ fontSize: '1.15rem', color: '#64748b', lineHeight: 1.6, marginBottom: '2.5rem' }}>
          Une solution d'entreprise moderne combinant gestion sécurisée des identités,
          exploration interactive de jeux de données et création de tableaux de bord en temps réel.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboards" className="btn btn-primary" style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}>
                Accéder aux Dashboards (P4)
              </Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="btn btn-secondary" style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}>
                  🛡️ Dashboard Admin (P1)
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-primary" style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}>
                Se connecter
              </Link>
              <Link to="/register" className="btn btn-secondary" style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}>
                Créer un compte
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 4 Modules Cards Showcase */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        marginTop: '5rem',
        textAlign: 'left'
      }}>
        <div className="card">
          <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>🛡️</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>P1 : IAM & Sécurité</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Authentification par JWT, hachage bcrypt, contrôle d'accès RBAC et journal d'audit complet.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>📁</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>P2 : Datasets & Exploration</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Importation CSV/JSON/Excel, typage automatique, filtres, tri et détection des valeurs manquantes.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>📈</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>P3 : Analyse & Moteur</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Agrégations multi-dimensions (SUM, AVG), séries temporelles, calculs de corrélations et KPIs.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>P4 : Dashboards & Partage</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Éditeur de dashboards drag & drop, détection des valeurs aberrantes et partage public via jeton.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

