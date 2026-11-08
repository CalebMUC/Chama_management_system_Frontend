'use client';

import Link from 'next/link';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';

export default function AdminLoginPage() {
  return (
    <AuthLayout
      title="Platform administration"
      description="For the platform operator. No chama code."
      footer={<p>Chama member? <Link href="/login" className="font-medium text-primary hover:underline">Sign in to your chama</Link></p>}
    >
      <LoginForm admin />
    </AuthLayout>
  );
}
