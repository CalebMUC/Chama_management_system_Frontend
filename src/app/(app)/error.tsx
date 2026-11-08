'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="size-6" /></div>
      <h1 className="font-semibold">Something went wrong on this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">Try again. If it keeps happening, tell your chama officials what you were doing.</p>
      <Button variant="outline" onClick={reset}>Try again</Button>
    </div>
  );
}
