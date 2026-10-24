import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HEAD = 'h-10 px-4 text-xs font-medium text-muted-foreground';

// The table shell shared by the lists: a bordered block, a lighter header row, and rows that bring their own cells.
// A column with no visible name (a row's actions) is given `srOnly`, so a screen reader still hears what it is.
export function DataTable({
  columns,
  children,
}: {
  columns: ReadonlyArray<{ label: string; srOnly?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-secondary hover:bg-secondary">
            {columns.map((column) => (
              <TableHead key={column.label} className={HEAD}>
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
