import { Link } from 'react-router-dom';
import DashboardPreview from './DashboardPreview';
import { IconArrowRight, IconLock } from './icons';

/** Section d'ouverture : promesse, appels à l'action et aperçu de l'interface. */
export default function Hero({ isAuthenticated, firstName }) {
  return (
    <section className="vz-hero" aria-labelledby="vz-hero-title">
      <div className="vz-hero-glow" aria-hidden="true" />
      <div className="vz-hero-grid" aria-hidden="true" />

      <div className="vz-container vz-hero-inner">
        <p className="vz-eyebrow-badge"><span className="vz-pulse" aria-hidden="true" />Data Analytics Platform</p>

        <h1 id="vz-hero-title" className="vz-hero-title">
          Transformez vos données en <span className="vz-gradient-text">décisions intelligentes.</span>
        </h1>

        <p className="vz-hero-lede">
          Centralisez, explorez et analysez vos données dans un environnement sécurisé. Créez des visualisations
          interactives et partagez vos insights en quelques clics.
        </p>

        <div className="vz-hero-actions">
          <Link to={isAuthenticated ? '/analyse' : '/login'} className="vz-btn vz-btn-primary vz-btn-lg">
            Commencer l'analyse <IconArrowRight />
          </Link>
          <a href="#fonctionnalites" className="vz-btn vz-btn-on-dark vz-btn-lg">Découvrir la plateforme</a>
        </div>

        <p className="vz-hero-trust">
          <IconLock />
          {isAuthenticated
            ? <>Connecté{firstName ? ` en tant que ${firstName}` : ''} · vos datasets restent privés par défaut</>
            : <>Authentification JWT · contrôle d'accès par rôles · données hébergées sur PostgreSQL</>}
        </p>
      </div>

      <div className="vz-container vz-hero-preview">
        <DashboardPreview />
      </div>
    </section>
  );
}
