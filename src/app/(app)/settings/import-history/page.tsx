'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Download, FileSpreadsheet, Undo2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { historyImportsApi, importsApi } from '@/api/endpoints/books';
import { loansApi } from '@/api/endpoints/loans';
import { normaliseError } from '@/api/errors';
import type { HistoryBatchView, HistoryImportKind, HistoryPreviewView, HistorySummaryLine, HistoryTableView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader, Section } from '@/components/shared/Display';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { ImportProblems } from '@/features/imports/ImportProblems';
import { cn } from '@/lib/utils';
import { formatDate, formatInstant, formatInstantDate } from '@/lib/format';

const MAX_BYTES = 5 * 1024 * 1024;

interface Step {
  kind: HistoryImportKind;
  title: string;
  what: string;
}

/** In the order they are imported: the setup decides what every member owed, so it comes first. */
const STEPS: Step[] = [
  { kind: 'SETUP', title: 'Setup', what: 'When each member really joined, and what each member owed per contribution period over the years.' },
  { kind: 'CONTRIBUTIONS', title: 'Contributions', what: 'Every contribution payment since the chama started. You can split them over several files, e.g. one per year.' },
  { kind: 'LOANS', title: 'Loans', what: 'Every loan, repaid or not, and every repayment. Loans still being repaid carry on with their schedule.' },
  { kind: 'PENALTIES', title: 'Penalties', what: 'Penalties and fines as you recorded them, with what was paid and waived. The system never charges those years itself.' },
  { kind: 'INVESTMENTS', title: 'Investments', what: 'What the chama invested in, and everything that happened to each investment since.' },
  { kind: 'EXPENSES', title: 'Expenses', what: 'Running costs the chama paid: bank charges, venues, fees, an investment’s bills.' },
  { kind: 'RECONCILIATION', title: 'Check the balances', what: 'The real cash, bank and M-Pesa balances, so the books match your statements. Do this last.' },
];

export default function ImportHistoryPage() {
  return (
    <Guard permission="CHAMA_SETTINGS_MANAGE">
      <HistoryImport />
    </Guard>
  );
}

