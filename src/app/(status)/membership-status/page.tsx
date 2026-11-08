'use client';

import { Ban, UserX } from 'lucide-react';
import { StatusFrame } from '@/features/access/StatusFrame';
import { useSession } from '@/stores/session';

/** README §7.2: rejected, suspended or exited memberships. */
export default function MembershipStatusPage() {
  const membership = useSession((s) => s.membership);
  const status = membership?.status;
  if (status === 'SUSPENDED') {
    return (
      <StatusFrame icon={<Ban />} title="Your membership is suspended">
        {membership?.suspensionReason && <p>Reason: <span className="text-foreground">{membership.suspensionReason}</span></p>}
        <p>Contact your chama officials to have it reactivated.</p>
      </StatusFrame>
    );
  }
  if (status === 'REJECTED') {
    return (
      <StatusFrame icon={<UserX />} title="Your application was not approved">
        <p>Contact your chama officials if you think this is a mistake.</p>
      </StatusFrame>
    );
  }
  return (
    <StatusFrame icon={<UserX />} title="You are no longer a member">
      <p>Your membership of this chama has ended. Contact your chama officials if you have questions.</p>
    </StatusFrame>
  );
}
