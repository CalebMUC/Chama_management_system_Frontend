/** My banking screens: where the "Hide balances" preference applies. */
export const isMemberRoute = (path: string) => path === '/home' || path.startsWith('/me/');
