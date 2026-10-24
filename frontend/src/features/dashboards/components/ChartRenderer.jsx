import { BarChart, LineChart, PieChart, KpiCard, Histogram } from '../charts/source';
import { fmt } from '../charts/mockCharts';
import OutlierView from './OutlierView';

const COMPONENTS = { bar: BarChart, line: LineChart, pie: PieChart, kpi: KpiCard, histogram: Histogram };

function DataTable({ columns = [], rows = [] }) {
  return (
    <div className="db-table-wrap">
      <table className="db-table">
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c}>{fmt(r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Affiche le résultat d'un widget : { chart: {type, x, y}, columns, rows }
 * ou { chart: {type: 'outliers'}, outliers }.
 */
export default function ChartRenderer({ result, title }) {
  if (!result) return null;
  const chart = result.chart || { type: 'table' };
  if (chart.type === 'outliers') return <OutlierView data={result.outliers} />;
  if (!result.rows?.length) return <p className="db-muted">Aucune donnée ne correspond aux filtres.</p>;

  const Component = COMPONENTS[chart.type];
  if (!Component) return <DataTable columns={result.columns} rows={result.rows} />;
  const columns = result.columns || Object.keys(result.rows[0]);
  const x = chart.x || columns[0];
  const y = chart.y?.length ? chart.y : columns.filter((c) => c !== x).slice(0, 1);
  return <Component data={result.rows} x={x} y={y} title={title} options={chart.options} />;
}
