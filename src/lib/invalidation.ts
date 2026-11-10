// README §9: which cached data each kind of change makes stale. Query keys start with these area names.
export const INVALIDATE = {
  members: ['members', 'dashboard'],
  roles: ['roles'],
  chamaSettings: ['chama', 'loanProducts', 'savingsProducts', 'contributions', 'dashboard'],
  contribution: ['contributions', 'memberAccounts', 'ledger', 'dashboard', 'penalties', 'reports', 'savingsProducts'],
  savingsProduct: ['savingsProducts', 'memberAccounts', 'ledger', 'contributions'],
  memberAccount: ['memberAccounts', 'savingsProducts'],
  penalty: ['penalties', 'ledger', 'dashboard', 'reports'],
  loanMember: ['loans', 'dashboard'],
  loanOfficial: ['loans', 'ledger', 'dashboard', 'reports'],
  loanProduct: ['loanProducts', 'loans'],
  expense: ['expenses', 'ledger', 'dashboard', 'investments', 'reports'],
  investment: ['investments', 'ledger', 'dashboard', 'reports', 'expenses'],
  ledger: ['ledger', 'reports', 'dashboard'],
  platform: ['platform'],
  /** A member reports or withdraws a payment: nothing is recorded yet. */
  submission: ['paymentSubmissions', 'dashboard'],
  /** Confirming records the real contribution, penalty payment or loan repayment; rejecting only changes the report. */
  submissionReview: ['paymentSubmissions', 'dashboard', 'contributions', 'memberAccounts', 'savingsProducts', 'penalties', 'loans', 'ledger', 'reports'],
} as const satisfies Record<string, readonly string[]>;

export const keys = (k: keyof typeof INVALIDATE) => [...INVALIDATE[k]];
