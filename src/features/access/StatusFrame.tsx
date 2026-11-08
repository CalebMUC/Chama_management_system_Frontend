'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, UserRound } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { loginPath, logout } from '@/features/auth/sessionActions';

/** A single card for the waiting / blocked screens, with sign-out (and optionally profile) always reachable. */
export function StatusFrame({ icon, title, children, actions, showProfile }: { icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode; showProfile?: boolean }) {
  const router = useRouter();
  async function signOut() {
    const code = await logout();
    router.replace(loginPath(code));
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <BrandMark dark={false} />
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 p-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-6">{icon}</div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            {actions}
            {showProfile && <Button variant="outline" asChild><Link href="/profile"><UserRound />My profile</Link></Button>}
            <Button variant="ghost" onClick={signOut}><LogOut />Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
