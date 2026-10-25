import axios from 'axios';

// URL de base de notre API Node.js Express (port 5000)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// 1. Création de l'instance Axios partagée
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Intercepteur de Requête (Request Interceptor)
// Avant que n'importe quelle requête sorte du navigateur vers le backend, on lui injecte le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 3. Intercepteur de Réponse (Response Interceptor)
// Si le serveur répond 401 (token expiré ou révoqué), on déconnecte proprement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Nettoyage de la session expirée
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Redirection automatique vers la page de connexion si on n'y est pas déjà
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;