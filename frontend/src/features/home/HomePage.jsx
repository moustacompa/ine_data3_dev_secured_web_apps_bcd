import { useAuth } from '../../context/AuthContext';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import FinalCta from './components/FinalCta';
import SiteFooter from './components/SiteFooter';
import './home.css';

export const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="vz-home">
      <Hero isAuthenticated={isAuthenticated} firstName={user?.first_name} />
      <HowItWorks />
      <Features isAuthenticated={isAuthenticated} />
      <FinalCta isAuthenticated={isAuthenticated} />
      <SiteFooter isAuthenticated={isAuthenticated} />
    </div>
  );
};

export default HomePage;
