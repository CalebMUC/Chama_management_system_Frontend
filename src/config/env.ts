// Everything with the NEXT_PUBLIC_ prefix ships to the browser: never put secrets here.
// Next inlines these at build time, so each must be read by its full literal name.
export const env = {
  /** The API's /api/v1 root. Same origin by default (next.config.mjs proxies it): the backend has no CORS. */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1',
  /** The platform operator, shown on the licence screens. Either may be empty. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '',
  /** development | test | staging | production. A badge in the top bar shows it everywhere except production (or when unset). */
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? '',
  /** From package.json (next.config.mjs). */
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? '',
} as const;

export const APP_NAME = 'Chama';
