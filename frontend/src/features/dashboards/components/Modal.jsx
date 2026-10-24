import { useEffect, useRef } from 'react';

/** Boîte de dialogue accessible basée sur <dialog> (Échap pour fermer). */
export default function Modal({ open, title, onClose, children, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`db-modal${wide ? ' is-wide' : ''}`} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="db-modal-title">
      {open && (
        <div className="db-modal-body">
          <header>
            <h2 id="db-modal-title">{title}</h2>
            <button type="button" className="db-icon-btn" onClick={onClose} aria-label="Fermer">×</button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
