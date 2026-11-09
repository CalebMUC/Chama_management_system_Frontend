'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';

export default function LoginPage() {
  const chama = useSearchParams().get('chama');
  const q = chama ? `?chama=${encodeURIComponent(chama)}` : '';
  return (
    <AuthLayout
      title="Secure sign-in"
      eyebrow="Member sign-in"
      description="Use the chama code your officials gave you."
      footer={
        <div className="space-y-1">
          <p>New member? <Link href={`/register${q}`} className="font-medium text-primary hover:underline">Join your chama</Link></p>
          <p>Want to run your chama here? Contact us to register your chama.</p>
        </div>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
