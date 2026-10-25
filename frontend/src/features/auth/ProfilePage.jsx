import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="container" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a' }}>Mon Profil</h1>
        <p style={{ color: '#64748b' }}>Informations personnelles et autorisations de compte</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: user?.role === 'admin' ? '#fee2e2' : '#e0e7ff',
            color: user?.role === 'admin' ? '#991b1b' : '#3730a3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700
          }}>
            {user?.first_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{user?.first_name} {user?.last_name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
              <span className={`badge ${user?.role === 'admin' ? 'badge-admin' : 'badge-analyst'}`}>
                {user?.role}
              </span>
              <span className="badge badge-success">Actif</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Identifiant UUID</label>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#334155', marginTop: '0.2rem', wordBreak: 'break-all' }}>
              {user?.id}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Adresse Email</label>
            <div style={{ fontSize: '0.95rem', color: '#334155', marginTop: '0.2rem' }}>
              {user?.email}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Rôle sur la plateforme</label>
            <div style={{ fontSize: '0.95rem', color: '#334155', marginTop: '0.2rem' }}>
              {user?.role === 'admin' ? 'Administrateur Système' : 'Data Analyst'}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Date d'inscription</label>
            <div style={{ fontSize: '0.95rem', color: '#334155', marginTop: '0.2rem' }}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

