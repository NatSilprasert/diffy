import { DataTable } from '@/components/DataTable';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatTokens } from '@/lib/format';

export type UsageRow = { key: string; name: string; hint?: string; reviews: number; inputTokens: number; outputTokens: number };

const CELL = 'px-4 py-3 text-sm tabular-nums';

// A small breakdown: what it is, how many reviews, and the tokens they took. Biggest user first (the caller sorts).
export function UsageTable({ title, nameColumn, rows, empty }: { title: string; nameColumn: string; rows: UsageRow[]; empty: string }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <DataTable columns={[{ label: nameColumn }, { label: 'Reviews' }, { label: 'Input' }, { label: 'Output' }, { label: 'Total' }]}>
          {rows.map((row) => (
            <TableRow key={row.key} className="border-border bg-card hover:bg-secondary/60">
              <TableCell className="max-w-52 px-4 py-3 text-sm">
                <span className="block truncate" title={row.name}>
                  {row.name}
                </span>
                {row.hint && <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>}
              </TableCell>
              <TableCell className={CELL}>{row.reviews.toLocaleString()}</TableCell>
              <TableCell className={CELL} title={row.inputTokens.toLocaleString()}>
                {formatTokens(row.inputTokens)}
              </TableCell>
              <TableCell className={CELL} title={row.outputTokens.toLocaleString()}>
                {formatTokens(row.outputTokens)}
              </TableCell>
              <TableCell className={`${CELL} font-medium`} title={(row.inputTokens + row.outputTokens).toLocaleString()}>
                {formatTokens(row.inputTokens + row.outputTokens)}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </section>
  );
}
