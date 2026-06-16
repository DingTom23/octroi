import { Chip } from '@/components/ui/Chip';

export interface TopTableColumn {
  /** Display label in the header. */
  header: string;
  /** Right-align numeric columns. */
  align?: 'left' | 'right';
}

export interface TopTableRow {
  /** Cells render in the order columns are defined. */
  cells: React.ReactNode[];
}

type TopTableProps = {
  title: string;
  /** Top-right chip caption ("by total paid", etc). */
  badge?: string;
  columns: TopTableColumn[];
  rows: TopTableRow[];
};

export function TopTable({ title, badge, columns, rows }: TopTableProps) {
  return (
    <section className="rounded-card border border-border-subtle bg-bg-surface p-6">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {badge && <Chip>{badge}</Chip>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={
                    'px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-tertiary border-b border-border-subtle ' +
                    (c.align === 'right' ? 'text-right' : 'text-left')
                  }
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-bg-elevated"
              >
                {row.cells.map((cell, ci) => (
                  <td
                    key={ci}
                    className={
                      'px-3 py-3.5 text-sm ' +
                      (columns[ci]?.align === 'right' ? 'text-right' : 'text-left')
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
