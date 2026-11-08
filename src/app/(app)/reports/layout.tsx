'use client';

import type { ReactNode } from 'react';
import { Guard } from '@/components/shared/Can';

/** Every report needs REPORT_VIEW_ALL and the REPORTS feature (README §7.13). */
export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <Guard permission="REPORT_VIEW_ALL" feature="REPORTS">{children}</Guard>;
}
