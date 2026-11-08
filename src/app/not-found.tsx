import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <h1 className="text-lg font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-sm text-muted-foreground">Check the address, or go back to where you were.</p>
      <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4">Go home</Link>
    </div>
  );
}
