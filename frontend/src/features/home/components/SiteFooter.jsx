import { Link } from 'react-router-dom';
import BrandLogo from '../../../components/brand/BrandLogo';

export default function SiteFooter({ isAuthenticated }) {
  return (
    <footer className="vz-footer">
      <div className="vz-container vz-footer-inner">
        <div className="vz-footer-brand">
          <BrandLogo tone="light" size={26} tagline />
          <p>Intelligent Data Analytics &amp; Visualization Platform</p>
        </div>
        <nav className="vz-footer-nav" aria-label="Liens du pied de page">
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#fonctionnement">Comment ça marche</a>
          {isAuthenticated
            ? <><Link to="/analyse">Analyse</Link><Link to="/dashboards">Dashboards</Link></>
            : <><Link to="/login">Connexion</Link><Link to="/register">Créer un compte</Link></>}
        </nav>
      </div>
      <div className="vz-container vz-footer-legal">
        <p>© {new Date().getFullYear()} VIZENTRA · Projet universitaire — plateforme collaborative d'analyse et de visualisation de données.</p>
      </div>
    </footer>
  );
}
