import { useId } from 'react';
import './brand.css';

/**
 * Identité VIZENTRA (fichiers source : src/assets/brand/*.svg, public/favicon.svg).
 * Symbole : un V dont le bras droit est formé de trois barres de données ascendantes.
 *
 * tone    'light' (fond clair) | 'dark' (fond sombre) : seules les teintes changent
 * compact true → symbole seul (espaces réduits)
 */
const TONES = {
  light: ['#2563EB', '#7C3AED'],
  dark: ['#3B82F6', '#A78BFA'],
};

export function BrandMark({ tone = 'light', size = 32, title }) {
  const id = `vz-${useId().replace(/:/g, '')}`;
  const [from, to] = TONES[tone] || TONES.light;
  return (
    <svg className="vz-mark" viewBox="0 0 32 32" width={size} height={size}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={id} x1="4" y1="28" x2="29" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d="M5.6 6.2 13.4 25.6" fill="none" stroke={`url(#${id})`} strokeWidth="4.6" strokeLinecap="round" />
      <rect x="15.6" y="18.8" width="3.7" height="7.2" rx="1.5" fill={`url(#${id})`} />
      <rect x="20.8" y="12.6" width="3.7" height="13.4" rx="1.5" fill={`url(#${id})`} />
      <rect x="26" y="6" width="3.7" height="20" rx="1.5" fill={`url(#${id})`} />
    </svg>
  );
}

export default function BrandLogo({ tone = 'light', compact = false, size = 30, tagline = false }) {
  if (compact) return <BrandMark tone={tone} size={size} title="VIZENTRA" />;
  return (
    <span className={`vz-logo is-${tone}`}>
      <BrandMark tone={tone} size={size} />
      <span className="vz-logo-text">
        <span className="vz-wordmark">VIZENTRA</span>
        {tagline && <span className="vz-tagline">From Data to Decisions.</span>}
      </span>
    </span>
  );
}
