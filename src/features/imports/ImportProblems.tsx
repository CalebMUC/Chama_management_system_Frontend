'use client';

import { useMemo } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { ImportProblemView } from '@/api/types';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';

/** Problems found in an import file, grouped by sheet, each with its row and column as Excel shows them. */
export function ImportProblems({ problems }: { problems: ImportProblemView[] }) {
  const bySheet = useMemo(() => {
    const m = new Map<string, ImportProblemView[]>();
    for (const p of problems) m.set(p.sheet ?? 'Whole file', [...(m.get(p.sheet ?? 'Whole file') ?? []), p]);
    return [...m.entries()];
  }, [problems]);
  return (
    <div className="space-y-4">
      {bySheet.map(([sheet, list]) => (
        <div key={sheet} className="space-y-1.5">
          <h3 className="text-sm font-semibold">{sheet}</h3>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-28">Severity</TableHead>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead className="w-40">Column</TableHead>
                  <TableHead>Problem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.severity === 'ERROR' ? <Badge variant="destructive"><XCircle className="size-3" />Error</Badge> : <Badge variant="warning"><AlertTriangle className="size-3" />Warning</Badge>}</TableCell>
                    <TableCell className="tabular">{p.row ?? '—'}</TableCell>
                    <TableCell>{p.column ?? '—'}</TableCell>
                    <TableCell>{p.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
