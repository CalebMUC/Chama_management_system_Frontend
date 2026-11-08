'use client';

import { useState } from 'react';
import { auditApi } from '@/api/endpoints/books';
import { KNOWN_AUDIT_ACTIONS, type AuditLogEntry } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { NativeSelect } from '@/components/ui/primitives';
import { useMemberDirectory } from '@/hooks/useMembers';
import { usePaged } from '@/hooks/usePaged';
import { formatInstant, humanize } from '@/lib/format';

export default function AuditLogPage() {
  return (
    <Guard permission="AUDIT_LOG_VIEW">
      <AuditLog />
    </Guard>
  );
}

/** before/after pairs and nested values as readable text. */
function show(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Details({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details ?? {});
  if (!entries.length) return <p className="py-2 text-sm text-muted-foreground">No details recorded.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-1.5 py-2 text-sm sm:grid-cols-[minmax(10rem,max-content)_1fr]">
      {entries.map(([k, v]) => {
        const pair = v && typeof v === 'object' && !Array.isArray(v) && ('before' in (v as object) || 'after' in (v as object)) ? (v as { before?: unknown; after?: unknown }) : null;
        return (
          <div key={k} className="contents">
            <dt className="font-medium text-muted-foreground">{humanize(k.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase())}</dt>
            <dd className="break-all font-mono text-xs leading-5">
              {pair ? <><span className="text-destructive line-through">{show(pair.before)}</span> → <span className="text-success">{show(pair.after)}</span></> : show(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** README §7.14: paged; actor ids resolved to names; filter by exact action; expand a row for its details. */
function AuditLog() {
  const directory = useMemberDirectory();
  const [action, setAction] = useState('');
  const list = usePaged(['audit'], { action: action || undefined }, auditApi.list, { initialSize: 50 });
  const columns: ColumnDef<AuditLogEntry, unknown>[] = [
    { id: 'time', header: 'Time', accessorKey: 'occurredAt', cell: ({ row }) => <span className="whitespace-nowrap">{formatInstant(row.original.occurredAt)}</span> },
    { id: 'actor', header: 'Who', accessorFn: (e) => directory.nameOf(e.actorUserId) },
    { id: 'action', header: 'Action', accessorKey: 'action', cell: ({ row }) => <span className="font-medium">{humanize(row.original.action)}</span> },
    { id: 'target', header: 'Target', accessorKey: 'targetType', cell: ({ row }) => <span className="text-sm">{humanize(row.original.targetType)}{row.original.targetId && <span className="block max-w-[14rem] truncate font-mono text-[11px] text-muted-foreground">{row.original.targetId}</span>}</span> },
    { id: 'ip', header: 'IP', accessorFn: (e) => e.ipAddress ?? '', cell: ({ row }) => <span className="font-mono text-xs">{row.original.ipAddress ?? ''}</span> },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" description="Who did what, and when. Click a row to see the details." />
      <DataTable
        columns={columns}
        getRowId={(e) => e.id}
        renderExpanded={(e) => <Details details={e.details} />}
        emptyTitle="Nothing logged"
        toolbar={
          <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} className="w-64" aria-label="Action">
            <option value="">All actions</option>
            {[...KNOWN_AUDIT_ACTIONS].sort().map((a) => <option key={a} value={a}>{humanize(a)}</option>)}
          </NativeSelect>
        }
        csv={{
          fileName: 'audit-log',
          columns: [
            { header: 'Time', value: (e) => e.occurredAt },
            { header: 'Who', value: (e) => directory.nameOf(e.actorUserId) },
            { header: 'Action', value: (e) => e.action },
            { header: 'Target type', value: (e) => e.targetType },
            { header: 'Target id', value: (e) => e.targetId },
            { header: 'IP', value: (e) => e.ipAddress },
            { header: 'Details', value: (e) => JSON.stringify(e.details) },
          ],
        }}
        mobileCard={(e) => (
          <div>
            <p className="font-medium">{humanize(e.action)}</p>
            <p className="text-xs text-muted-foreground">{directory.nameOf(e.actorUserId)} · {formatInstant(e.occurredAt)}</p>
          </div>
        )}
        {...list.table}
      />
    </div>
  );
}
