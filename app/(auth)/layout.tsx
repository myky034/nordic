// Auth layout — wraps authentication pages (login and signup).
// Provides a centred container for auth forms.
// No session check here — users must be able to reach /login unauthenticated.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      {children}
    </div>
  );
}
