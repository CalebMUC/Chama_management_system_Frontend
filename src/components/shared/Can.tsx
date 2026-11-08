'use client';

import type { ReactNode } from 'react';
import type { LicenseFeature } from '@/api/types';
import { useCan, useHasFeature, type Requirement } from '@/hooks/useSessionInfo';
import { FEATURE_LABELS } from '@/lib/labels';
import { FeatureNotIncludedState, ForbiddenState } from './States';

/** Renders children only when the user holds the permission (and the licence has the feature). The API still enforces it. */
export function Can({ permission, feature, children, fallback = null }: { permission?: Requirement; feature?: LicenseFeature; children: ReactNode; fallback?: ReactNode }) {
  const can = useCan();
  const hasFeature = useHasFeature();
  return can(permission ?? 'member') && hasFeature(feature) ? <>{children}</> : <>{fallback}</>;
}

/** Page guard: a feature the plan lacks shows "not in your plan"; a missing permission shows "No access" (never a blank screen). */
export function Guard({ permission, feature, children }: { permission?: Requirement; feature?: LicenseFeature; children: ReactNode }) {
  const can = useCan();
  const hasFeature = useHasFeature();
  if (feature && !hasFeature(feature)) return <FeatureNotIncludedState feature={FEATURE_LABELS[feature].toLowerCase()} />;
  if (!can(permission ?? 'member')) return <ForbiddenState />;
  return <>{children}</>;
}
