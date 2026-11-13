// Mock API for the screenshot harness. Shapes follow src/api/types.ts; every response is wrapped in the API envelope by
// shots.mjs. Amounts are minor units (KES cents). Dates sit around the business date 2026-11-09.

const now = new Date();
const iso = (d) => d.toISOString();
const inDays = (n) => iso(new Date(now.getTime() + n * 86_400_000));
const KES = 'KES';
const CHAMA_ID = 'c0000000-0000-4000-8000-000000000001';

const ALL_PERMISSIONS = [
  'CHAMA_VIEW', 'CHAMA_SETTINGS_MANAGE', 'MEMBER_VIEW', 'MEMBER_INVITE', 'MEMBER_APPROVE', 'MEMBER_SUSPEND', 'MEMBER_ROLES_MANAGE',
  'ROLE_PERMISSIONS_MANAGE', 'CONTRIBUTION_VIEW_ALL', 'CONTRIBUTION_RECORD', 'CONTRIBUTION_REVERSE', 'LOAN_APPLY', 'LOAN_VIEW_ALL',
  'LOAN_APPROVE', 'LOAN_DISBURSE', 'LOAN_REPAYMENT_RECORD', 'PENALTY_VIEW_ALL', 'PENALTY_RECORD', 'PENALTY_WAIVE', 'EXPENSE_VIEW',
  'EXPENSE_CREATE', 'EXPENSE_APPROVE', 'INVESTMENT_VIEW', 'INVESTMENT_MANAGE', 'INVESTMENT_APPROVE', 'LEDGER_VIEW', 'LEDGER_POST',
  'LEDGER_ACCOUNTS_MANAGE', 'REPORT_VIEW_ALL', 'AUDIT_LOG_VIEW', 'PRODUCTS_MANAGE', 'MEMBER_ACCOUNTS_VIEW_ALL', 'MEMBER_ACCOUNTS_MANAGE',
  'PAYMENT_SUBMIT',
];
/** A plain member's default permissions (README §2.3): no MEMBER_VIEW, no REPORT_VIEW_ALL. */
const MEMBER_PERMISSIONS = ['CHAMA_VIEW', 'LOAN_APPLY', 'EXPENSE_VIEW', 'INVESTMENT_VIEW', 'PAYMENT_SUBMIT'];
const ALL_FEATURES = ['CONTRIBUTIONS', 'PENALTIES', 'EXPENSES', 'LOANS', 'INVESTMENTS', 'REPORTS', 'MPESA', 'SMS_NOTIFICATIONS'];

// ---- Members ------------------------------------------------------------------------------------------------------------

const NAMES = [
  ['Grace', 'Wanjiku'], ['Peter', 'Otieno'], ['Mercy', 'Achieng'], ['John', 'Kamau'], ['Faith', 'Njeri'], ['David', 'Mwangi'],
  ['Caleb', 'Kariuki'], ['Esther', 'Wambui'], ['Samuel', 'Kiprono'], ['Lucy', 'Atieno'], ['Joseph', 'Ochieng'], ['Ann', 'Nyambura'],
  ['Brian', 'Kipchumba'], ['Mary', 'Mutua'], ['Kevin', 'Omondi'], ['Joyce', 'Chebet'], ['Daniel', 'Kibet'], ['Rose', 'Akinyi'],
];
const pad = (n, w = 6) => String(n).padStart(w, '0');
const uid = (n) => `u0000000-0000-4000-8000-${pad(n, 12)}`;

export const members = NAMES.map(([first, last], i) => {
  const n = i + 1;
  const roles = n === 7 ? ['MEMBER', 'TREASURER'] : n === 1 ? ['MEMBER', 'CHAIRPERSON'] : n === 3 ? ['MEMBER', 'SECRETARY'] : ['MEMBER'];
  return {
    membershipId: `m0000000-0000-4000-8000-${pad(n, 12)}`,
    chamaId: CHAMA_ID,
    memberNumber: n,
    userId: uid(n),
    email: `${first}.${last}@example.co.ke`.toLowerCase(),
    firstName: first,
    lastName: last,
    phoneNumber: `+2547${pad(12345600 + n * 7919, 8)}`,
    emailVerified: true,
    status: n === 15 ? 'SUSPENDED' : 'ACTIVE',
    roles,
    appliedAt: '2024-02-01T07:00:00Z',
    joinedAt: '2024-02-03T07:00:00Z',
    suspensionReason: n === 15 ? 'Three months in arrears' : null,
  };
});
members.push(
  { ...members[0], membershipId: 'm-pending-1', userId: uid(91), memberNumber: null, firstName: 'Tabitha', lastName: 'Moraa', email: 'tabitha.moraa@example.co.ke', status: 'PENDING_APPROVAL', roles: ['MEMBER'], joinedAt: null, appliedAt: inDays(-2) },
  { ...members[0], membershipId: 'm-pending-2', userId: uid(92), memberNumber: null, firstName: 'Collins', lastName: 'Wafula', email: 'collins.wafula@example.co.ke', status: 'PENDING_APPROVAL', roles: ['MEMBER'], joinedAt: null, appliedAt: inDays(-1) },
);
const me = members[6];
const nameOf = (m) => `${m.firstName} ${m.lastName}`;

// ---- Session bootstrap --------------------------------------------------------------------------------------------------

export const authMe = {
  id: me.userId,
  chamaId: CHAMA_ID,
  chamaCode: 'umoja',
  email: me.email,
  emailVerified: true,
  phoneNumber: me.phoneNumber,
  firstName: me.firstName,
  lastName: me.lastName,
  roles: ['ROLE_USER'],
  createdAt: '2024-02-01T07:00:00Z',
};

const chama = {
  id: CHAMA_ID,
  code: 'umoja',
  name: 'Umoja Women & Men Investment Group',
  description: 'A savings and investment group in Nakuru.',
  currency: KES,
  status: 'ACTIVE',
  createdBy: members[0].userId,
  createdAt: '2024-01-15T07:00:00Z',
  settings: {
    contributionAmountMinor: 500_000, contributionFrequency: 'MONTHLY', contributionDueDay: 5, lateGraceDays: 5, latePenaltyBasisPoints: 200,
    loanMaxMultiplier: 3, loanInterestBasisPoints: 1_000, loanMinMembershipMonths: 3, loanGuarantorThresholdMinor: 5_000_000,
    loanGuarantorsRequired: 2, approvalQuorum: 2,
  },
};

