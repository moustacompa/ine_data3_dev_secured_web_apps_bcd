import axios from 'axios';

/**
 * Client HTTP de la feature.
 *
 * À l'intégration avec P1, remplacer la création de `client` par l'instance
 * partagée qui contient déjà l'intercepteur JWT, par exemple :
 *   import client from '../../../api/axios';
 * et garder `publicClient` (sans jeton) pour la vue publique.
 */
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const publicClient = axios.create({ baseURL });

/** Message d'erreur lisible à partir d'une erreur Axios. */
export function errorMessage(err, fallback = 'Une erreur est survenue.') {
  const data = err?.response?.data;
  // [FUSION P1/P4] format d'erreur du gestionnaire global de P1 (README.md §4) :
  //   { success: false, error: { code, message, details? } }
  // Sans ce cas, data.error (un objet) serait rendu tel quel par React et ferait planter la page.
  if (data?.error && typeof data.error === 'object') {
    const e = data.error;
    const msg = e.message || fallback;
    return e.details?.length ? `${msg} ${e.details.map((d) => `${d.field} : ${d.message}`).join(' ; ')}` : msg;
  }
  if (data?.details?.length) return `${data.error || fallback} ${data.details.map((d) => `${d.field} : ${d.message}`).join(' ; ')}`;
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  if (err?.request && !err.response) return 'Le serveur ne répond pas. Vérifiez votre connexion.';
  return fallback;
}

export default client;
