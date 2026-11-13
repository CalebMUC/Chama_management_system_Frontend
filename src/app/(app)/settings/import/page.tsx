'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, History, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { importsApi } from '@/api/endpoints/books';
import { normaliseError } from '@/api/errors';
import type { ImportPreviewView, ImportSummaryView, ImportView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, EntryLink, MoneyText, PageHeader, Section } from '@/components/shared/Display';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Input, Label } from '@/components/ui/primitives';
import { ImportProblems } from '@/features/imports/ImportProblems';
import { useMemberDirectory } from '@/hooks/useMembers';
import { formatDate, formatInstant, todayNairobi } from '@/lib/format';

const MAX_BYTES = 5 * 1024 * 1024;

export default function ImportPage() {
  return (
    <Guard permission="CHAMA_SETTINGS_MANAGE">
      <ImportWizard />
    </Guard>
  );
}

/** README §7.15: the one-time opening-balance import. Preview first; errors block, warnings don't. */
function ImportWizard() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['imports', 'status'], queryFn: importsApi.status });
  const [file, setFile] = useState<File | null>(null);
  const [asOf, setAsOf] = useState(todayNairobi());
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (status.error) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  if (!status.data) return <LoadingState />;
  if (status.data.data) return <Completed imp={status.data.data} />;

  function pick(f: File | null) {
    setPreview(null);
    setError(null);
    setFileError(null);
    if (f && !f.name.toLowerCase().endsWith('.xlsx')) return setFileError('Choose the .xlsx template file.');
    if (f && f.size > MAX_BYTES) return setFileError('The file is larger than 5 MB.');
    setFile(f);
  }

  async function runPreview() {
    if (!file) return setFileError('Choose a file.');
    setBusy(true);
    setError(null);
    try {
      setPreview((await importsApi.preview(file, asOf)).data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) return;
    const res = await importsApi.run(file, asOf);
    toast.success(res.message || 'Opening balances imported.');
    // Everything changed: reload every cached area.
    await qc.invalidateQueries();
  }

  async function template() {
    setDownloading(true);
    try {
      await importsApi.template();
    } catch (e) {
      toast.error(normaliseError(e).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Import opening balances" description="Bring your chama's existing records in when you start using the system. This can be done only once." />
      <Alert variant="info">
        <History />
        <AlertTitle>Want the full history instead?</AlertTitle>
        <AlertDescription>
          Opening balances bring in totals as at one day. To bring in every contribution, loan, penalty, investment and expense since
          the chama started, use <Link href="/settings/import-history" className="text-primary underline">Import history</Link>. Use one or the other, not both.
        </AlertDescription>
      </Alert>
      <Section title="1. Prepare the file">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Create your savings products first in <Link href="/settings/savings-products" className="text-primary underline">Settings → Savings products</Link>; the template refers to them by code.</li>
          <li>Download the template and fill in members, savings balances, loans, penalties, cash and investments as at your cut-over date.</li>
        </ol>
        <Button variant="outline" className="mt-3" onClick={template} loading={downloading}><Download />Download template</Button>
      </Section>
      <Section title="2. Upload and check">
        <div className="space-y-4">
          <FormAlert error={error} />
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">Filled-in template (.xlsx, up to 5 MB)</Label>
              <Input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-invalid={!!fileError} />
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-asof">Cut-over date</Label>
              <Input id="import-asof" type="date" max={todayNairobi()} value={asOf} onChange={(e) => { setAsOf(e.target.value); setPreview(null); }} />
            </div>
          </div>
          <Button onClick={runPreview} loading={busy} disabled={!file}><FileSpreadsheet />Check the file</Button>
        </div>
      </Section>
      {preview && (
        <Section title="3. Review">
          <div className="space-y-5">
            {preview.importable ? (
              <Alert variant="success"><CheckCircle2 /><AlertTitle>Ready to import</AlertTitle><AlertDescription>{preview.warnings ? `${preview.warnings} warning${preview.warnings === 1 ? '' : 's'} to read below; they don't block the import.` : 'No problems found.'}</AlertDescription></Alert>
            ) : (
              <Alert variant="destructive"><XCircle /><AlertTitle>{preview.errors} error{preview.errors === 1 ? '' : 's'} to fix</AlertTitle><AlertDescription>Correct the file and check it again.</AlertDescription></Alert>
            )}
            {preview.summary && <Summary s={preview.summary} />}
            {preview.problems.length > 0 && <ImportProblems problems={preview.problems} />}
            {preview.importable && (
              <div className="flex justify-end"><Button onClick={() => setConfirming(true)}><Upload />Import</Button></div>
            )}
          </div>
        </Section>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Import these opening balances?"
        description={<>This can be done <strong>only once</strong> and can&apos;t be undone. New members will be emailed a link to set their password.</>}
        confirmLabel="Import now"
        destructive
        onConfirm={runImport}
      />
    </div>
  );
}

function Summary({ s }: { s: ImportSummaryView }) {
  const c = s.currency;
  return (
    <DetailList
      columns={4}
      items={[
        { label: 'New members', value: s.newMembers },
        { label: 'Existing members', value: s.existingMembers },
        { label: 'Savings', value: <MoneyText value={s.savingsMinor} currency={c} /> },
        { label: 'Loans', value: <>{s.loans} · <MoneyText value={s.loansOutstandingMinor} currency={c} /></> },
        { label: 'Penalties', value: <MoneyText value={s.penaltiesMinor} currency={c} /> },
        { label: 'Cash on hand', value: <MoneyText value={s.cashMinor} currency={c} /> },
        { label: 'Bank', value: <MoneyText value={s.bankMinor} currency={c} /> },
        { label: 'M-Pesa', value: <MoneyText value={s.mobileMoneyMinor} currency={c} /> },
        { label: 'Investments', value: <>{s.investments} · <MoneyText value={s.investmentsMinor} currency={c} /></> },
        { label: 'Retained surplus', value: <MoneyText value={s.retainedSurplusMinor} currency={c} /> },
      ]}
    />
  );
}

function Completed({ imp }: { imp: ImportView }) {
  const directory = useMemberDirectory();
  return (
    <div className="space-y-5">
      <PageHeader title="Opening balances" description="Your opening balances have been imported. Imports happen only once." />
      <Section title={`Imported as of ${formatDate(imp.asOf)}`}>
        <div className="space-y-4">
          <DetailList
            columns={3}
            items={[
              { label: 'File', value: imp.fileName ?? '—' },
              { label: 'Imported', value: `${formatInstant(imp.importedAt)} by ${directory.nameOf(imp.importedBy)}` },
              { label: 'Opening entry', value: <EntryLink id={imp.ledgerEntryId} /> },
            ]}
          />
          <Summary s={imp.summary} />
          <p className="text-sm text-muted-foreground">New members were emailed a link to set their password.</p>
        </div>
      </Section>
      {imp.warnings.length > 0 && <Section title="Warnings at import"><ImportProblems problems={imp.warnings} /></Section>}
    </div>
  );
}