function HistoryImport() {
  const opening = useQuery({ queryKey: ['imports', 'status'], queryFn: importsApi.status });
  const batches = useQuery({ queryKey: ['imports', 'history'], queryFn: historyImportsApi.batches });
  const [active, setActive] = useState<HistoryImportKind | null>(null);

  const done = useMemo(() => {
    const counts = new Map<HistoryImportKind, number>();
    for (const b of batches.data ?? []) if (!b.undoneAt) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
    return counts;
  }, [batches.data]);
  const next = STEPS.find((s) => !done.has(s.kind))?.kind ?? 'RECONCILIATION';

  // Open the next step to do once we know what is done.
  useEffect(() => {
    if (batches.data && active === null) setActive(next);
  }, [batches.data, active, next]);

  if (opening.error) return <ErrorState error={opening.error} onRetry={() => opening.refetch()} />;
  if (batches.error) return <ErrorState error={batches.error} onRetry={() => batches.refetch()} />;
  if (!opening.data || !batches.data) return <LoadingState />;

  const header = (
    <PageHeader
      title="Import history"
      description="Bring in your chama's records from before it used the system, one Excel file per step. Nothing is emailed to members while you import."
    />
  );
  if (opening.data.data) {
    return (
      <div className="space-y-5">
        {header}
        <Alert variant="warning">
          <XCircle />
          <AlertTitle>Opening balances were imported</AlertTitle>
          <AlertDescription>
            This chama&apos;s opening balances were imported as at {formatDate(opening.data.data.asOf)}, so its history can&apos;t be
            imported as well: savings would be counted twice. See <Link href="/settings/import" className="text-primary underline">Import opening balances</Link>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const setupDone = done.has('SETUP');
  const current = STEPS.find((s) => s.kind === (active ?? next))!;
  return (
    <div className="space-y-5">
      {header}
      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <nav aria-label="Steps" className="h-fit rounded-lg border bg-card p-2">
          <ol className="space-y-0.5">
            {STEPS.map((s, i) => {
              const count = done.get(s.kind) ?? 0;
              const selected = s.kind === current.kind;
              return (
                <li key={s.kind}>
                  <button
                    type="button"
                    onClick={() => setActive(s.kind)}
                    aria-current={selected ? 'step' : undefined}
                    className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted', selected && 'bg-muted font-medium')}
                  >
                    {count > 0 ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <CircleDashed className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="flex-1">{i + 1}. {s.title}</span>
                    {count > 1 && <Badge variant="secondary">{count} files</Badge>}
                    {s.kind === next && count === 0 && <Badge variant="info">Next</Badge>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <StepPanel key={current.kind} step={current} number={STEPS.indexOf(current) + 1} blocked={current.kind !== 'SETUP' && !setupDone} />
      </div>
      <Batches batches={batches.data} />
    </div>
  );
}

function StepPanel({ step, number, blocked }: { step: Step; number: number; blocked: boolean }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HistoryPreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState<'template' | 'schedules' | null>(null);
  const [inputKey, setInputKey] = useState(0);

  function pick(f: File | null) {
    setPreview(null);
    setError(null);
    setFileError(null);
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) return setFileError('Choose the .xlsx template file.');
    if (f && f.size > MAX_BYTES) return setFileError('The file is larger than 5 MB: split it, e.g. one file per year.');
    setFile(f);
  }

  async function runPreview() {
    if (!file) return setFileError('Choose a file.');
    setBusy(true);
    setError(null);
    try {
      setPreview((await historyImportsApi.preview(step.kind, file)).data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) return;
    await historyImportsApi.run(step.kind, file);
    toast.success(`${step.title} imported.`);
    setFile(null);
    setPreview(null);
    setInputKey((k) => k + 1);
    // Members' standings, loans, the books: everything may have changed.
    await qc.invalidateQueries();
  }

  async function download(what: 'template' | 'schedules') {
    setDownloading(what);
    try {
      if (what === 'template') await historyImportsApi.template(step.kind);
      else await loansApi.schedules();
    } catch (e) {
      toast.error(normaliseError(e).message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Section title={`Step ${number} of ${STEPS.length}: ${step.title}`} description={step.what}>
      <div className="space-y-5">
        {blocked && (
          <Alert variant="info">
            <CircleDashed />
            <AlertTitle>Import the setup first</AlertTitle>
            <AlertDescription>Step 1 decides when members joined and what they owed; every other step depends on it.</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download('template')} loading={downloading === 'template'}><Download />Download the template</Button>
          {step.kind === 'LOANS' && (
            <Button variant="outline" onClick={() => download('schedules')} loading={downloading === 'schedules'}><Download />Download loan schedules</Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          The template lists your members and products and explains every column on its <em>Read me</em> sheet. Fill it in, save it as .xlsx and
          check it here: every row is checked and nothing is saved until you import.
        </p>
        <div className="space-y-3">
          <FormAlert error={error} />
          <div className="space-y-1.5">
            <Label htmlFor="history-file">Filled-in template (.xlsx, up to 5 MB)</Label>
            <Input key={inputKey} id="history-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-invalid={!!fileError} />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
          <Button onClick={runPreview} loading={busy} disabled={!file}><FileSpreadsheet />Check the file</Button>
        </div>
        {preview && <Preview preview={preview} onImport={() => setConfirming(true)} />}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Import ${step.title.toLowerCase()}?`}
        description={<>All {preview?.rows ?? 0} rows go in together, posted to the books on their own dates. Nobody is emailed. You can undo this import while it is the latest one.</>}
        confirmLabel="Import now"
        onConfirm={runImport}
      />
    </Section>
  );
}

function Preview({ preview, onImport }: { preview: HistoryPreviewView; onImport: () => void }) {
  const hidden = preview.errors + preview.warnings - preview.problems.length;
  return (
    <div className="space-y-5 border-t pt-5">
      {preview.importable ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Ready to import {preview.rows} row{preview.rows === 1 ? '' : 's'}</AlertTitle>
          <AlertDescription>{preview.warnings ? `${preview.warnings} warning${preview.warnings === 1 ? '' : 's'} to read below; they don't block the import.` : 'No problems found.'}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <XCircle />
          <AlertTitle>{preview.errors} error{preview.errors === 1 ? '' : 's'} to fix</AlertTitle>
          <AlertDescription>Correct the rows below in your file and check it again. Nothing was saved.</AlertDescription>
        </Alert>
      )}
      {preview.summary.length > 0 && <Summary lines={preview.summary} />}
      {preview.importable && preview.tables.map((t) => <ResultTable key={t.title} table={t} />)}
      {preview.problems.length > 0 && (
        <div className="space-y-2">
          <ImportProblems problems={preview.problems} />
          {hidden > 0 && <p className="text-sm text-muted-foreground">And {hidden} more: fix these and check again to see the rest.</p>}
        </div>
      )}
      {preview.importable && (
        <div className="flex justify-end"><Button onClick={onImport}><Upload />Import</Button></div>
      )}
    </div>
  );
}

function Summary({ lines }: { lines: HistorySummaryLine[] }) {
  return (
    <DetailList
      columns={4}
      items={lines.map((l) => ({
        label: l.label,
        value: l.type === 'DATE' && l.text ? formatDate(l.text) : <span className={l.type === 'AMOUNT' ? 'tabular' : undefined}>{l.text ?? '—'}</span>,
      }))}
    />
  );
}

/** A preview table from the server, cells already formatted. Amount-looking columns are right-aligned. */
function ResultTable({ table }: { table: HistoryTableView }) {
  if (table.rows.length === 0) return null;
  const numeric = table.columns.map((_, i) => table.rows.every((r) => !r[i] || /^[+-]?(KES|[A-Z]{3}) |^\d+$/.test(r[i])));
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold">{table.title}</h3>
      <div className="max-h-[28rem] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {table.columns.map((c, i) => <TableHead key={c} className={cn('whitespace-nowrap', numeric[i] && 'text-right')}>{c}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((cell, j) => <TableCell key={j} className={cn('whitespace-nowrap', numeric[j] && 'tabular text-right')}>{cell || '—'}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Batches({ batches }: { batches: HistoryBatchView[] }) {
  const qc = useQueryClient();
  const [undoing, setUndoing] = useState<HistoryBatchView | null>(null);
  const title = (kind: HistoryImportKind) => STEPS.find((s) => s.kind === kind)?.title ?? kind;

  async function undo() {
    if (!undoing) return;
    await historyImportsApi.undo(undoing.id);
    toast.success(`${title(undoing.kind)} import undone.`);
    await qc.invalidateQueries();
  }

  return (
    <Section title="Imports so far" description="Newest first. Only the latest import can be undone; undo later ones first.">
      {batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing imported yet. Start with step 1.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Step</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Totals</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id} className={cn(b.undoneAt && 'text-muted-foreground')}>
                  <TableCell className="whitespace-nowrap font-medium">{title(b.kind)}</TableCell>
                  <TableCell className="max-w-48 truncate" title={b.fileName ?? undefined}>{b.fileName ?? '—'}</TableCell>
                  <TableCell className="tabular text-right">{b.rowCount}</TableCell>
                  <TableCell className="text-sm">{b.summary.map((l) => `${l.label}: ${l.type === 'DATE' && l.text ? formatDate(l.text) : l.text}`).join(' · ')}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatInstant(b.importedAt)}{b.importedByName ? ` by ${b.importedByName}` : ''}</TableCell>
                  <TableCell className="text-right">
                    {b.undoneAt ? (
                      <Badge variant="secondary">Undone {formatInstantDate(b.undoneAt)}</Badge>
                    ) : b.undoable ? (
                      <Button size="sm" variant="outline" onClick={() => setUndoing(b)}><Undo2 />Undo</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground" title={b.undoBlockedReason ?? undefined}>Kept</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDialog
        open={!!undoing}
        onOpenChange={(open) => !open && setUndoing(null)}
        title={undoing ? `Undo the ${title(undoing.kind).toLowerCase()} import?` : ''}
        description={<>What it created is removed and its entries in the books are reversed, each on its original date. The import stays listed here as undone.</>}
        confirmLabel="Undo import"
        destructive
        onConfirm={undo}
      />
    </Section>
  );
}
