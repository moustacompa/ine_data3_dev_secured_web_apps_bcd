import { useEffect, useState } from 'react';
import Modal from '../../dashboards/components/Modal';

const CHART_NAMES = { bar: 'barres', line: 'courbe', pie: 'secteurs', histogram: 'histogramme', kpi: 'KPI', table: 'tableau' };

/**
 * Enregistrement d'une analyse (API analyses de P4).
 * existing : analyse ouverte via ?analysisId= ; si elle est modifiable, on
 * propose de la mettre à jour ou d'en créer une copie.
 */
export default function SaveAnalysisDialog({ open, onClose, onSubmit, existing, defaultTitle, chartType, datasetTitle }) {
  const [form, setForm] = useState({ title: '', description: '', visibility: 'private', asNew: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canUpdate = !!existing?.canEdit;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      title: existing?.title || defaultTitle || '',
      description: existing?.description || '',
      visibility: existing?.visibility || 'private',
      asNew: !canUpdate,
    });
  }, [open, existing, defaultTitle, canUpdate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Le titre est obligatoire.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...form, title: form.title.trim(), description: form.description.trim() });
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer l'analyse.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={canUpdate && !form.asNew ? "Mettre à jour l'analyse" : "Sauvegarder l'analyse"}>
      <form className="db-stack" onSubmit={submit}>
        <p className="db-muted">
          Graphique {CHART_NAMES[chartType] || chartType} sur {datasetTitle}. L'analyse sera disponible dans « Analyses »
          et pourra être ajoutée à un dashboard.
        </p>
        {canUpdate && (
          <fieldset className="an-save-mode">
            <legend className="sr-only">Mode d'enregistrement</legend>
            <label className="an-check">
              <input type="radio" name="an-save-mode" checked={!form.asNew} onChange={() => setForm((f) => ({ ...f, asNew: false }))} />
              Mettre à jour « {existing.title} »
            </label>
            <label className="an-check">
              <input type="radio" name="an-save-mode" checked={form.asNew} onChange={() => setForm((f) => ({ ...f, asNew: true }))} />
              Enregistrer comme nouvelle analyse
            </label>
          </fieldset>
        )}
        <label>Titre
          <input value={form.title} onChange={set('title')} maxLength={150} required autoFocus />
        </label>
        <label>Description <span className="db-muted">(facultatif)</span>
          <textarea value={form.description} onChange={set('description')} maxLength={2000} rows={3} />
        </label>
        <label>Visibilité
          <select value={form.visibility} onChange={set('visibility')}>
            <option value="private">Privée</option>
            <option value="shared">Partagée (avec les personnes invitées)</option>
          </select>
        </label>
        {error && <p className="db-note" role="alert">{error}</p>}
        <div className="db-actions">
          <button type="button" className="db-btn" onClick={onClose}>Annuler</button>
          <button type="submit" className="db-btn is-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  );
}
