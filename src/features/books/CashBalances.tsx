'use client';

import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@/api/endpoints/books';
import { MoneyText } from '@/components/shared/Display';
import { usePermission } from '@/hooks/useSessionInfo';

/** Payment method → the ledger account the money comes from (CASH 1000, BANK 1010, MPESA 1020). */
const CASH_CODES = [
  { code: '1000', label: 'Cash on hand' },
  { code: '1010', label: 'Bank' },
  { code: '1020', label: 'M-Pesa' },
];

/**
 * What cash, bank and M-Pesa hold, for money-out dialogs (disburse, pay, fund). Shown only with LEDGER_VIEW; the server still
 * refuses with *_INSUFFICIENT_FUNDS and a message naming the available amount.
 */
export function CashBalances() {
  const allowed = usePermission('LEDGER_VIEW');
  const q = useQuery({ queryKey: ['ledger', 'accounts'], queryFn: ledgerApi.accounts, enabled: allowed });
  if (!allowed || !q.data) return null;
  const rows = CASH_CODES.map((c) => ({ ...c, account: q.data!.find((a) => a.code === c.code) })).filter((r) => r.account);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-3 text-sm">
      {rows.map((r) => (
        <div key={r.code}>
          <p className="text-xs text-muted-foreground">{r.label}</p>
          <MoneyText value={r.account!.balanceMinor} currency={r.account!.currency} className="font-medium" />
        </div>
      ))}
    </div>
  );
}
