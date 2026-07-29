import AuthForm from '@/components/auth/AuthForm';

// Force dynamic — depends on auth state for redirects
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Login — BunkBook',
};

export default function LoginPage() {
  return <AuthForm />;
}
