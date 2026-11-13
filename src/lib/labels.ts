import type { AccountType, ChamaPermission, ChamaRole, Gender, IdDocumentType, LicenseFeature } from '@/api/types';
import { humanize } from './format';

// All user-facing enum labels in one place, so Swahili can be added later (README §8.6).
const overrides: Record<string, string> = {
  MPESA: 'M-Pesa',
  MOBILE_MONEY: 'Mobile money (M-Pesa)',
  MONEY_MARKET_FUND: 'Money market fund',
  SACCO_SHARES: 'SACCO shares',
  TREASURY_BILL: 'Treasury bill',
  TREASURY_BOND: 'Treasury bond',
  FIXED_DEPOSIT: 'Fixed deposit',
  LATE_CONTRIBUTION: 'Late contribution',
  PENDING_GUARANTORS: 'Waiting for guarantors',
  PENDING_APPROVAL: 'Waiting for approval',
  PARTIALLY_PAID: 'Part paid',
  PARTLY_PAID: 'Part paid',
  REINVESTED: 'Reinvested',
  SHARE_CAPITAL: 'Share capital',
  SMS_NOTIFICATIONS: 'SMS notifications',
  LOAN_DISBURSEMENT: 'Loan disbursement',
  OPENING_BALANCE: 'Opening balance',
  CASH: 'Cash',
  BANK: 'Bank',
  NATIONAL_ID: 'National ID',
  ALIEN_ID: 'Alien ID',
  MEMBER_KYC_RECORDED: 'Member KYC recorded',
  MEMBER_KYC_UPDATED: 'Member KYC updated',
};

/** Human label for any enum value. Unknown values are title-cased. */
export const label = (value: string | null | undefined) => (value ? overrides[value] ?? humanize(value) : '—');

export const PAYMENT_METHODS = ['CASH', 'BANK', 'MPESA'] as const;

export const ROLES: ChamaRole[] = ['MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRPERSON', 'AUDITOR', 'ADMIN'];
export const OFFICIAL_ROLES: ChamaRole[] = ['TREASURER', 'SECRETARY', 'CHAIRPERSON', 'AUDITOR', 'ADMIN'];

export const ID_DOCUMENT_TYPES: IdDocumentType[] = ['NATIONAL_ID', 'PASSPORT', 'ALIEN_ID'];
export const GENDERS: Gender[] = ['FEMALE', 'MALE', 'OTHER'];

/** Kenya's 47 counties, for the KYC address. */
export const KENYAN_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru', 'Nandi',
  'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
] as const;

export const FEATURE_LABELS: Record<LicenseFeature, string> = {
  CONTRIBUTIONS: 'Contributions & savings',
  PENALTIES: 'Penalties',
  EXPENSES: 'Expenses',
  LOANS: 'Loans',
  INVESTMENTS: 'Investments',
  REPORTS: 'Reports',
  MPESA: 'M-Pesa',
  SMS_NOTIFICATIONS: 'SMS notifications',
};

/** What each permission unlocks (README §2.3), grouped by area for the roles matrix. */
export const PERMISSION_GROUPS: { area: string; permissions: { key: ChamaPermission; unlocks: string }[] }[] = [
  {
    area: 'Chama',
    permissions: [
      { key: 'CHAMA_VIEW', unlocks: 'Chama profile, licence' },
      { key: 'CHAMA_SETTINGS_MANAGE', unlocks: 'Chama settings, opening-balance import' },
    ],
  },
  {
    area: 'Members',
    permissions: [
      { key: 'MEMBER_VIEW', unlocks: 'Member directory, roles list' },
      { key: 'MEMBER_INVITE', unlocks: 'Add members, invite by email, keep KYC details' },
      { key: 'MEMBER_APPROVE', unlocks: 'Approve/reject applications' },
      { key: 'MEMBER_SUSPEND', unlocks: 'Suspend/reactivate' },
      { key: 'MEMBER_ROLES_MANAGE', unlocks: "Change a member's roles" },
      { key: 'ROLE_PERMISSIONS_MANAGE', unlocks: 'Edit role → permission mapping' },
    ],
  },
  {
    area: 'Contributions & savings',
    permissions: [
      { key: 'CONTRIBUTION_VIEW_ALL', unlocks: 'All payments, periods, standings' },
      { key: 'CONTRIBUTION_RECORD', unlocks: 'Record a payment' },
      { key: 'CONTRIBUTION_REVERSE', unlocks: 'Reverse a payment' },
      { key: 'PRODUCTS_MANAGE', unlocks: 'Savings and loan products' },
      { key: 'MEMBER_ACCOUNTS_VIEW_ALL', unlocks: "Every member's accounts" },
      { key: 'MEMBER_ACCOUNTS_MANAGE', unlocks: 'Open/close/reopen accounts' },
    ],
  },
  {
    area: 'Loans',
    permissions: [
      { key: 'LOAN_APPLY', unlocks: 'Eligibility, apply' },
      { key: 'LOAN_VIEW_ALL', unlocks: 'Loan book' },
      { key: 'LOAN_APPROVE', unlocks: 'Approve/reject loans' },
      { key: 'LOAN_DISBURSE', unlocks: 'Disburse' },
      { key: 'LOAN_REPAYMENT_RECORD', unlocks: 'Record repayments' },
    ],
  },
  {
    area: 'Penalties',
    permissions: [
      { key: 'PENALTY_VIEW_ALL', unlocks: 'All penalties' },
      { key: 'PENALTY_RECORD', unlocks: 'Fine, record payment, run assessment' },
      { key: 'PENALTY_WAIVE', unlocks: 'Waive' },
    ],
  },
  {
    area: 'Expenses',
    permissions: [
      { key: 'EXPENSE_VIEW', unlocks: 'Expenses list/summary' },
      { key: 'EXPENSE_CREATE', unlocks: 'Record, cancel, pay' },
      { key: 'EXPENSE_APPROVE', unlocks: 'Approve/reject' },
    ],
  },
  {
    area: 'Investments',
    permissions: [
      { key: 'INVESTMENT_VIEW', unlocks: 'Investments, portfolio' },
      { key: 'INVESTMENT_MANAGE', unlocks: 'Propose, fund, record activity, close' },
      { key: 'INVESTMENT_APPROVE', unlocks: 'Approve/reject' },
    ],
  },
  {
    area: 'Books & reports',
    permissions: [
      { key: 'LEDGER_VIEW', unlocks: 'Chart, journal, statements, trial balance' },
      { key: 'LEDGER_POST', unlocks: 'Manual entries, reversals' },
      { key: 'LEDGER_ACCOUNTS_MANAGE', unlocks: 'Add/deactivate accounts' },
      { key: 'REPORT_VIEW_ALL', unlocks: 'Chama dashboard, all reports' },
      { key: 'AUDIT_LOG_VIEW', unlocks: 'Audit log' },
    ],
  },
];

/** The chairperson can never lose these (ROLE_PERMISSIONS_LOCKOUT). */
export const CHAIR_LOCKED: ChamaPermission[] = ['MEMBER_ROLES_MANAGE', 'ROLE_PERMISSIONS_MANAGE'];

/** Ledger account types in statement order, with their group headings. */
export const ACCOUNT_TYPES: { type: AccountType; label: string }[] = [
  { type: 'ASSET', label: 'Assets' },
  { type: 'LIABILITY', label: 'Liabilities' },
  { type: 'EQUITY', label: 'Equity' },
  { type: 'INCOME', label: 'Income' },
  { type: 'EXPENSE', label: 'Expenses' },
];
