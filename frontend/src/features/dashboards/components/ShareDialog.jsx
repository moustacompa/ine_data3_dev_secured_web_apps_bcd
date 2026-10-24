import { useEffect, useState } from 'react';
import Modal from './Modal';
import { VISIBILITY_LABELS } from './VisibilityBadge';
import { analysesApi, dashboardsApi, publicUrl } from '../api/dashboardsApi';
import { errorMessage } from '../api/client';

/**
 * Partage d'une analyse ou d'un dashboard.
 *  kind = 'analysis'  : privé / partagé
 *  kind = 'dashboard' : privé / partagé / public (lien)
 * onUpdated(resource) est appelé quand la visibilité ou le jeton change.
 */
export default function ShareDialog({ open, onClose, kind, resource, onUpdated }) {
  const api = kind === 'dashboard' ? dashboardsApi : analysesApi;
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !resource) return;
    setError(null);
    api.shares(resource.id).then((r) => setShares(r.shares)).catch((err) => setError(errorMessage(err)));
  }, [open, resource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resource) return null;
  const options = kind === 'dashboard' ? ['private', 'shared', 'public'] : ['private', 'shared'];

  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const invite = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.share(resource.id, email.trim());
      setShares(r.shares);
      setEmail('');
      if (r.visibility !== resource.visibility) onUpdated?.({ ...resource, visibility: r.visibility });
    });
  };
  const revoke = (userId) => run(async () => setShares((await api.unshare(resource.id, userId)).shares));
  const setVisibility = (visibility) => {
    if (visibility === 'public' && !window.confirm('Toute personne disposant du lien pourra voir ce dashboard et les données de ses widgets, sans compte. Continuer ?')) return;
    run(async () => onUpdated?.(await api.update(resource.id, { visibility })));
  };
  const regenerate = () => {
    if (!window.confirm('L’ancien lien cessera immédiatement de fonctionner. Générer un nouveau lien ?')) return;
    run(async () => onUpdated?.(await dashboardsApi.regenerateToken(resource.id)));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl(resource.publicToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Partager « ${resource.title} »`}>
      <fieldset className="db-visibility" disabled={busy}>
        <legend>Qui peut voir {kind === 'dashboard' ? 'ce dashboard' : 'cette analyse'} ?</legend>
        {options.map((v) => (
          <label key={v} className={resource.visibility === v ? 'is-checked' : ''}>
            <input type="radio" name="visibility" value={v} checked={resource.visibility === v} onChange={() => setVisibility(v)} />
            <span><strong>{VISIBILITY_LABELS[v].text}</strong>{VISIBILITY_LABELS[v].hint}</span>
          </label>
        ))}
      </fieldset>

      {resource.visibility === 'public' && resource.publicToken && (
        <div className="db-public-link">
          <input readOnly value={publicUrl(resource.publicToken)} aria-label="Lien public" onFocus={(e) => e.target.select()} />
          <button type="button" className="db-btn" onClick={copy}>{copied ? 'Lien copié' : 'Copier le lien'}</button>
          <button type="button" className="db-link-btn" onClick={regenerate} disabled={busy}>Générer un nouveau lien</button>
        </div>
      )}

      <form className="db-invite" onSubmit={invite}>
        <label htmlFor="db-share-email">Inviter par e-mail</label>
        <div>
          <input id="db-share-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collegue@entreprise.com" />
          <button type="submit" className="db-btn is-primary" disabled={busy}>Inviter</button>
        </div>
        {resource.visibility === 'private' && <p className="db-muted">Inviter quelqu’un passe automatiquement en « Partagé ».</p>}
      </form>

      {error && <p className="db-note" role="alert">{error}</p>}

      <ul className="db-share-list">
        {shares.length === 0 && <li className="db-muted">Personne d’autre n’a accès pour l’instant.</li>}
        {shares.map((s) => (
          <li key={s.id}>
            <span>{s.email}</span>
            <button type="button" className="db-link-btn" onClick={() => revoke(s.id)} disabled={busy}>Retirer l’accès</button>
          </li>
        ))}
      </ul>
      {resource.visibility === 'private' && shares.length > 0 && (
        <p className="db-muted">Ces personnes n’ont plus accès tant que la ressource est privée.</p>
      )}
    </Modal>
  );
}
