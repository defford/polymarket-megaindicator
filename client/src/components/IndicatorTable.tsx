import type { IndicatorRow } from "../types";
import { formatValue } from "../utils";

interface IndicatorTableProps {
  title: string;
  rows: IndicatorRow[];
}

export function IndicatorTable({ title, rows }: IndicatorTableProps) {
  return (
    <section className="panel indicator-panel">
      <h3>{title}</h3>
      <table className="indicator-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td className="mono">{formatValue(row.value)}</td>
              <td className={`action-${row.action.toLowerCase()}`}>{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
