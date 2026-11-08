'use client';

import { useCallback } from 'react';
import type { ChamaPermission, LicenseFeature } from '@/api/types';
import { useSession } from '@/stores/session';

/** A permission requirement: one permission, any of a list, or 'member' (any ACTIVE membership, no specific permission). */
export type Requirement = ChamaPermission | ChamaPermission[] | 'member' | undefined;

export function hasRequirement(permissions: readonly ChamaPermission[], active: boolean, req: Requirement): boolean {
  if (!active) return false;
  if (!req || req === 'member') return true;
  return Array.isArray(req) ? req.some((p) => permissions.includes(p)) : permissions.includes(req);
}

/** `can(p)`: gate every screen, menu item and button on permissions from GET /members/me, never on role names. */
export function useCan() {
  const permissions = useSession((s) => s.permissions);
  const active = useSession((s) => s.membership?.status === 'ACTIVE');
  return useCallback((req?: Requirement) => hasRequirement(permissions, active, req), [permissions, active]);
}

export function usePermission(req?: Requirement) {
  return useCan()(req);
}

export function useHasFeature() {
  const features = useSession((s) => s.features);
  return useCallback((f?: LicenseFeature) => !f || features.includes(f), [features]);
}

export function useCurrency() {
  return useSession((s) => s.currency);
}

/** The signed-in user's id: what financial records call `memberUserId`. */
export function useMyUserId() {
  return useSession((s) => s.user?.id ?? null);
}
