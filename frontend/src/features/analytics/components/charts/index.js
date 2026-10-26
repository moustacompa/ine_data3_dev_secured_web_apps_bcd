/**
 * Composants graphiques P3, réutilisés par les dashboards P4
 * (features/dashboards/charts/source.js).
 * Contrat de props commun : { data, x, y, title, options } — voir chartUtils.js.
 */
import './charts.css';

export { default as BarChart } from './BarChart';
export { default as LineChart } from './LineChart';
export { default as PieChart } from './PieChart';
export { default as Histogram, computeHistogram } from './Histogram';
export { default as KpiCard } from './KpiCard';
export { formatValue, formatNumber, formatPeriod } from './chartUtils';
