import { Link } from 'react-router-dom';
import { IconArrowRight, IconChart, IconCheck, IconDatabase, IconLayout, IconShield } from './icons';

/*
 * Chaque carte ne liste que ce qui est réellement implémenté dans le dépôt.
 * status 'soon' : module en cours d'intégration (P2) ; next : fonctions prévues.
 */
const FEATURES = [
  {
    id: 'analyse',
    Icon: IconChart,
    title: 'Analyse statistique et visualisation',
    text: 'Construisez une analyse sans écrire de SQL : choisissez vos indicateurs, vos regroupements et vos filtres, puis visualisez le résultat instantanément.',
    points: [
      'Somme, moyenne, min, max, médiane, comptages',
      'GROUP BY multi-colonnes et séries temporelles',
      'Filtres, tri, classement et part du total',
      'Barres, courbes, secteurs, histogramme et KPI',
    ],
    next: 'Corrélations et recommandation de graphiques : prochaine phase',
    link: { to: '/analyse', label: 'Ouvrir la page Analyse' },
    featured: true,
  },
  {
    id: 'securite',
    Icon: IconShield,
    title: 'Sécurité et authentification',
    text: 'Chaque accès est authentifié et chaque action sensible est tracée.',
    points: ['Connexion par jeton JWT', 'Mots de passe hachés (bcrypt)', 'Rôles analyste et administrateur', "Journal d'activité"],
  },
  {
    id: 'datasets',
    Icon: IconDatabase,
    title: 'Gestion et exploration des datasets',
    text: 'Vos jeux de données restent privés : seuls leurs propriétaires et les administrateurs y accèdent.',
    points: ['Détection automatique des types de colonnes', 'Accès limité au propriétaire'],
    status: 'Import de fichiers en intégration',
  },
  {
    id: 'dashboards',
    Icon: IconLayout,
    title: 'Dashboards interactifs et partage',
    text: 'Assemblez vos analyses enregistrées en tableaux de bord vivants.',
    points: ['Grille réorganisable par glisser-déposer', 'Filtres globaux', 'Détection des valeurs aberrantes', 'Partage par invitation ou lien public'],
    link: { to: '/dashboards', label: 'Voir les dashboards' },
  },
];

function FeatureCard({ feature, isAuthenticated }) {
  const { Icon, title, text, points, status, next, link, featured } = feature;
  return (
    <article className={`vz-feature${featured ? ' is-featured' : ''}`}>
      <span className="vz-feature-icon"><Icon /></span>
      <h3 className="vz-feature-title">{title}</h3>
      <p className="vz-feature-text">{text}</p>
      <ul className="vz-feature-points">
        {points.map((p) => <li key={p}><IconCheck />{p}</li>)}
      </ul>
      {(status || next) && <p className="vz-tag is-soon">{status || next}</p>}
      {link && (
        <Link to={isAuthenticated ? link.to : '/login'} className="vz-feature-link">
          {isAuthenticated ? link.label : 'Se connecter pour commencer'} <IconArrowRight />
        </Link>
      )}
    </article>
  );
}

export default function Features({ isAuthenticated }) {
  return (
    <section id="fonctionnalites" className="vz-section vz-features" aria-labelledby="vz-features-title">
      <div className="vz-container">
        <header className="vz-section-head">
          <p className="vz-eyebrow">Fonctionnalités</p>
          <h2 id="vz-features-title" className="vz-section-title">Une plateforme complète, pensée pour l'analyse.</h2>
          <p className="vz-section-lede">
            Quatre modules intégrés qui couvrent tout le cycle de vie de vos données, de leur sécurisation à leur partage.
          </p>
        </header>
        <div className="vz-feature-grid">
          {FEATURES.map((f) => <FeatureCard key={f.id} feature={f} isAuthenticated={isAuthenticated} />)}
        </div>
      </div>
    </section>
  );
}
