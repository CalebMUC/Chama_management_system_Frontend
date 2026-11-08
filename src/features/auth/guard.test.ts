import { describe, expect, it } from 'vitest';
import type { LicenseView, MemberView } from '@/api/types';
import { hasRequirement } from '@/hooks/useSessionInfo';
import { homePathFor } from '@/stores/session';
import { guardRedirect, safeReturnTo } from './AuthGuard';

const member = (status: MemberView['status']) => ({ status }) as MemberView;
const licence = (state: LicenseView['state']) => ({ state }) as LicenseView;
const base = { status: 'authenticated' as const, isPlatformAdmin: false, membership: member('ACTIVE'), licence: licence('ACTIVE') };

describe('homePathFor (README §5)', () => {
  it('routes by session state', () => {
    expect(homePathFor({ ...base, status: 'anonymous' })).toBe('/login');
    expect(homePathFor({ ...base, isPlatformAdmin: true, membership: null })).toBe('/platform');
    expect(homePathFor({ ...base, membership: member('PENDING_APPROVAL') })).toBe('/pending');
    expect(homePathFor({ ...base, membership: member('SUSPENDED') })).toBe('/membership-status');
    expect(homePathFor({ ...base, membership: member('REJECTED') })).toBe('/membership-status');
    expect(homePathFor({ ...base, licence: licence('EXPIRED') })).toBe('/licence-blocked');
    expect(homePathFor(base)).toBe('/home');
  });

  it('treats an unreadable licence (no CHAMA_VIEW) as active', () => {
    expect(homePathFor({ ...base, licence: null })).toBe('/home');
  });
});

describe('guardRedirect', () => {
  it('keeps platform admins out of the chama app and members out of the console', () => {
    expect(guardRedirect({ ...base, isPlatformAdmin: true }, 'chama', '/home')).toBe('/platform');
    expect(guardRedirect(base, 'platform', '/platform')).toBe('/home');
  });

  it('blocks the app on an expired licence but keeps the profile reachable', () => {
    const blocked = { ...base, licence: licence('SUSPENDED') };
    expect(guardRedirect(blocked, 'chama', '/loans')).toBe('/licence-blocked');
    expect(guardRedirect(blocked, 'chama', '/profile')).toBeNull();
    expect(guardRedirect(blocked, 'status', '/licence-blocked')).toBeNull();
  });

  it('sends applicants to the pending screen', () => {
    expect(guardRedirect({ ...base, membership: member('PENDING_APPROVAL') }, 'chama', '/home')).toBe('/pending');
    expect(guardRedirect({ ...base, membership: member('PENDING_APPROVAL') }, 'status', '/pending')).toBeNull();
  });
});

describe('safeReturnTo', () => {
  it('only allows same-origin paths', () => {
    expect(safeReturnTo('/loans/1')).toBe('/loans/1');
    expect(safeReturnTo('//evil.example')).toBeNull();
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('/login?x=1')).toBeNull();
  });
});

describe('hasRequirement', () => {
  it('gates on permissions, never role names, and only for active members', () => {
    expect(hasRequirement(['LOAN_APPROVE'], true, 'LOAN_APPROVE')).toBe(true);
    expect(hasRequirement(['LOAN_APPROVE'], true, 'LOAN_DISBURSE')).toBe(false);
    expect(hasRequirement(['LOAN_APPROVE'], true, ['LOAN_DISBURSE', 'LOAN_APPROVE'])).toBe(true);
    expect(hasRequirement([], true, 'member')).toBe(true);
    expect(hasRequirement(['LOAN_APPROVE'], false, 'LOAN_APPROVE')).toBe(false);
  });
});
