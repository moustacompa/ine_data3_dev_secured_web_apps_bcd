import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'logs'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // 1. Charger les statistiques globales
  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les statistiques.');
    }
  };

  // 2. Charger les utilisateurs
  const fetchUsers = async (search = '') => {
    try {
      const url = search ? `/admin/users?search=${encodeURIComponent(search)}` : '/admin/users';
      const res = await api.get(url);
      if (res.data.success) {
        setUsers(res.data.data.users);
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les utilisateurs.');
    }
  };

  // 3. Charger les journaux d'audit
  const fetchLogs = async () => {
    try {
      const res = await api.get('/admin/logs?limit=50');
      if (res.data.success) {
        setLogs(res.data.data.logs);
      }
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les logs d\'audit.');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers(), fetchLogs()]);
      setLoading(false);
    };
    init();
  }, []);

  // 4. Modifier le rôle d'un utilisateur
  const handleRoleChange = async (userId, newRole) => {
    try {
      setActionSuccess('');
      const res = await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      if (res.data.success) {
        setActionSuccess(`Rôle mis à jour avec succès : ${newRole}`);
        await fetchUsers(userSearch);
        await fetchStats();
        await fetchLogs();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors du changement de rôle.');
    }
  };

  // 5. Activer / Désactiver un compte
  const handleStatusChange = async (userId, currentStatus) => {
    try {
      setActionSuccess('');
      const res = await api.patch(`/admin/users/${userId}/status`, { is_active: !currentStatus });
      if (res.data.success) {
        setActionSuccess(`Compte ${!currentStatus ? 'activé' : 'désactivé'} avec succès.`);
        await fetchUsers(userSearch);
        await fetchStats();
        await fetchLogs();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors du changement de statut.');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Chargement de l'espace administration...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
            🛡️ Administration & Supervision
          </h1>
          <p style={{ color: '#64748b' }}>
            Contrôle d'accès, métriques d'usage et traçabilité de sécurité (Module P1)
          </p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '2rem'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          📊 Vue d'ensemble & KPIs
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          👥 Gestion des Utilisateurs ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '-2px'
          }}
        >
          📜 Journaux d'Audit & Sécurité ({logs.length})
        </button>
      </div>

      {/* TAB 1 : OVERVIEW / KPIS */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem'
          }}>
            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Utilisateurs
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem' }}>
                {stats?.users?.total_users || 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.2rem' }}>
                {stats?.users?.active_users || 0} actifs
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Administrateurs
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626', marginTop: '0.5rem' }}>
                {stats?.users?.admin_users || 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                Rôle système avec privilèges élevés
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Data Analysts
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb', marginTop: '0.5rem' }}>
                {stats?.users?.analyst_users || 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                Utilisateurs réguliers
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Événements Tracés
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.5rem' }}>
                {stats?.totalLogs || 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                Entrées dans activity_logs
              </div>
            </div>
          </div>

          {/* Top Actions Breakdown */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
              Top 5 des Actions Récentes (Audit Trail)
            </h3>
            {stats?.topActions?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats.topActions.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.action}</span>
                    <span className="badge badge-analyst">{item.count} occurrences</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Aucune action enregistrée pour le moment.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2 : USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div>
          {/* Search Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Rechercher par nom, prénom ou email..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                fetchUsers(e.target.value);
              }}
              style={{ maxWidth: '400px' }}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Email</th>
                  <th>Rôle Actuel</th>
                  <th>Statut</th>
                  <th>Inscrit le</th>
                  <th style={{ textAlign: 'right' }}>Actions Administrateur</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>{u.id}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-analyst'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {/* Toggle Role */}
                        <button
                          onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'analyst' : 'admin')}
                          className="btn btn-secondary btn-sm"
                        >
                          {u.role === 'admin' ? 'Rétrograder Analyste' : 'Promouvoir Admin'}
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => handleStatusChange(u.id, u.is_active)}
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                        >
                          {u.is_active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3 : AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Action</th>
                  <th>Auteur</th>
                  <th>Cible / Entité</th>
                  <th>Adresse IP</th>
                  <th>Statut</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        {log.user_email ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{log.first_name} {log.last_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.user_email}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Anonyme</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-analyst" style={{ fontSize: '0.7rem' }}>
                          {log.entity}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {log.ip_address || 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.details ? (
                          <pre style={{
                            fontSize: '0.75rem',
                            background: '#f8fafc',
                            padding: '0.3rem 0.5rem',
                            borderRadius: '4px',
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                          </pre>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Aucun événement dans le journal d'audit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;

