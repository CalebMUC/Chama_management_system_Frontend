import type { LucideIcon } from 'lucide-react';
import {
  Activity, ArrowLeftRight, BadgeCheck, BarChart3, BookOpen, Building2, CalendarRange, CircleDollarSign, ClipboardList, FileSpreadsheet,
  FileText, Gavel, HandCoins, Handshake, Home, Inbox, Landmark, LayoutDashboard, Layers, ListChecks, PiggyBank, Plus, Receipt, ReceiptText, Scale, ScrollText, Send,
  Settings2, ShieldCheck, TrendingUp, Upload, UserRound, Users, Wallet,
} from 'lucide-react';
import type { ChamaPermission, LicenseFeature } from '@/api/types';
import type { Requirement } from '@/hooks/useSessionInfo';

/** A live count beside an item, from GET /dashboard `pending` and GET /dashboard/me `loans.guaranteeRequests`. */
export type BadgeKey = 'applications' | 'loans' | 'expenses' | 'investments' | 'guarantees' | 'payments';

/** Who may review reported payments: any of the record permissions (each reviews its own kind). */
export const REVIEW_PERMISSIONS: ChamaPermission[] = ['CONTRIBUTION_RECORD', 'PENALTY_RECORD', 'LOAN_REPAYMENT_RECORD'];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** 'member' = any ACTIVE membership. Default 'member'. */
  permission?: Requirement;
  feature?: LicenseFeature;
  badge?: BadgeKey;
  /** Matches only this exact path (so /investments doesn't light up on /investments/portfolio). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Workspaces split member self-service from back-office work. Presentation only: which items a user sees is still decided by
 * each item's permission and feature.
 */
export type WorkspaceId = 'banking' | 'operations';
export interface Workspace {
  id: WorkspaceId;
  label: string;
  /** Labels of the navigation groups in this workspace. */
  groups: string[];
}
export const workspaces: Workspace[] = [
  { id: 'banking', label: 'My banking', groups: ['Me'] },
  { id: 'operations', label: 'Operations', groups: ['Chama', 'Money', 'Books', 'Settings'] },
];
export const workspaceOf = (groupLabel: string): Workspace | null => workspaces.find((w) => w.groups.includes(groupLabel)) ?? null;

