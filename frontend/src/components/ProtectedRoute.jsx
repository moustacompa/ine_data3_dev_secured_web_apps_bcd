import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Composant Gardien de navigation (Route Guard)
export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated, loading } = useAuth();

  // 1. Pendant la vérification du token au démarrage, on affiche un écran d'attente
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Vérification de la session sécurisée...</p>
      </div>
    );
  }

  // 2. Si l'utilisateur n'est pas connecté, redirection immédiate vers /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si la route exige un rôle précis (ex: 'admin') et que l'utilisateur ne l'a pas
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // 4. Si tout est conforme, on autorise l'accès à la page demandée
  return children;
};

export default ProtectedRoute;