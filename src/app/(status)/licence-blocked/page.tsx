'use client';

import { ShieldAlert } from 'lucide-react';
import { StatusChip } from '@/components/shared/Display';
import { env } from '@/config/env';
import { StatusFrame } from '@/features/access/StatusFrame';
import { useCan } from '@/hooks/useSessionInfo';
import { formatInstantDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { useSession } from '@/stores/session';

/** README §7.2: the chama's licence is expired or suspended. Profile and sign-out stay reachable. */
export default function LicenceBlockedPage() {
  const licence = useSession((s) => s.licence);
  const chamaName = useSession((s) => s.chamaName);
  const can = useCan();
  const suspended = licence?.state === 'SUSPENDED';
  return (
    <StatusFrame icon={<ShieldAlert />} title={suspended ? 'Your chama is suspended' : "Your chama's licence has expired"} showProfile>
      <p>{chamaName ?? 'Your chama'} can&apos;t be used until the licence is {suspended ? 'reactivated' : 'renewed'}. Your records are safe.</p>
      {licence && (
        <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-foreground">
          <dt className="text-muted-foreground">State</dt>
          <dd><StatusChip status={licence.state} /></dd>
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{label(licence.plan)}</dd>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd>{formatInstantDate(licence.validUntil)}</dd>
          {licence.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{licence.notes}</dd>
            </>
          )}
        </dl>
      )}
      {can('CHAMA_SETTINGS_MANAGE') ? (
        <p>
          Contact the platform provider to renew
          {env.supportEmail && <> at <a className="text-primary underline" href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a></>}
          {env.supportPhone && <> or {env.supportPhone}</>}.
        </p>
      ) : (
        <p>Ask your chairperson to contact the platform provider.</p>
      )}
    </StatusFrame>
  );
}
