import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

// Création du contexte React
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // Au chargement initial de l'application, on vérifie si un token est déjà en mémoire
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        // On demande au backend notre profil avec ce token
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
        }
      } catch (error) {
        console.warn('Session expirée ou invalide.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  // Action de Connexion
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.success) {
      const { user: loggedUser, token: receivedToken } = response.data.data;
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      setToken(receivedToken);
      return loggedUser;
    }
  };

  // Action d'Inscription
  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.success) {
      const { user: registeredUser, token: receivedToken } = response.data.data;
      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(registeredUser));
      setUser(registeredUser);
      setToken(receivedToken);
      return registeredUser;
    }
  };

  // Action de Déconnexion
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook personnalisé pour consommer facilement l'authentification dans n'importe quel composant
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};