const licence = {
  licenseKey: 'LIC-UMJ-2026-0042', plan: 'PREMIUM', state: 'ACTIVE', validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-12-31T20:59:59Z',
  daysRemaining: 417, maxMembers: 1000, features: ALL_FEATURES, notes: null,
};

// ---- Products and accounts ----------------------------------------------------------------------------------------------

const products = [
  { id: 'p-dep', code: 'DEP', name: 'Deposits', kind: 'DEPOSITS' },
  { id: 'p-shr', code: 'SHR', name: 'Share capital', kind: 'SHARE_CAPITAL' },
  { id: 'p-wel', code: 'WEL', name: 'Welfare', kind: 'WELFARE' },
];

const myAccounts = [
  { id: 'acc-dep-7', accountNumber: 'UMJ-DEP-000007', product: products[0], balanceMinor: 18_450_000 },
  { id: 'acc-shr-7', accountNumber: 'UMJ-SHR-000007', product: products[1], balanceMinor: 2_500_000 },
  { id: 'acc-wel-7', accountNumber: 'UMJ-WEL-000007', product: products[2], balanceMinor: 640_000 },
].map((a) => ({
  id: a.id, accountNumber: a.accountNumber, memberUserId: me.userId, memberName: nameOf(me), memberNumber: me.memberNumber,
  productId: a.product.id, productCode: a.product.code, productName: a.product.name, productKind: a.product.kind,
  status: 'ACTIVE', openedOn: '2024-02-03', closedOn: null, closureReason: null, currency: KES, balanceMinor: a.balanceMinor,
}));

function accountsFor(userId) {
  const m = members.find((x) => x.userId === userId) ?? me;
  return products.map((p, i) => ({
    id: `acc-${p.code.toLowerCase()}-${m.memberNumber}`, accountNumber: `UMJ-${p.code}-${pad(m.memberNumber ?? 0)}`, memberUserId: m.userId,
    memberName: nameOf(m), memberNumber: m.memberNumber, productId: p.id, productCode: p.code, productName: p.name, productKind: p.kind,
    status: 'ACTIVE', openedOn: '2024-02-03', closedOn: null, closureReason: null, currency: KES, balanceMinor: [12_000_000, 2_500_000, 480_000][i],
  }));
}

// ---- Dashboards ---------------------------------------------------------------------------------------------------------

const memberDashboard = () => ({
  chamaName: chama.name,
  memberUserId: me.userId,
  memberName: nameOf(me),
  memberNumber: me.memberNumber,
  currency: KES,
  features: ALL_FEATURES,
  savings: {
    totalMinor: myAccounts.reduce((s, a) => s + a.balanceMinor, 0),
    accounts: myAccounts.map((a) => ({ accountId: a.id, accountNumber: a.accountNumber, productCode: a.productCode, productName: a.productName, active: true, balanceMinor: a.balanceMinor })),
  },
  netPositionMinor: myAccounts.reduce((s, a) => s + a.balanceMinor, 0) - 8_325_000 - 20_000,
  contributions: {
    totalPaidMinor: 21_590_000, arrearsMinor: 0, advanceMinor: 250_000, latePeriods: 1, currentPeriod: '2026-11', currentPeriodStatus: 'PARTIALLY_PAID',
    contributedYearToDateMinor: 5_250_000, complianceRateBasisPoints: 9091, rank: 4, rankOutOf: 17,
  },
  loans: {
    activeLoans: 1, inProgress: 1, outstandingMinor: 8_325_000, arrearsMinor: 0, nextDueDate: '2026-11-30', nextDueMinor: 925_000, guaranteeRequests: 2,
    totalBorrowedMinor: 25_000_000, totalRepaidMinor: 19_175_000,
    loans: [
      {
        loanId: 'loan-0007', productName: 'Development loan', status: 'ACTIVE', purpose: 'Dairy unit', principalMinor: 10_000_000, interestMinor: 1_100_000,
        totalDueMinor: 11_100_000, repaidMinor: 2_775_000, outstandingMinor: 8_325_000, arrearsMinor: 0, daysInArrears: 0, repaidBasisPoints: 2500, termMonths: 12,
        appliedOn: '2026-07-20', disbursedOn: '2026-08-01', maturityDate: '2027-08-01', nextDueDate: '2026-11-30', nextDueMinor: 925_000,
      },
      {
        loanId: 'loan-0016', productName: 'Emergency loan', status: 'PENDING_GUARANTORS', purpose: 'School fees', principalMinor: 3_000_000, interestMinor: 150_000,
        totalDueMinor: 3_150_000, repaidMinor: 0, outstandingMinor: 0, arrearsMinor: 0, daysInArrears: 0, repaidBasisPoints: 0, termMonths: 3,
        appliedOn: '2026-11-07', disbursedOn: null, maturityDate: null, nextDueDate: null, nextDueMinor: 0,
      },
    ],
  },
  penaltiesOutstandingMinor: 20_000,
  penalties: {
    outstandingMinor: 20_000, outstandingCount: 1, paidMinor: 30_000, waivedMinor: 10_000,
    outstanding: [{ penaltyId: 'pen-0003', kind: 'LATE_CONTRIBUTION', description: 'Late contribution · Sep 2026', assessedOn: '2026-09-06', amountMinor: 20_000, outstandingMinor: 20_000 }],
  },
  submissions: { pending: 1 },
  topInvestments: rankedInvestments().slice(0, 3),
  generatedAt: iso(now),
});