// README §6.2. Each item is shown only when its permission and licence feature checks pass; empty groups are hidden.
export const navigation: NavGroup[] = [
  {
    label: 'Me',
    items: [
      { label: 'Home', href: '/home', icon: Home },
      { label: 'My savings', href: '/me/savings', icon: PiggyBank, feature: 'CONTRIBUTIONS' },
      { label: 'My contributions', href: '/me/contributions', icon: CalendarRange, feature: 'CONTRIBUTIONS' },
      { label: 'My loans', href: '/me/loans', icon: HandCoins, feature: 'LOANS' },
      { label: 'Guarantee requests', href: '/me/guarantees', icon: Handshake, feature: 'LOANS', badge: 'guarantees' },
      { label: 'My penalties', href: '/me/penalties', icon: Gavel, feature: 'PENALTIES' },
      { label: 'My statement', href: '/me/statement', icon: FileText, feature: 'REPORTS' },
      { label: 'Report a payment', href: '/me/payments/new', icon: Send, permission: 'PAYMENT_SUBMIT' },
      { label: 'My reported payments', href: '/me/payments', icon: ReceiptText, exact: true },
    ],
  },
  {
    label: 'Chama',
    items: [
      { label: 'Overview', href: '/chama', icon: LayoutDashboard, permission: 'CHAMA_VIEW' },
      { label: 'Members', href: '/members', icon: Users, permission: 'MEMBER_VIEW', badge: 'applications' },
      { label: 'Expenses', href: '/expenses', icon: Receipt, permission: 'EXPENSE_VIEW', feature: 'EXPENSES', badge: 'expenses' },
      { label: 'Investments', href: '/investments', icon: TrendingUp, permission: 'INVESTMENT_VIEW', feature: 'INVESTMENTS', badge: 'investments', exact: true },
      { label: 'Portfolio', href: '/investments/portfolio', icon: BarChart3, permission: 'INVESTMENT_VIEW', feature: 'INVESTMENTS' },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Contributions', href: '/contributions', icon: Wallet, permission: 'CONTRIBUTION_VIEW_ALL', feature: 'CONTRIBUTIONS', exact: true },
      { label: 'Periods', href: '/contributions/periods', icon: CalendarRange, permission: 'CONTRIBUTION_VIEW_ALL', feature: 'CONTRIBUTIONS' },
      { label: 'Standings', href: '/contributions/standings', icon: ListChecks, permission: 'CONTRIBUTION_VIEW_ALL', feature: 'CONTRIBUTIONS' },
      { label: 'Payments to confirm', href: '/payment-submissions', icon: Inbox, permission: REVIEW_PERMISSIONS, badge: 'payments' },
      { label: 'Member accounts', href: '/member-accounts', icon: Landmark, permission: 'MEMBER_ACCOUNTS_VIEW_ALL', feature: 'CONTRIBUTIONS' },
      { label: 'Loans', href: '/loans', icon: CircleDollarSign, permission: 'LOAN_VIEW_ALL', feature: 'LOANS', badge: 'loans' },
      { label: 'Penalties', href: '/penalties', icon: Gavel, permission: 'PENALTY_VIEW_ALL', feature: 'PENALTIES' },
    ],
  },
  {
    label: 'Books',
    items: [
      { label: 'Chart of accounts', href: '/ledger/accounts', icon: BookOpen, permission: 'LEDGER_VIEW' },
      { label: 'Journal', href: '/ledger/journal', icon: ArrowLeftRight, permission: 'LEDGER_VIEW' },
      { label: 'Trial balance', href: '/ledger/trial-balance', icon: Scale, permission: 'LEDGER_VIEW' },
      { label: 'Reports', href: '/reports', icon: FileSpreadsheet, permission: 'REPORT_VIEW_ALL', feature: 'REPORTS' },
      { label: 'Audit log', href: '/audit-log', icon: ScrollText, permission: 'AUDIT_LOG_VIEW' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Chama profile & rules', href: '/settings/chama', icon: Settings2, permission: 'CHAMA_VIEW' },
      { label: 'Licence', href: '/settings/licence', icon: BadgeCheck, permission: 'CHAMA_VIEW' },
      { label: 'Roles & permissions', href: '/settings/roles', icon: ShieldCheck, permission: 'MEMBER_VIEW' },
      { label: 'Savings products', href: '/settings/savings-products', icon: Layers, feature: 'CONTRIBUTIONS' },
      { label: 'Loan products', href: '/settings/loan-products', icon: ClipboardList, feature: 'LOANS' },
      { label: 'Import opening balances', href: '/settings/import', icon: Upload, permission: 'CHAMA_SETTINGS_MANAGE' },
    ],
  },
];

export const platformNavigation: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Chamas', href: '/platform', icon: Building2, exact: true },
      { label: 'Onboard a chama', href: '/platform/chamas/new', icon: Plus },
    ],
  },
];

/**
 * The "+ New" transaction menu and the command palette's New group: actions, not places, so they live here rather than in the
 * sidebar. Each is gated like the screen it opens. `href` routes to an existing page; `dialog` opens an existing dialog.
 */
export interface NewAction {
  id: 'contribution' | 'repayment' | 'expense' | 'journal' | 'report';
  label: string;
  icon: LucideIcon;
  permission: ChamaPermission;
  feature?: LicenseFeature;
  href?: string;
  dialog?: 'repayment' | 'expense';
}
export const newActions: NewAction[] = [
  { id: 'contribution', label: 'Record contribution', icon: Wallet, permission: 'CONTRIBUTION_RECORD', feature: 'CONTRIBUTIONS', href: '/contributions/new' },
  { id: 'repayment', label: 'Record loan repayment', icon: HandCoins, permission: 'LOAN_REPAYMENT_RECORD', feature: 'LOANS', dialog: 'repayment' },
  { id: 'expense', label: 'New expense', icon: Receipt, permission: 'EXPENSE_CREATE', feature: 'EXPENSES', dialog: 'expense' },
  { id: 'journal', label: 'Post journal entry', icon: ArrowLeftRight, permission: 'LEDGER_POST', href: '/ledger/journal/new' },
  // Every member may report a payment they made themselves; the treasurer confirms it.
  { id: 'report', label: 'Report a payment I made', icon: Send, permission: 'PAYMENT_SUBMIT', href: '/me/payments/new' },
];

/** The bottom tab bar on phones. Same features as the matching sidebar items; "More" opens the full menu. */
export const mobileTabs: NavItem[] = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Accounts', href: '/me/savings', icon: PiggyBank, feature: 'CONTRIBUTIONS' },
  { label: 'Loans', href: '/me/loans', icon: HandCoins, feature: 'LOANS' },
  { label: 'Statement', href: '/me/statement', icon: FileText, feature: 'REPORTS' },
];

export const accountNavigation: NavItem[] = [
  { label: 'Profile & security', href: '/profile', icon: UserRound },
  { label: 'Activity', href: '/audit-log', icon: Activity, permission: 'AUDIT_LOG_VIEW' },
];
