import { IconAnalyze, IconExplore, IconImport, IconShare, IconVisualize } from './icons';

const STEPS = [
  { Icon: IconImport, title: 'Importer', text: 'Chargez vos fichiers de données dans un espace personnel et sécurisé.', status: 'En intégration' },
  { Icon: IconExplore, title: 'Explorer', text: 'Parcourez les colonnes et leurs types détectés automatiquement.' },
  { Icon: IconAnalyze, title: 'Analyser', text: 'Calculez sommes, moyennes, médianes et comptages, par groupe ou par période.' },
  { Icon: IconVisualize, title: 'Visualiser', text: 'Basculez entre barres, courbes, secteurs, histogrammes et KPI.' },
  { Icon: IconShare, title: 'Partager', text: 'Assemblez vos analyses en dashboards et partagez-les en un lien.' },
];

/** Parcours en cinq étapes : horizontal sur grand écran, vertical sur mobile. */
export default function HowItWorks() {
  return (
    <section id="fonctionnement" className="vz-section vz-how" aria-labelledby="vz-how-title">
      <div className="vz-container">
        <header className="vz-section-head">
          <p className="vz-eyebrow">Comment ça marche ?</p>
          <h2 id="vz-how-title" className="vz-section-title">De la donnée brute à la décision, en cinq étapes.</h2>
          <p className="vz-section-lede">Un parcours continu : chaque étape alimente la suivante, sans quitter la plateforme.</p>
        </header>

        <ol className="vz-steps">
          {STEPS.map(({ Icon, title, text, status }, i) => (
            <li key={title} className="vz-step">
              <span className="vz-step-icon"><Icon /></span>
              <span className="vz-step-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="vz-step-title">{title}</h3>
              <p className="vz-step-text">{text}</p>
              {status && <span className="vz-tag is-soon">{status}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