function rankedInvestments() {
  const rows = [
    ['CIC Money Market Fund', 'MONEY_MARKET_FUND', 'CIC Asset Management', 'ACTIVE', 40_000_000, 44_287_500, 4_287_500, 0, 210, '2026-04-13', null],
    ['Treasury bond FXD1/2024/10', 'TREASURY_BOND', 'Central Bank of Kenya', 'ACTIVE', 30_000_000, 31_100_000, 2_925_000, 25_000, 318, '2025-12-26', '2034-12-26'],
    ['Stima SACCO shares', 'SACCO_SHARES', 'Stima SACCO', 'CLOSED', 10_000_000, 10_600_000, 900_000, 0, 365, '2025-06-01', null],
    ['Plot 14, Bahati', 'REAL_ESTATE', null, 'ACTIVE', 15_000_000, 14_200_000, 0, 180_000, 96, '2026-08-05', null],
    ['Equity Bank fixed deposit', 'FIXED_DEPOSIT', 'Equity Bank', 'ACTIVE', 5_000_000, 5_000_000, 0, 0, 12, '2026-10-28', '2027-04-28'],
  ].map(([name, type, institution, status, invested, value, income, expenses, days, fundedOn, maturityDate], i) => {
    const total = income - expenses + (value - invested);
    const bp = Math.round((total / invested) * 10_000);
    return {
      rank: 0, investmentId: `inv-${pad(i + 1, 4)}`, name, type, institution, status, investedMinor: invested, marketValueMinor: value, incomeMinor: income,
      expensesMinor: expenses, totalReturnMinor: total, returnBasisPoints: bp, annualisedReturnBasisPoints: days < 30 ? null : Math.round((bp * 365) / days),
      daysHeld: days, profitable: total > 0, fundedOn, maturityDate,
    };
  });
  return rows.sort((a, b) => b.returnBasisPoints - a.returnBasisPoints || b.totalReturnMinor - a.totalReturnMinor).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Contributors ranked for [from, to]: deterministic per member, scaled by the window's length. */
function topMembers(from, to, limit) {
  const months = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / (30 * 86_400_000)));
  const seated = members.filter((m) => m.memberNumber && m.status === 'ACTIVE');
  const rows = seated.map((m, i) => {
    const monthly = 500_000 + ((i * 7) % 5) * 250_000;
    const paidShare = i % 6 === 5 ? 0 : 1 - (i % 4) * 0.1;
    const contributed = Math.round(monthly * months * paidShare / 100) * 100;
    const compliance = Math.max(4500, 10_000 - (i % 5) * 900 - (i % 7 === 3 ? 2600 : 0));
    const arrears = compliance < 10_000 ? ((10_000 - compliance) / 10_000) * monthly * 3 : 0;
    return {
      rank: 0, memberUserId: m.userId, name: nameOf(m), memberNumber: m.memberNumber, contributedMinor: contributed, payments: Math.round(months * paidShare) || (contributed ? 1 : 0),
      complianceRateBasisPoints: compliance, arrearsMinor: Math.round(arrears / 100) * 100, latePeriods: compliance < 10_000 ? Math.ceil((10_000 - compliance) / 1500) : 0,
      savingsMinor: 6_000_000 + i * 850_000,
    };
  });
  return rows
    .filter((r) => r.contributedMinor > 0)
    .sort((a, b) => b.contributedMinor - a.contributedMinor || b.complianceRateBasisPoints - a.complianceRateBasisPoints || a.memberNumber - b.memberNumber)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** `count` months ending with November 2026 (to date), oldest first. */
function monthTrends(count) {
  return Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const serial = 2026 * 12 + 10 - back; // November 2026 = 2026 * 12 + 10
    const y = Math.floor(serial / 12);
    const mIndex = serial % 12;
    const partial = back === 0 ? 0.3 : 1;
    const seed = (mIndex * 37 + y) % 11;
    const income = Math.round((4_800_000 + seed * 220_000) * partial);
    const expenses = Math.round((1_100_000 + ((seed * 3) % 7) * 180_000 + (mIndex === 6 ? 5_200_000 : 0)) * partial);
    return {
      month: `${y}-${String(mIndex + 1).padStart(2, '0')}`,
      contributionsMinor: Math.round((8_250_000 + seed * 150_000) * partial), contributionPayments: Math.round((17 + (seed % 3)) * partial),
      loansDisbursedMinor: [15_000_000, 0, 8_000_000, 25_000_000, 0, 12_000_000][(mIndex + y) % 6] * (back === 0 ? 0 : 1),
      incomeMinor: income, expensesMinor: expenses, surplusMinor: income - expenses,
    };
  });
}

const entrySummaries = [];
const SOURCES = ['CONTRIBUTION', 'CONTRIBUTION', 'LOAN_REPAYMENT', 'CONTRIBUTION', 'EXPENSE', 'LOAN_DISBURSEMENT', 'PENALTY_PAYMENT', 'INVESTMENT_INCOME', 'CONTRIBUTION', 'MANUAL'];
const MPESA = ['QKX7H2L9P1', 'QKW3M8T2ZA', 'QKV9R4D7LB', 'QKT2N6P3XC', 'QKS8J1F5MD', 'QKR4H7B2NE', 'QKQ6D9C8PF', 'QKP1L3V6RG', 'QKN5Z2X9SH', 'QKM7Y4W1TJ', 'QKL3T8U5UK', 'QKK9S6R2VL'];

