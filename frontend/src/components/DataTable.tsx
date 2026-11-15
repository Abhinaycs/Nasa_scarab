interface Props {
  summary: string
  columns: string[]
  rows: (string | number)[][]
}

/** Accessible table fallback for a chart, collapsed by default. */
export default function DataTable({ summary, columns, rows }: Props) {
  return (
    <details className="table-fallback">
      <summary>{summary}</summary>
      <div className="table-scroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) =>
                  j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
