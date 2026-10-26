import { Link } from 'react-router-dom';
import { BrandMark } from '../../../components/brand/BrandLogo';
import { IconArrowRight } from './icons';

export default function FinalCta({ isAuthenticated }) {
  return (
    <section className="vz-section vz-cta-section" aria-labelledby="vz-cta-title">
      <div className="vz-container">
        <div className="vz-cta">
          <div className="vz-cta-glow" aria-hidden="true" />
          <BrandMark tone="dark" size={44} />
          <p className="vz-cta-signature">From Data to Decisions.</p>
          <h2 id="vz-cta-title" className="vz-cta-title">Prêt à exploiter pleinement vos données ?</h2>
          <p className="vz-cta-text">Connectez-vous et lancez votre première analyse en moins d'une minute.</p>
          <div className="vz-cta-actions">
            <Link to={isAuthenticated ? '/dashboards' : '/login'} className="vz-btn vz-btn-primary vz-btn-lg">
              Accéder à VIZENTRA <IconArrowRight />
            </Link>
            {!isAuthenticated && <Link to="/register" className="vz-btn vz-btn-on-dark vz-btn-lg">Créer un compte</Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