export const entries = Array.from({ length: 60 }, (_, i) => {
  const n = 1284 - i;
  const src = SOURCES[i % SOURCES.length];
  const m = members[i % 18];
  const date = new Date(Date.UTC(2026, 10, 9 - Math.floor(i / 3)));
  const d = date.toISOString().slice(0, 10);
  const amount = { CONTRIBUTION: 500_000 + (i % 4) * 250_000, LOAN_REPAYMENT: 925_000, EXPENSE: 350_000 + i * 1000, LOAN_DISBURSEMENT: 15_000_000, PENALTY_PAYMENT: 10_000, INVESTMENT_INCOME: 4_287_500, MANUAL: 120_000 }[src];
  const desc = {
    CONTRIBUTION: `Contribution from #${m.memberNumber} ${nameOf(m)}`,
    LOAN_REPAYMENT: `Loan repayment · #${m.memberNumber} ${nameOf(m)}`,
    EXPENSE: 'Meeting venue hire · Nakuru Players Theatre',
    LOAN_DISBURSEMENT: `Loan disbursement to #${m.memberNumber} ${nameOf(m)}`,
    PENALTY_PAYMENT: `Late contribution penalty · #${m.memberNumber}`,
    INVESTMENT_INCOME: 'CIC Money Market Fund · October interest',
    MANUAL: 'Bank charges · Equity Bank October statement',
  }[src];
  const [dr, cr] = {
    CONTRIBUTION: [['1020', 'M-Pesa float'], ['2000', 'Member savings']],
    LOAN_REPAYMENT: [['1020', 'M-Pesa float'], ['1100', 'Loans receivable']],
    EXPENSE: [['5000', 'Operating expenses'], ['1010', 'Bank – Equity']],
    LOAN_DISBURSEMENT: [['1100', 'Loans receivable'], ['1010', 'Bank – Equity']],
    PENALTY_PAYMENT: [['1000', 'Cash on hand'], ['1110', 'Penalties receivable']],
    INVESTMENT_INCOME: [['1200', 'Investments'], ['4200', 'Investment income']],
    MANUAL: [['5100', 'Bank charges'], ['1010', 'Bank – Equity']],
  }[src];
  const id = `e0000000-0000-4000-8000-${pad(n, 12)}`;
  const reference = src === 'EXPENSE' ? `INV-${2300 + i}` : src === 'MANUAL' ? null : MPESA[i % MPESA.length];
  const e = {
    id, number: n, entryDate: d, description: desc, reference, sourceType: src, sourceId: null,
    reversesEntryId: null, reversedByEntryId: i === 7 ? 'e-rev' : null, recordedBy: me.userId, recordedAt: `${d}T09:${pad(10 + (i % 50), 2)}:00Z`,
    totalMinor: amount,
    lines: [
      { accountId: `a-${dr[0]}`, accountCode: dr[0], accountName: dr[1], debitMinor: amount, creditMinor: 0, memberUserId: null, memo: null },
      { accountId: `a-${cr[0]}`, accountCode: cr[0], accountName: cr[1], debitMinor: 0, creditMinor: amount, memberUserId: src === 'CONTRIBUTION' ? m.userId : null, memo: null },
    ],
  };
  if (i < 8) entrySummaries.push({ id, number: n, entryDate: d, description: desc, reference, sourceType: src, totalMinor: amount, reversal: false });
  return e;
});

const chamaDashboard = () => ({
  chamaName: chama.name,
  asOf: '2026-11-09',
  currency: KES,
  features: ALL_FEATURES,
  keyFigures: {
    totalContributionsMinor: 412_750_000, contributionsYearToDateMinor: 96_500_000, totalSavingsMinor: 356_020_000, cashMinor: 209_945_000,
    loansOutstandingMinor: 128_450_000, investmentsMarketValueMinor: 105_187_500, penaltiesOutstandingMinor: 185_000, totalAssetsMinor: 443_767_500,
    netWorthMinor: 87_747_500,
  },
  members: { active: 17, suspended: 1, pendingApplications: 2, joinedThisMonth: 1, joinedThisYear: 4 },
  cash: { cashOnHandMinor: 4_215_000, bankMinor: 168_480_000, mobileMoneyMinor: 37_250_000, totalMinor: 209_945_000 },
  savings: {
    totalMinor: 356_020_000,
    products: [
      { productId: 'p-dep', code: 'DEP', name: 'Deposits', balanceMinor: 291_400_000 },
      { productId: 'p-shr', code: 'SHR', name: 'Share capital', balanceMinor: 45_000_000 },
      { productId: 'p-wel', code: 'WEL', name: 'Welfare', balanceMinor: 19_620_000 },
    ],
  },
  contributions: {
    currentPeriod: '2026-11', dueDate: '2026-11-05', expectedMinor: 9_000_000, collectedMinor: 7_250_000, collectionRateBasisPoints: 8056, membersPaid: 13, membersLate: 3,
    arrearsMinor: 2_750_000, membersInArrears: 5, totalCollectedMinor: 412_750_000, collectedThisMonthMinor: 7_250_000, collectedYearToDateMinor: 96_500_000,
    paymentsThisMonth: 16, complianceRateBasisPoints: 8820,
  },
  loans: {
    activeLoans: 9, outstandingMinor: 128_450_000, arrearsMinor: 3_725_000, loansInArrears: 2, par30BasisPoints: 640, awaitingApproval: 2, awaitingDisbursement: 1,
    aging: [
      { bucket: 'CURRENT', label: 'Current', loans: 7, outstandingMinor: 107_250_000, arrearsMinor: 0 },
      { bucket: 'DAYS_1_30', label: '1–30 days', loans: 1, outstandingMinor: 12_975_000, arrearsMinor: 925_000 },
      { bucket: 'DAYS_31_60', label: '31–60 days', loans: 1, outstandingMinor: 8_225_000, arrearsMinor: 2_800_000 },
      { bucket: 'DAYS_61_90', label: '61–90 days', loans: 0, outstandingMinor: 0, arrearsMinor: 0 },
      { bucket: 'OVER_90', label: 'Over 90 days', loans: 0, outstandingMinor: 0, arrearsMinor: 0 },
    ],
    disbursedYearToDate: 11, disbursedYearToDateMinor: 160_000_000, totalDisbursedMinor: 342_000_000, totalRepaidMinor: 231_400_000, repaidLoans: 14,
    interestExpectedMinor: 14_130_000, dueNext7Days: 3, dueNext7DaysMinor: 2_775_000,
  },
  penaltiesOutstandingMinor: 185_000,
  penalties: {
    outstandingMinor: 185_000, outstandingCount: 7, membersOwing: 4, assessedYearToDateMinor: 460_000, lateContributionYearToDateMinor: 310_000,
    finesYearToDateMinor: 150_000, collectedYearToDateMinor: 245_000, waivedYearToDateMinor: 30_000,
    topOwing: [3, 9, 12].map((n, i) => ({ memberUserId: members[n].userId, name: nameOf(members[n]), memberNumber: members[n].memberNumber, amountMinor: [80_000, 60_000, 25_000][i], count: [3, 2, 1][i] })),
  },
  investments: {
    active: 4, investedMinor: 90_000_000, marketValueMinor: 94_587_500, incomeMinor: 7_212_500, bookValueMinor: 90_000_000, unrealisedGainMinor: 4_587_500,
    totalReturnMinor: 12_595_000, returnBasisPoints: 1259, profitable: 3, closed: 1, maturingIn30Days: 0,
  },
  topMembers: topMembers('2026-01-01', '2026-11-09', 5),
  topInvestments: rankedInvestments(),
  thisMonth: { from: '2026-11-01', to: '2026-11-09', incomeMinor: 6_412_500, expensesMinor: 1_870_000, surplusMinor: 4_542_500 },
  yearToDate: { from: '2026-01-01', to: '2026-11-09', incomeMinor: 58_930_000, expensesMinor: 14_260_000, surplusMinor: 44_670_000 },
  trends: monthTrends(6),
  pending: {
    membershipApplications: 2, loansAwaitingApproval: 2, loansAwaitingDisbursement: 1, expensesAwaitingApproval: 3, expensesAwaitingPayment: 0, investmentsAwaitingApproval: 1,
    paymentsAwaitingReview: 4, contributionsAwaitingReview: 3, penaltyPaymentsAwaitingReview: 0, loanRepaymentsAwaitingReview: 1,
  },
  recentEntries: entrySummaries,
  generatedAt: iso(now),
});

