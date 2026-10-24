const LABELS = {
  private: { text: 'Privé', hint: 'Visible par vous seul' },
  shared: { text: 'Partagé', hint: 'Visible par les personnes invitées' },
  public: { text: 'Public', hint: 'Visible par toute personne disposant du lien' },
};

export default function VisibilityBadge({ visibility }) {
  const v = LABELS[visibility] || LABELS.private;
  return <span className={`db-badge is-${visibility}`} title={v.hint}>{v.text}</span>;
}

export { LABELS as VISIBILITY_LABELS };
