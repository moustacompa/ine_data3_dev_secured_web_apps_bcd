import { BrandMark } from '../../../components/brand/BrandLogo';
import { IconAnalyze, IconChart, IconDatabase, IconLayout, IconShare } from './icons';

/*
 * Aperçu ILLUSTRATIF de l'interface : toutes les valeurs ci-dessous sont des
 * données de démonstration statiques, affichées comme telles. Elles ne
 * proviennent d'aucune analyse et ne sont pas lues par les lecteurs d'écran.
 */
const DEMO_KPIS = [
  { label: "Chiffre d'affaires", value: '45,2 k€', delta: '+12,4 %', spark: [8, 10, 9, 12, 11, 14, 16] },
  { label: 'Commandes', value: '1 284', delta: '+8,1 %', spark: [6, 7, 9, 8, 10, 11, 12] },
  { label: 'Panier moyen', value: '35,2 €', delta: '+3,9 %', spark: [9, 9, 10, 9, 11, 10, 12] },
  { label: 'Clients actifs', value: '612', delta: '+5,6 %', spark: [5, 6, 6, 8, 7, 9, 10] },
];
const DEMO_TREND = [22, 26, 24, 31, 29, 35, 33, 40, 38, 44, 47, 52];
const DEMO_TREND_PREV = [20, 21, 23, 24, 25, 26, 27, 29, 30, 31, 33, 35];
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const DEMO_REGIONS = [
  { name: 'Nord', value: 92 },
  { name: 'Ouest', value: 78 },
  { name: 'Sud', value: 61 },
  { name: 'Est', value: 43 },
];
const DEMO_ROWS = [
  ['Produit A', 'Nord', '15 293 €', '+18 %'],
  ['Produit B', 'Ouest', '13 273 €', '+11 %'],
  ['Produit C', 'Sud', '10 162 €', '+6 %'],
];
const SIDEBAR = [IconLayout, IconAnalyze, IconChart, IconDatabase, IconShare];

const W = 420;
const H = 150;
const PAD = 8;
function linePath(values, max) {
  const step = (W - PAD * 2) / (values.length - 1);
  return values.map((v, i) => `${i ? 'L' : 'M'}${(PAD + i * step).toFixed(1)} ${(H - PAD - (v / max) * (H - PAD * 3)).toFixed(1)}`).join(' ');
}

function Sparkline({ values }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${i * 10} ${18 - ((v - min) / (max - min || 1)) * 14}`).join(' ');
  return <svg className="vz-pv-spark" viewBox="0 0 60 20" preserveAspectRatio="none"><path d={d} /></svg>;
}

function TrendChart() {
  const max = Math.max(...DEMO_TREND) * 1.1;
  const line = linePath(DEMO_TREND, max);
  return (
    <svg className="vz-pv-trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="vz-pv-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="vz-pv-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => <line key={t} className="vz-pv-grid" x1="0" x2={W} y1={H * t} y2={H * t} />)}
      <path d={`${line} L${W - PAD} ${H} L${PAD} ${H} Z`} fill="url(#vz-pv-area)" className="vz-pv-area" />
      <path d={linePath(DEMO_TREND_PREV, max)} className="vz-pv-line-prev" />
      <path d={line} className="vz-pv-line" />
    </svg>
  );
}

export default function DashboardPreview() {
  return (
    <figure className="vz-preview">
      <figcaption className="sr-only">
        Aperçu illustratif de l'interface VIZENTRA : un dashboard avec indicateurs clés, courbe de tendance,
        graphique par région et tableau. Les valeurs affichées sont des données de démonstration.
      </figcaption>

      <div className="vz-pv-window" aria-hidden="true">
        <div className="vz-pv-titlebar">
          <span className="vz-pv-dots"><i /><i /><i /></span>
          <span className="vz-pv-title">Dashboard · Performance commerciale</span>
          <span className="vz-pv-demo">Données de démonstration</span>
        </div>

        <div className="vz-pv-body">
          <aside className="vz-pv-sidebar">
            <BrandMark tone="dark" size={22} />
            <ul>
              {SIDEBAR.map((I, i) => <li key={i} className={i === 0 ? 'is-on' : ''}><I size={18} /></li>)}
            </ul>
          </aside>

          <div className="vz-pv-main">
            <div className="vz-pv-toolbar">
              <div>
                <p className="vz-pv-eyebrow">Ventes 2026</p>
                <p className="vz-pv-heading">Performance commerciale</p>
              </div>
              <div className="vz-pv-filters">
                <span>Période : 2026</span>
                <span>Région : toutes</span>
                <span className="is-on">Produit : tous</span>
              </div>
            </div>

            <div className="vz-pv-kpis">
              {DEMO_KPIS.map((k) => (
                <div key={k.label} className="vz-pv-kpi">
                  <span className="vz-pv-kpi-label">{k.label}</span>
                  <span className="vz-pv-kpi-value">{k.value}</span>
                  <span className="vz-pv-kpi-foot">
                    <span className="vz-pv-delta">{k.delta}</span>
                    <Sparkline values={k.spark} />
                  </span>
                </div>
              ))}
            </div>

            <div className="vz-pv-charts">
              <div className="vz-pv-panel vz-pv-panel-trend">
                <div className="vz-pv-panel-head">
                  <span>Évolution mensuelle du CA</span>
                  <span className="vz-pv-legend"><i className="is-now" />2026<i className="is-prev" />2025</span>
                </div>
                <TrendChart />
                <div className="vz-pv-months">{MONTHS.map((m, i) => <span key={i}>{m}</span>)}</div>
              </div>

              <div className="vz-pv-panel">
                <div className="vz-pv-panel-head"><span>CA par région</span></div>
                <div className="vz-pv-bars">
                  {DEMO_REGIONS.map((r, i) => (
                    <div key={r.name} className="vz-pv-bar">
                      <span className="vz-pv-bar-track"><span style={{ '--h': `${r.value}%`, '--d': `${i * 90}ms` }} /></span>
                      <span className="vz-pv-bar-label">{r.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vz-pv-panel vz-pv-table-panel">
              <div className="vz-pv-panel-head"><span>Meilleures ventes</span></div>
              <div className="vz-pv-table">
                <div className="vz-pv-row is-head"><span>Produit</span><span>Région</span><span>Montant</span><span>Évol.</span></div>
                {DEMO_ROWS.map((r) => (
                  <div key={r[0]} className="vz-pv-row">
                    <span>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span><span className="vz-pv-up">{r[3]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carte flottante : profondeur visuelle */}
      <div className="vz-pv-float" aria-hidden="true">
        <span className="vz-pv-float-icon"><IconAnalyze size={18} /></span>
        <span>
          <span className="vz-pv-float-title">Analyse enregistrée</span>
          <span className="vz-pv-float-text">SUM(montant) par région · prête pour un dashboard</span>
        </span>
      </div>
    </figure>
  );
}