// ---- Payment submissions ------------------------------------------------------------------------------------------------

const submission = (i, m, kind, status, over = {}) => ({
  id: `sub-${pad(i, 4)}`, memberUserId: m.userId, memberName: nameOf(m), memberNumber: m.memberNumber, kind,
  targetId: kind === 'PENALTY_PAYMENT' ? 'pen-0003' : kind === 'LOAN_REPAYMENT' ? 'loan-0007' : null,
  targetDescription: kind === 'PENALTY_PAYMENT' ? 'Late contribution · Sep 2026' : kind === 'LOAN_REPAYMENT' ? 'Loan: Dairy unit' : null,
  amountMinor: { CONTRIBUTION: 500_000, PENALTY_PAYMENT: 20_000, LOAN_REPAYMENT: 925_000 }[kind], currency: KES, method: 'MPESA',
  reference: MPESA[(i + 3) % MPESA.length].replace('QK', 'QL'), paidOn: `2026-11-${pad(9 - (i % 6), 2)}`, notes: i % 3 === 0 ? 'Paid from my husband’s line' : null,
  status, submittedAt: `2026-11-${pad(9 - (i % 6), 2)}T0${6 + (i % 3)}:15:00Z`, reviewedBy: null, reviewerName: null, reviewedAt: null, reviewNote: null, cancelledAt: null,
  ...over,
});
export const submissions = [
  submission(1, members[3], 'CONTRIBUTION', 'PENDING'),
  submission(2, members[9], 'LOAN_REPAYMENT', 'PENDING'),
  submission(3, me, 'PENALTY_PAYMENT', 'PENDING'),
  submission(4, members[12], 'CONTRIBUTION', 'PENDING', { method: 'BANK', reference: 'EQ-8841-2209' }),
  submission(5, me, 'CONTRIBUTION', 'APPROVED', { paidOn: '2026-11-04', reviewedBy: members[0].userId, reviewerName: nameOf(members[0]), reviewedAt: '2026-11-04T15:02:00Z' }),
  submission(6, me, 'LOAN_REPAYMENT', 'REJECTED', { paidOn: '2026-10-30', reviewedBy: members[0].userId, reviewerName: nameOf(members[0]), reviewedAt: '2026-10-31T08:40:00Z', reviewNote: 'Not on the M-Pesa statement for 30 Oct. Check the code and report again.' }),
  submission(7, me, 'CONTRIBUTION', 'CANCELLED', { paidOn: '2026-10-28', cancelledAt: '2026-10-28T12:00:00Z' }),
];

// ---- Contributions ------------------------------------------------------------------------------------------------------

export const payments = Array.from({ length: 48 }, (_, i) => {
  const m = members[(i * 5) % 18];
  const method = i % 7 === 3 ? 'BANK' : i % 9 === 4 ? 'CASH' : 'MPESA';
  const d = new Date(Date.UTC(2026, 10, 9 - Math.floor(i / 2))).toISOString().slice(0, 10);
  const amount = [500_000, 500_000, 750_000, 1_000_000, 250_000][i % 5];
  return {
    id: `pay-${pad(i + 1, 4)}`, memberUserId: m.userId, memberName: nameOf(m), memberNumber: m.memberNumber, amountMinor: amount, currency: KES,
    method, reference: method === 'MPESA' ? MPESA[i % MPESA.length].slice(0, 6) + pad(i, 4) : method === 'BANK' ? `EQB-${88_000 + i}` : null,
    paidOn: d, notes: null, status: i === 5 ? 'REVERSED' : 'RECORDED', ledgerEntryId: entries[i % entries.length].id, recordedBy: me.userId,
    recordedAt: `${d}T10:15:00Z`, reversedBy: i === 5 ? members[0].userId : null, reversedAt: i === 5 ? `${d}T12:00:00Z` : null,
    reversalReason: i === 5 ? 'Duplicate M-Pesa entry' : null,
    allocations: [{ productId: 'p-dep', productCode: 'DEP', productName: 'Deposits', amountMinor: amount - 50_000 }, { productId: 'p-wel', productCode: 'WEL', productName: 'Welfare', amountMinor: 50_000 }],
  };
});
payments[0].reference = 'QKX7H2L9P1';

const standings = members.filter((m) => m.memberNumber).map((m, i) => {
  const arrears = [0, 0, 500_000, 0, 0, 250_000, 0, 0, 1_000_000, 0, 0, 0, 500_000, 0, 500_000, 0, 0, 0][i] ?? 0;
  const due = 11 * 500_000 + 2 * 500_000;
  const paid = due - arrears + (i === 6 ? 250_000 : 0);
  return {
    memberUserId: m.userId, memberName: nameOf(m), memberNumber: m.memberNumber, currency: KES, totalPaidMinor: paid, dueToDateMinor: due,
    arrearsMinor: arrears, advanceMinor: i === 6 ? 250_000 : 0, balanceMinor: paid - due, latePeriods: arrears ? 2 : 0, products: [],
  };
});

const period = {
  id: 'per-2026-11', key: '2026-11', frequency: 'MONTHLY', startDate: '2026-11-01', endDate: '2026-11-30', dueDate: '2026-11-05',
  amountDueMinor: 500_000, currency: KES,
  products: [{ productId: 'p-dep', productCode: 'DEP', productName: 'Deposits', amountMinor: 450_000 }, { productId: 'p-wel', productCode: 'WEL', productName: 'Welfare', amountMinor: 50_000 }],
};
const periods = [
  { period, due: true, expectedMinor: 9_000_000, collectedMinor: 7_250_000, members: 18, membersPaid: 13, membersLate: 3 },
  { period: { ...period, id: 'per-2026-10', key: '2026-10', startDate: '2026-10-01', endDate: '2026-10-31', dueDate: '2026-10-05' }, due: true, expectedMinor: 9_000_000, collectedMinor: 8_750_000, members: 18, membersPaid: 17, membersLate: 2 },
];

// ---- Loans --------------------------------------------------------------------------------------------------------------

const LOAN_STATUSES = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PENDING_APPROVAL', 'ACTIVE', 'APPROVED', 'ACTIVE', 'REPAID', 'PENDING_APPROVAL', 'ACTIVE', 'PENDING_GUARANTORS', 'ACTIVE', 'ACTIVE', 'REJECTED', 'ACTIVE'];
export const loans = LOAN_STATUSES.map((status, i) => {
  const m = members[(i * 3 + 1) % 18];
  const principal = [15_000_000, 8_000_000, 25_000_000, 12_000_000, 5_000_000, 30_000_000, 10_000_000, 6_000_000, 20_000_000, 9_000_000, 40_000_000, 7_500_000, 18_000_000, 3_000_000, 11_000_000][i];
  const interest = principal / 10;
  const disbursed = ['ACTIVE', 'REPAID'].includes(status);
  const repaid = status === 'REPAID' ? principal + interest : disbursed ? Math.round((principal + interest) * [0.3, 0.55, 0.12, 0, 0.8, 0, 0.45, 1, 0, 0.2, 0, 0.66, 0.08, 0, 0.5][i]) : 0;
  const arrears = i === 2 ? 2_750_000 : i === 12 ? 975_000 : 0;
  return {
    id: `loan-${pad(i + 1, 4)}`, borrowerUserId: m.userId, borrowerName: nameOf(m), memberNumber: m.memberNumber, productId: 'lp-std',
    productCode: 'STD', productName: 'Standard loan', principalMinor: principal, interestBasisPoints: 1000, interestMinor: interest,
    totalDueMinor: principal + interest, repaidMinor: repaid, outstandingMinor: disbursed ? principal + interest - repaid : 0, arrearsMinor: arrears,
    currency: KES, termMonths: 12, purpose: ['School fees', 'Stock for duka', 'Dairy cow', 'Boda boda', 'Greenhouse'][i % 5], status,
    appliedOn: '2026-0' + (1 + (i % 9)) + '-14', requiredGuarantors: 2, acceptedGuarantors: status === 'PENDING_GUARANTORS' ? 1 : 2,
    requiredApprovals: 2, approvals: status === 'PENDING_APPROVAL' ? 1 : 2, disbursedOn: disbursed ? '2026-0' + (1 + (i % 9)) + '-20' : null,
    nextDueDate: status === 'ACTIVE' ? '2026-11-30' : null, nextDueMinor: status === 'ACTIVE' ? Math.round((principal + interest) / 12) : 0,
    maturityDate: disbursed ? '2027-0' + (1 + (i % 9)) + '-20' : null, rejectionReason: status === 'REJECTED' ? 'Guarantor savings too low' : null,
  };
});

function loanDetail(loan) {
  const disbursed = !!loan.disbursedOn;
  const inst = Math.round(loan.totalDueMinor / loan.termMonths);
  const schedule = disbursed
    ? Array.from({ length: loan.termMonths }, (_, k) => {
        const due = new Date(Date.UTC(2026, 1 + k, 20)).toISOString().slice(0, 10);
        const paidCount = Math.floor(loan.repaidMinor / inst);
        const status = k < paidCount ? 'PAID' : k === paidCount && loan.repaidMinor % inst ? 'PARTLY_PAID' : due < '2026-11-09' ? 'OVERDUE' : 'DUE';
        return { number: k + 1, dueDate: due, amountMinor: inst, paidMinor: k < paidCount ? inst : k === paidCount ? loan.repaidMinor % inst : 0, status };
      })
    : [];
  const g = [members[0], members[2]];
  return {
    loan,
    guarantors: g.map((m) => ({ userId: m.userId, name: nameOf(m), memberNumber: m.memberNumber, status: 'ACCEPTED', requestedAt: '2026-01-14T08:00:00Z', respondedAt: '2026-01-15T08:00:00Z' })),
    approvals: [{ approverUserId: members[0].userId, name: nameOf(members[0]), note: 'Good repayment history', approvedAt: '2026-01-17T09:00:00Z' }, { approverUserId: members[2].userId, name: nameOf(members[2]), note: null, approvedAt: '2026-01-18T11:30:00Z' }].slice(0, loan.approvals),
    disbursement: disbursed ? { disbursedOn: loan.disbursedOn, disbursedBy: me.userId, method: 'MPESA', reference: 'QKB4X8N2LD', ledgerEntryId: entries[5].id } : null,
    decision: loan.rejectionReason ? { rejectedBy: members[0].userId, rejectedAt: '2026-05-02T08:00:00Z', reason: loan.rejectionReason, cancelledAt: null } : null,
    schedule,
    repayments: disbursed ? Array.from({ length: Math.floor(loan.repaidMinor / inst) }, (_, k) => ({ id: `rep-${k}`, amountMinor: inst, method: 'MPESA', reference: MPESA[k % MPESA.length], paidOn: new Date(Date.UTC(2026, 1 + k, 19)).toISOString().slice(0, 10), ledgerEntryId: entries[k].id, recordedBy: me.userId, recordedAt: '2026-03-19T10:00:00Z' })) : [],
  };
}

// ---- Member statement ---------------------------------------------------------------------------------------------------

function statementLines(opening, monthly) {
  let bal = opening;
  return Array.from({ length: 10 }, (_, k) => {
    const d = new Date(Date.UTC(2026, k + 1, 4)).toISOString().slice(0, 10);
    bal += monthly;
    return { date: k === 9 ? '2026-11-04' : k === 8 ? '2026-10-28' : d, entryNumber: 1000 + k * 27, description: `Contribution ${new Date(Date.UTC(2026, k + 1, 1)).toLocaleString('en', { month: 'short' })} 2026`, reference: MPESA[k % MPESA.length], sourceType: 'CONTRIBUTION', debitMinor: 0, creditMinor: monthly, balanceMinor: bal };
  });
}

const myStatement = () => ({
  chamaName: chama.name,
  member: { userId: me.userId, name: nameOf(me), memberNumber: me.memberNumber },
  from: '2026-01-01', to: '2026-11-09', currency: KES,
  savingsMinor: 21_590_000, loansOutstandingMinor: 8_325_000, penaltiesOutstandingMinor: 20_000, netPositionMinor: 13_245_000,
  contributions: { totalPaidMinor: 21_590_000, dueToDateMinor: 21_340_000, arrearsMinor: 0, advanceMinor: 250_000, latePeriods: 1, latestPeriod: '2026-11', latestPeriodStatus: 'PARTIALLY_PAID' },
  savings: [
    { accountNumber: 'UMJ-DEP-000007', code: 'DEP', name: 'Deposits', openingBalanceMinor: 13_950_000, closingBalanceMinor: 18_450_000, lines: statementLines(13_950_000, 450_000) },
    { accountNumber: 'UMJ-WEL-000007', code: 'WEL', name: 'Welfare', openingBalanceMinor: 140_000, closingBalanceMinor: 640_000, lines: statementLines(140_000, 50_000) },
  ],
  loans: [{
    id: 'loan-me', borrowerUserId: me.userId, productId: 'lp-std', productCode: 'STD', productName: 'Standard loan', status: 'ACTIVE', currency: KES,
    principalMinor: 10_000_000, interestMinor: 1_000_000, totalDueMinor: 11_000_000, repaidMinor: 2_675_000, outstandingMinor: 8_325_000, arrearsMinor: 0,
    daysInArrears: 0, termMonths: 12, purpose: 'Greenhouse', appliedOn: '2026-07-02', disbursedOn: '2026-07-10', maturityDate: '2027-07-10',
    nextDueDate: '2026-11-30', nextDueMinor: 925_000,
  }],
  penalties: { accountNumber: null, code: '1110', name: 'Penalties', openingBalanceMinor: 0, closingBalanceMinor: 20_000, lines: [{ date: '2026-09-11', entryNumber: 1190, description: 'Late contribution penalty · Sep 2026', reference: null, sourceType: 'PENALTY', debitMinor: 20_000, creditMinor: 0, balanceMinor: 20_000 }] },
  generatedAt: iso(now),
});

/** Who is signed in: an official (TREASURER, broad permissions) or a plain member (shots.mjs --persona member). */
export const persona = { official: true };

/** Keeps statement lines inside ?from/?to, as the API does. */
function inRange(s, from, to) {
  const keep = (l) => (!from || l.date >= from) && (!to || l.date <= to);
  return { ...s, from: from ?? s.from, to: to ?? s.to, savings: s.savings.map((a) => ({ ...a, lines: a.lines.filter(keep) })), penalties: s.penalties && { ...s.penalties, lines: s.penalties.lines.filter(keep) } };
}

// ---- Router -------------------------------------------------------------------------------------------------------------

function paged(all, params, filter = () => true) {
  const rows = all.filter(filter);
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 50);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  return {
    data: rows.slice(page * size, page * size + size),
    meta: { page, size, totalElements: rows.length, totalPages, hasNext: page + 1 < totalPages, hasPrevious: page > 0 },
  };
}

/**
 * Resolves a mocked API call. Returns { data, meta? }, { status, error } for a failure, or null when the call is not mocked.
 * `path` is relative to /api/v1 (e.g. "/loans/loan-0001").
 */
export function resolve(method, path, params, body) {
  const seg = path.split('/').filter(Boolean);
  const is = (...parts) => parts.length === seg.length && parts.every((p, i) => p === '*' || p === seg[i]);

  if (method === 'POST' && is('contributions')) {
    const m = members.find((x) => x.userId === body?.memberUserId) ?? members[0];
    return {
      data: {
        ...payments[1], id: 'pay-new', memberUserId: m.userId, memberName: nameOf(m), memberNumber: m.memberNumber, amountMinor: body?.amountMinor ?? 500_000,
        method: body?.method ?? 'MPESA', reference: body?.reference ?? null, paidOn: body?.paidOn ?? '2026-11-09', status: 'RECORDED',
        ledgerEntryId: entries[0].id, recordedAt: iso(now), recordedBy: me.userId,
        allocations: [{ productId: 'p-dep', productCode: 'DEP', productName: 'Deposits', amountMinor: (body?.amountMinor ?? 500_000) - 50_000 }, { productId: 'p-wel', productCode: 'WEL', productName: 'Welfare', amountMinor: 50_000 }],
      },
      message: 'Contribution recorded',
    };
  }
  if (method === 'POST' && is('payment-submissions')) {
    return { data: { ...submissions[0], id: 'sub-new', ...body, status: 'PENDING', submittedAt: iso(now) }, message: 'Payment reported. The treasurer will confirm it once they have checked it.' };
  }
  if (method !== 'GET') return { data: null, message: 'OK' };

  if (is('auth', 'me')) return { data: authMe };
  if (is('members', 'me')) return persona.official ? { data: { membership: me, permissions: ALL_PERMISSIONS } } : { data: { membership: { ...me, roles: ['MEMBER'] }, permissions: MEMBER_PERMISSIONS } };
  if (is('dashboard', 'overview')) {
    const { pending, topMembers, recentEntries, penaltiesOutstandingMinor, ...rest } = chamaDashboard();
    return { data: { ...rest, penalties: { ...rest.penalties, topOwing: [] } } };
  }
  if (is('payment-submissions', 'me')) return paged(submissions.filter((s) => s.memberUserId === me.userId), params, (s) => !params.get('status') || s.status === params.get('status'));
  if (is('payment-submissions', 'reviewable-kinds')) return { data: ['CONTRIBUTION', 'PENALTY_PAYMENT', 'LOAN_REPAYMENT'] };
  if (is('payment-submissions', 'pending-count')) {
    const mineExcluded = submissions.filter((s) => s.status === 'PENDING' && s.memberUserId !== me.userId);
    const n = (kind) => mineExcluded.filter((s) => s.kind === kind).length;
    return { data: { contributions: n('CONTRIBUTION'), penaltyPayments: n('PENALTY_PAYMENT'), loanRepayments: n('LOAN_REPAYMENT'), total: mineExcluded.length } };
  }
  if (is('payment-submissions')) {
    return paged(submissions, params, (s) => (!params.get('status') || s.status === params.get('status')) && (!params.get('kind') || s.kind === params.get('kind')) && (!params.get('memberUserId') || s.memberUserId === params.get('memberUserId')));
  }
  if (is('loans', 'guarantor-candidates')) {
    return { data: members.filter((m) => m.status === 'ACTIVE' && m.memberNumber && m.userId !== me.userId).map((m) => ({ userId: m.userId, memberNumber: m.memberNumber, name: nameOf(m) })) };
  }
  if (is('members')) return paged(members, params, (m) => !params.get('status') || m.status === params.get('status'));
  if (is('chama')) return { data: chama };
  if (is('chama', 'license')) return { data: licence };
  if (is('dashboard', 'me')) return { data: memberDashboard() };
  if (is('dashboard', 'top-members')) {
    const to = params.get('to') ?? '2026-11-09';
    const from = params.get('from') ?? `${to.slice(0, 4)}-01-01`;
    if (from > to) return { status: 400, error: { code: 'REPORT_INVALID_PERIOD', message: 'The start date must be on or before the end date.' } };
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') ?? 10)));
    return { data: { from, to, currency: KES, members: topMembers(from, to, limit) } };
  }
  if (is('dashboard', 'top-investments')) return { data: { currency: KES, investments: rankedInvestments().slice(0, Math.min(50, Math.max(1, Number(params.get('limit') ?? 5)))) } };
  if (is('dashboard', 'trends')) {
    const months = Number(params.get('months') ?? 12);
    if (!(months >= 1 && months <= 24)) return { status: 400, error: { code: 'REPORT_INVALID_PERIOD', message: 'months must be between 1 and 24.' } };
    return { data: { currency: KES, months: monthTrends(months) } };
  }
  if (is('dashboard')) return { data: chamaDashboard() };

  if (is('contributions')) return paged(payments, params, (p) => (!params.get('memberUserId') || p.memberUserId === params.get('memberUserId')) && (!params.get('status') || p.status === params.get('status')));
  if (is('contributions', 'standings')) return { data: params.get('inArrears') === 'true' ? standings.filter((s) => s.arrearsMinor > 0) : standings };
  if (is('contributions', 'periods')) return { data: periods };
  if (is('contributions', 'me')) return { data: { standing: standings[6], periods: [], recentPayments: payments.slice(0, 5) } };
  if (is('contributions', '*')) return { data: payments.find((p) => p.id === seg[1]) ?? payments[0] };

  if (is('member-accounts', 'me', '*', 'statement') || is('member-accounts', '*', 'statement')) {
    const id = seg[seg.length - 2];
    const account = myAccounts.find((a) => a.id === id) ?? myAccounts[0];
    const lines = statementLines(account.balanceMinor - 10 * 450_000, 450_000).map((l) => ({ ...l, entryId: entries[0].id, entryDate: l.date, memo: null }));
    const keep = (l) => (!params.get('from') || l.entryDate >= params.get('from')) && (!params.get('to') || l.entryDate <= params.get('to'));
    return { data: { account, from: params.get('from'), to: params.get('to'), openingBalanceMinor: account.balanceMinor - 10 * 450_000, closingBalanceMinor: account.balanceMinor, lines: lines.filter(keep) } };
  }
  if (is('member-accounts', 'me')) return { data: { currency: KES, totalBalanceMinor: myAccounts.reduce((s, a) => s + a.balanceMinor, 0), accounts: myAccounts } };
  if (is('member-accounts')) return { data: params.get('memberUserId') ? accountsFor(params.get('memberUserId')) : members.filter((m) => m.memberNumber).flatMap((m) => accountsFor(m.userId)) };

  if (is('loans')) return paged(loans, params, (l) => (!params.get('status') || l.status === params.get('status')) && (!params.get('memberUserId') || l.borrowerUserId === params.get('memberUserId')));
  if (is('loans', 'me')) return { data: { currency: KES, outstandingMinor: 8_325_000, arrearsMinor: 0, loans: [loanDetail({ ...loans[6], borrowerUserId: me.userId, borrowerName: nameOf(me), memberNumber: me.memberNumber })] } };
  if (is('loans', 'guarantees')) return { data: loans.slice(3, 5).map((l) => ({ loan: l, myStatus: 'REQUESTED' })) };
  if (is('loans', '*')) return { data: loanDetail(loans.find((l) => l.id === seg[1]) ?? loans[0]) };

  if (is('ledger', 'entries')) return paged(entries, params, (e) => !params.get('sourceType') || e.sourceType === params.get('sourceType'));
  if (is('ledger', 'entries', '*')) return { data: entries.find((e) => e.id === seg[2]) ?? entries[0] };
  if (is('ledger', 'me')) return { data: { memberUserId: me.userId, currency: KES, savingsMinor: 21_590_000, loansOutstandingMinor: 8_325_000, penaltiesOutstandingMinor: 20_000 } };

  if (is('reports', 'members', 'me', 'statement')) return { data: inRange(myStatement(), params.get('from'), params.get('to')) };
  if (is('penalties', 'me')) return { data: { currency: KES, outstandingMinor: 20_000, penalties: [] } };

  return null;
}
